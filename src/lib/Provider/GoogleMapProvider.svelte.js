import { loadGoogleMapsLibrary, createMap, nightModeStyles } from '$lib/googleMaps';
import StopMarker from '$components/map/StopMarker.svelte';
import { BusFront } from '@lucide/svelte';
import {
	RouteType,
	routePriorities,
	prioritizedRouteTypeForDisplay,
	SHOW_ROUTE_LABELS_AT_ZOOM
} from '$config/routeConfig';
import { COLORS } from '$lib/colors';
import { polylineArrowColor } from '$lib/colorUtils';
import PopupContent from '$components/map/PopupContent.svelte';
import ContextMenuPopup from '$components/map/ContextMenuPopup.svelte';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import { createVehicleIconSvg, iconHeight, iconWidth } from '$lib/MapHelpers/generateVehicleIcon';
import { animateMarkerTo, cancelMarkerAnimation } from '$lib/MapHelpers/animateMarker';
import TripPlanPinMarker from '$components/trip-planner/tripPlanPinMarker.svelte';
import { mount, unmount } from 'svelte';
import { buildVehiclePopupData } from '$lib/vehicleUtils';
import { ROUTE_PANE } from '$lib/mapPanes.js';

// Google orders polylines by zIndex rather than by pane. Same contract as the
// OSM panes: every casing below every colored stroke, promoted above its peers.
const ROUTE_LAYER_Z_INDEX = {
	[ROUTE_PANE.CASING]: 10,
	[ROUTE_PANE.LINE]: 20,
	[ROUTE_PANE.PROMOTED]: 30
};

export default class GoogleMapProvider {
	constructor(apiKey, handleStopMarkerSelect) {
		this.apiKey = apiKey;
		this.map = null;
		this.globalInfoWindow = null;
		this.popupContentComponent = null;
		this.stopsMap = new Map();
		this.stopMarkers = [];
		// Route-drawn stop markers (addStopRouteMarker), keyed by stop id. Kept
		// separate from markersMap so drawing a route never clobbers the reactive
		// props handle addMarker put there for the same stop — see openStopMarker
		// for the anchor-resolution fallback this implies.
		this.routeStopMarkers = new Map();
		this.vehicleMarkers = [];
		this.markersMap = new Map();
		this.handleStopMarkerSelect = handleStopMarkerSelect;
		this.polylines = []; // Track all polylines for easy cleanup
		this.showStopsRoutesAtZoom = SHOW_ROUTE_LABELS_AT_ZOOM;
		this.routeLabelsVisible = false;
		this.contextMenuInfoWindow = null;
		this.contextMenuComponent = null;
		this.userLocationMarker = null;
		this._darkTheme = false;
		this._dimmed = false;
	}

	async initMap(element, options) {
		// Load the Google Maps library
		loadGoogleMapsLibrary(this.apiKey);

		// Wait for the Google Maps API to be fully loaded
		await new Promise((resolve) => {
			const checkGoogleMaps = () => {
				if (window.google && window.google.maps) {
					resolve();
				} else {
					setTimeout(checkGoogleMaps, 100);
				}
			};
			checkGoogleMaps();
		});

		// Use the createMap function from googleMaps.js
		this.map = await createMap({
			element,
			lat: options.lat,
			lng: options.lng
		});

		// Update route labels (on stops) visibility on zoom changes
		this.map.addListener('zoom_changed', () => {
			this.updateMarkersRouteLabelVisibility();
		});
	}

	eventListeners(mapInstance, debouncedLoadMarkers) {
		mapInstance.addListener('dragend', debouncedLoadMarkers);
		mapInstance.addListener('zoom_changed', debouncedLoadMarkers);
		mapInstance.addListener('center_changed', debouncedLoadMarkers);
	}

	addMarker(options) {
		try {
			if (this.markersMap.has(options.stop.id)) {
				return this.markersMap.get(options.stop.id);
			}

			let icon = options.icon || BusFront;

			if (!options.icon && options.stop.routes && options.stop.routes.length > 0) {
				const routeTypes = options.stop.routes.map((r) => r.type);
				let prioritizedType = RouteType.UNKNOWN;

				for (const priority of routePriorities) {
					if (routeTypes.includes(priority)) {
						prioritizedType = priority;
						break;
					}
				}

				icon = prioritizedRouteTypeForDisplay(prioritizedType);
			}

			const container = document.createElement('div');
			document.body.appendChild(container);

			const props = $state({
				stop: options.stop,
				icon: icon,
				onClick: options.onClick,
				isHighlighted: options.isHighlighted ?? false,
				showRoutesLabel: this.map.getZoom() >= this.showStopsRoutesAtZoom,
				emphasis: options.emphasis ?? 'full',
				dotColor: options.dotColor ?? null
			});

			const marker = mount(StopMarker, {
				target: container,
				props
			});

			this.markersMap.set(options.stop.id, marker);

			const overlay = new google.maps.OverlayView();
			overlay.onAdd = function () {
				this.getPanes().overlayMouseTarget.appendChild(container);
			};
			overlay.draw = function () {
				const projection = this.getProjection();
				const position = projection.fromLatLngToDivPixel(options.position);
				container.style.left = position.x - 20 + 'px';
				container.style.top = position.y - 20 + 'px';
				container.style.position = 'absolute';
				container.style.zIndex = '1000';
			};
			overlay.onRemove = function () {
				container.parentNode.removeChild(container);
			};
			overlay.setMap(this.map);

			const markerObj = { overlay, element: container, props };
			this.markersMap.set(options.stop.id, markerObj);

			return markerObj;
		} catch (error) {
			console.error('Error adding marker:', error);
			return null;
		}
	}

	removeMarker(markerObj) {
		if (!markerObj) return;

		if (markerObj.marker) {
			markerObj.marker.setMap(null);
		}
		if (markerObj.overlay) {
			markerObj.overlay.setMap(null);
		}
		if (markerObj.element && markerObj.element.parentNode) {
			markerObj.element.parentNode.removeChild(markerObj.element);
		}

		for (const [stopId, storedMarker] of this.markersMap.entries()) {
			if (storedMarker === markerObj) {
				this.markersMap.delete(stopId);
				break;
			}
		}
	}

	hasMarker(stopId) {
		return this.markersMap.has(stopId);
	}

	getMarker(stopId) {
		return this.markersMap.get(stopId);
	}

	clearAllStopMarkers() {
		if (!this.map) return;

		// Clear the main stop markers
		for (const marker of this.markersMap.values()) {
			this.removeMarker(marker);
		}
		this.markersMap.clear();
	}

	updateMarkersRouteLabelVisibility() {
		if (!this.map) return;

		const shouldShow = this.map.getZoom() >= this.showStopsRoutesAtZoom;

		if (this.routeLabelsVisible === shouldShow) return;

		this.routeLabelsVisible = shouldShow;

		// Batch update all markers
		for (const marker of this.markersMap.values()) {
			if (marker?.props) {
				marker.props.showRoutesLabel = shouldShow;
			}
		}
	}

	addStopRouteMarker(stop, stopTime = null) {
		const marker = new google.maps.Marker({
			position: { lat: stop.lat, lng: stop.lon },
			map: this.map,
			title: stop.name,
			icon: {
				path: google.maps.SymbolPath.CIRCLE,
				scale: 5,
				fillColor: '#FFFFFF',
				fillOpacity: 1,
				strokeWeight: 1,
				strokeColor: '#000000'
			}
		});

		this.stopsMap.set(stop.id, stop);

		marker.addListener('click', () => this.openStopMarker(stop, stopTime));

		// Deliberately not markersMap: a stop drawn as part of a route can already
		// have a StopMarker entry there (with a reactive `props` handle used by
		// setStopEmphasis/highlightMarker/etc.); overwriting it with this bare
		// google.maps.Marker would silently break emphasis for that stop.
		this.routeStopMarkers.set(stop.id, marker);
		this.stopMarkers.push(marker);
	}

	openStopMarker(stop, stopTime = null) {
		this.closeContextMenu();

		if (this.globalInfoWindow) {
			this.globalInfoWindow.close();
		}

		if (this.popupContentComponent) {
			unmount(this.popupContentComponent);
		}

		const popupContainer = document.createElement('div');

		this.popupContentComponent = mount(PopupContent, {
			target: popupContainer,
			props: {
				stopName: stop.name,
				arrivalTime: stopTime ? stopTime.arrivalTime : null,
				handleStopMarkerSelect: () => this.handleStopMarkerSelect(stop)
			}
		});

		this.globalInfoWindow = new google.maps.InfoWindow({
			content: popupContainer
		});

		// Route-drawn stops anchor to their routeStopMarkers entry; fall back to
		// markersMap for stops opened via their own StopMarker overlay.
		const anchor = this.routeStopMarkers.get(stop.id) ?? this.markersMap.get(stop.id);
		this.globalInfoWindow.open(this.map, anchor);
	}

	updatePopupContent(stop, arrivalTime = null) {
		if (this.popupContentComponent && this.globalInfoWindow) {
			// Unmount and remount the component with new props
			unmount(this.popupContentComponent);

			const popupContainer = this.globalInfoWindow.getContent();

			this.popupContentComponent = mount(PopupContent, {
				target: popupContainer,
				props: {
					stopName: stop.name,
					arrivalTime: arrivalTime,
					handleStopMarkerSelect: () => this.handleStopMarkerSelect(stop)
				}
			});
		}
	}

	highlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (!marker) return;

		marker.props.isHighlighted = true;
	}

	unHighlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (!marker) return;

		marker.props.isHighlighted = false;
	}

	/**
	 * Applies marker prominence across the map. Called by the map layer whenever the
	 * selection or the drawn route set changes.
	 *
	 * @param {Map<string, {emphasis: string, dotColor: string|null}>} byStopId
	 * @param {'full'|'muted'} defaultEmphasis - for stops not in byStopId
	 * @param {string|null} selectedStopId - always rendered as the full pin
	 */
	setStopEmphasis(byStopId, defaultEmphasis = 'full', selectedStopId = null) {
		for (const [stopId, marker] of this.markersMap) {
			// Defensive: every markersMap entry should be a StopMarker handle with a
			// reactive props object (addStopRouteMarker keeps its bare markers in
			// routeStopMarkers instead), but skip gracefully if that ever changes.
			if (!marker?.props) continue;

			if (stopId === selectedStopId) {
				marker.props.emphasis = 'full';
				marker.props.dotColor = null;
				continue;
			}

			const tier = byStopId.get(stopId);
			marker.props.emphasis = tier?.emphasis ?? defaultEmphasis;
			marker.props.dotColor = tier?.dotColor ?? null;
		}
	}

	resetStopEmphasis() {
		for (const marker of this.markersMap.values()) {
			if (!marker?.props) continue;
			marker.props.emphasis = 'full';
			marker.props.dotColor = null;
		}
	}

	removeStopMarkers() {
		this.stopMarkers.forEach((marker) => {
			marker.setMap(null);
		});
		this.stopMarkers = [];
		this.routeStopMarkers.clear();
	}

	addPinMarker(position, text) {
		const container = document.createElement('div');
		document.body.appendChild(container);

		mount(TripPlanPinMarker, {
			target: container,
			props: {
				text: text
			}
		});

		const overlay = new google.maps.OverlayView();

		overlay.onAdd = function () {
			this.getPanes().overlayMouseTarget.appendChild(container);
		};

		overlay.draw = function () {
			const projection = this.getProjection();
			const pos = projection.fromLatLngToDivPixel(
				new google.maps.LatLng(position.lat, position.lng)
			);
			container.style.left = `${pos.x - 16}px`;
			container.style.top = `${pos.y - 50}px`;
			container.style.position = 'absolute';
			container.style.zIndex = '1000';
		};

		overlay.onRemove = function () {
			container.parentNode.removeChild(container);
		};

		overlay.setMap(this.map);

		return { overlay, element: container };
	}

	removePinMarker(marker) {
		if (!marker) {
			return;
		}

		if (marker.overlay) {
			marker.overlay.setMap(null);
		}

		if (marker.element && marker.element.parentNode) {
			marker.element.parentNode.removeChild(marker.element);
		}
	}

	addVehicleMarker(vehicle, activeTrip, routeType, isHighlighted = false, routeColor = undefined) {
		if (!this.map) return null;

		let color = routeColor || undefined; // null/'' → createVehicleIconSvg blue default
		if (!vehicle.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const vehicleIconSvg = createVehicleIconSvg(
			vehicle?.orientation,
			color,
			routeType,
			isHighlighted
		);
		const icon = {
			url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(vehicleIconSvg)}`,
			scaledSize: new google.maps.Size(iconWidth, iconHeight),
			anchor: new google.maps.Point(iconWidth / 2, iconHeight / 2)
		};

		const marker = new google.maps.Marker({
			position: { lat: vehicle.position.lat, lng: vehicle.position.lon },
			map: this.map,
			icon: icon,
			zIndex: isHighlighted ? 2000 : 1000
		});

		this.vehicleMarkers.push(marker);

		const vehicleData = $state(buildVehiclePopupData(vehicle, activeTrip, this.stopsMap));

		marker.vehicleData = vehicleData;

		const popupContainer = document.createElement('div');
		marker.popupComponent = mount(VehiclePopupContent, {
			target: popupContainer,
			props: marker.vehicleData
		});

		marker.infoWindow = new google.maps.InfoWindow({
			content: popupContainer
		});

		marker.addListener('click', () => {
			marker.infoWindow.open(this.map, marker);
		});

		return marker;
	}

	updateVehicleMarker(
		marker,
		vehicleStatus,
		activeTrip,
		routeType,
		isHighlighted = false,
		routeColor = undefined
	) {
		if (!this.map || !marker) return;

		const current = marker.getPosition();
		animateMarkerTo(
			marker,
			{ lat: current.lat(), lng: current.lng() },
			{ lat: vehicleStatus.position.lat, lng: vehicleStatus.position.lon },
			(lat, lng) => marker.setPosition({ lat, lng }),
			{ routePaths: this._getRoutePaths() }
		);

		let color = routeColor || undefined; // null/'' → createVehicleIconSvg blue default
		if (!vehicleStatus.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const updatedIcon = createVehicleIconSvg(
			vehicleStatus.orientation,
			color,
			routeType,
			isHighlighted
		);
		marker.setIcon({
			url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(updatedIcon)}`,
			scaledSize: new google.maps.Size(iconWidth, iconHeight),
			anchor: new google.maps.Point(iconWidth / 2, iconHeight / 2)
		});
		marker.setZIndex(isHighlighted ? 2000 : 1000);

		Object.assign(
			marker.vehicleData,
			buildVehiclePopupData(vehicleStatus, activeTrip, this.stopsMap)
		);
	}

	removeVehicleMarker(marker) {
		if (!marker) return;

		cancelMarkerAnimation(marker);
		marker.setMap(null);

		const index = this.vehicleMarkers.indexOf(marker);
		if (index > -1) {
			this.vehicleMarkers.splice(index, 1);
		}
	}

	clearVehicleMarkers() {
		if (!this.map) return;

		for (const marker of this.vehicleMarkers) {
			cancelMarkerAnimation(marker);
			marker.setMap(null);
		}
		this.vehicleMarkers = [];
	}

	/**
	 * Returns the currently drawn route shapes as plain coordinate arrays, used
	 * to animate vehicles along the route instead of in a straight line.
	 * @returns {Array<Array<{lat:number,lng:number}>>}
	 */
	_getRoutePaths() {
		return this.polylines
			.map((polyline) => polyline.getPath()?.getArray() ?? [])
			.filter((points) => points.length >= 2)
			.map((points) => points.map((ll) => ({ lat: ll.lat(), lng: ll.lng() })));
	}

	cleanupInfoWindow() {
		if (this.globalInfoWindow) {
			this.globalInfoWindow.close();
		}
	}

	setCenter(latLng) {
		this.map.setCenter(latLng);
	}

	getCenter() {
		const center = this.map.getCenter();
		return { lat: center.lat(), lng: center.lng() };
	}

	getZoom() {
		return this.map.getZoom();
	}

	addListener(event, callback) {
		this.map.addListener(event, callback);
	}

	/**
	 * Google replaces the whole `styles` array on setOptions, so theme and dim have
	 * to be composed in one place — otherwise a theme toggle silently drops the dim.
	 *
	 * Caveat (needs manual verification, not testable in jsdom): the dim styler
	 * below uses `saturation`/`lightness`, which Google's style reference defines
	 * as *relative* to the base map style. nightModeStyles() sets *absolute*
	 * `color` on nearly every element instead. Whether a trailing relative styler
	 * visibly dims already-absolute-colored elements is not guaranteed by the
	 * API — add this to the manual dark-mode verification list for a
	 * Google-configured deployment.
	 */
	_applyStyles() {
		// Guard here, at the single choke point both setTheme and setBasemapDimmed
		// pass through: the provider is constructed with this.map = null, and
		// MapView.initMap swallows init failures, so a themeChange -> setTheme ->
		// _applyStyles after a failed Google init must no-op rather than throw on
		// this.map.setOptions. Mirrors OSM's `if (!browser || !this.map) return;`.
		if (!this.map) return;

		const base = this._darkTheme ? nightModeStyles() : [];
		const dim = this._dimmed
			? [
					{
						featureType: 'all',
						elementType: 'all',
						stylers: [{ saturation: -45 }, { lightness: 25 }]
					}
				]
			: [];
		const styles = [...base, ...dim];
		this.map.setOptions({ styles: styles.length ? styles : null });
	}

	setTheme(theme) {
		this._darkTheme = theme === 'dark';
		this._applyStyles();
	}

	setBasemapDimmed(dimmed) {
		// Null-map guard lives in _applyStyles, which both callers pass through.
		this._dimmed = dimmed;
		this._applyStyles();
	}

	/**
	 * Shows the user's location. There is only ever one such marker: repeat calls
	 * move the existing one, so successive location fixes can't leave a trail of
	 * stale blue dots behind.
	 */
	addUserLocationMarker(latLng) {
		if (this.userLocationMarker) {
			this.userLocationMarker.setPosition(latLng);
			return this.userLocationMarker;
		}

		this.userLocationMarker = new google.maps.Marker({
			map: this.map,
			position: latLng,
			title: 'Your Location',
			icon: {
				path: google.maps.SymbolPath.CIRCLE,
				scale: 8,
				fillColor: '#007BFF',
				fillOpacity: 1,
				strokeWeight: 2,
				strokeColor: '#FFFFFF'
			}
		});

		return this.userLocationMarker;
	}

	removeUserLocationMarker() {
		if (!this.userLocationMarker) return;
		this.userLocationMarker.setMap(null);
		this.userLocationMarker = null;
	}

	/**
	 * Creates a polyline from an encoded shape, returning `null` when the shape
	 * can't be decoded (uniform with the OSM provider).
	 *
	 * Contract note: this method is async — it returns a `Promise<Polyline|null>`
	 * because it lazy-loads the Google geometry library — whereas the OSM
	 * provider's createPolyline is synchronous (`Polyline|null`). Callers that
	 * need provider-agnostic behavior should `await` the result and guard
	 * against `null`.
	 */
	async createPolyline(shape, options = {}) {
		// Backward compat: old callers pass a boolean as the second arg
		if (typeof options === 'boolean') {
			options = { withArrow: options };
		}

		const withArrow = options.withArrow !== undefined ? options.withArrow : true;

		await window.google.maps.importLibrary('geometry');

		let decodedPath;
		try {
			decodedPath = google.maps.geometry.encoding.decodePath(shape);
		} catch (error) {
			console.error('Failed to decode polyline:', error?.message);
			return null;
		}
		if (!decodedPath || decodedPath.length === 0) {
			console.error('Failed to decode polyline:', shape);
			return null;
		}
		const path = decodedPath.map((point) => ({ lat: point.lat(), lng: point.lng() }));
		const weight = options.weight || 5;

		const polylineOptions = {
			path,
			geodesic: true,
			strokeColor: options.color || COLORS.POLYLINE,
			strokeOpacity: options.dashArray ? 0 : (options.opacity ?? 1.0),
			strokeWeight: weight
		};

		const zIndex = ROUTE_LAYER_Z_INDEX[options.pane];
		if (zIndex !== undefined) {
			polylineOptions.zIndex = zIndex;
		} else if (options.casing) {
			// The casing below always gets an explicit zIndex (its own default or
			// ROUTE_LAYER_Z_INDEX[ROUTE_PANE.CASING]). Google documents no default
			// for PolylineOptions.zIndex, so an explicit casing zIndex beats an
			// unset line zIndex — without this, an unpaned casing:true call would
			// paint the white casing over its own colored line.
			polylineOptions.zIndex = ROUTE_LAYER_Z_INDEX[ROUTE_PANE.LINE];
		}

		const icons = [];

		// Dashed line for walking legs
		if (options.dashArray) {
			icons.push({
				icon: {
					path: 'M 0,-1 0,1',
					strokeOpacity: options.opacity ?? 1.0,
					strokeColor: options.color || COLORS.POLYLINE,
					scale: options.weight || 5
				},
				offset: '0',
				repeat: '20px'
			});
		}

		if (withArrow) {
			const arrowColor = polylineArrowColor(options.color);
			const arrowSymbol = {
				path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
				scale: 2,
				strokeColor: arrowColor,
				strokeWeight: 3,
				fillColor: arrowColor,
				fillOpacity: 1
			};

			icons.push({
				icon: arrowSymbol,
				offset: '100%',
				repeat: '50px'
			});
		}

		if (icons.length > 0) {
			polylineOptions.icons = icons;
		}

		const polyline = new window.google.maps.Polyline(polylineOptions);

		polyline.setMap(this.map);

		// White casing underneath, so the route reads on any basemap tile without a
		// halo hack. Kept off this.polylines (same shape as OSM) so
		// fitToPolylines/getPolylinesCount/_getRoutePaths don't double-count it,
		// and torn down alongside its polyline.
		if (options.casing) {
			polyline._casing = new window.google.maps.Polyline({
				path,
				geodesic: true,
				strokeColor: '#ffffff',
				strokeOpacity: 0.95,
				strokeWeight: weight + 5,
				zIndex: ROUTE_LAYER_Z_INDEX[options.casingPane] ?? ROUTE_LAYER_Z_INDEX[ROUTE_PANE.CASING],
				map: this.map
			});
		}

		this.polylines.push(polyline);

		return polyline;
	}

	/**
	 * Moves an already-drawn polyline to a different stacking layer — used to
	 * promote the expanded arrival's route above its peers. Uniform in intent
	 * with OpenStreetMapProvider.setPolylineLayer, but Google's Polyline
	 * orders purely by `zIndex`, so re-paning is a single option update rather
	 * than a detach/reattach.
	 */
	setPolylineLayer(polyline, pane) {
		if (!this.map || !polyline) return;
		polyline.setOptions({ zIndex: ROUTE_LAYER_Z_INDEX[pane] });
	}

	async removePolyline(polyline) {
		if (polyline && polyline.setMap) {
			polyline.setMap(null);
		}

		if (polyline?._casing) {
			polyline._casing.setMap(null);
			polyline._casing = null;
		}

		// Remove from tracking array
		const index = this.polylines.indexOf(polyline);
		if (index > -1) {
			this.polylines.splice(index, 1);
		}

		return null;
	}

	/**
	 * Clears all polylines from the map and resets the tracking array.
	 * This provides a centralized way to manage polyline cleanup for better state management.
	 */
	clearAllPolylines() {
		// Remove all polylines from the map
		this.polylines.forEach((polyline) => {
			if (polyline && polyline.setMap) {
				polyline.setMap(null);
			}
			if (polyline?._casing) {
				polyline._casing.setMap(null);
				polyline._casing = null;
			}
		});

		this.polylines = [];
	}

	/**
	 * Returns the number of currently active polylines on the map.
	 * Useful for debugging and state management.
	 */
	getPolylinesCount() {
		return this.polylines.length;
	}

	panTo(lat, lng) {
		this.map.panTo({ lat, lng });
	}

	// Google Maps repositions instantly here (no zoom animation), so its native
	// polylines never desync. `options.animate` is accepted to mirror the OSM
	// provider's signature but has no effect here.
	flyTo(lat, lng, zoom = 15, options = {}) {
		this.map.setZoom(zoom);
		this.map.setCenter({ lat, lng });
		// `offsetY` (fraction of the map height) pans the map south of the target
		// so the marker rises that far above center, clearing the mobile bottom
		// sheet.
		if (options.offsetY) {
			this.map.panBy(0, this.map.getDiv().offsetHeight * options.offsetY);
		}
	}
	setZoom(zoom) {
		this.map.setZoom(zoom);
	}

	/**
	 * Fits the map view to the bounds of all currently drawn polylines so the
	 * full route is centered and visible. Returns true when a fit was applied.
	 * @param {{ padding?: number | { top?: number, right?: number, bottom?: number, left?: number }, maxZoom?: number }} [options]
	 * @returns {Promise<boolean>} resolves once the view has settled
	 */
	async fitToPolylines(options = {}) {
		if (!this.map || this.polylines.length === 0) return false;

		const bounds = new window.google.maps.LatLngBounds();
		this.polylines.forEach((polyline) => {
			polyline.getPath().forEach((latLng) => bounds.extend(latLng));
		});

		if (bounds.isEmpty()) return false;

		const maxZoom = options.maxZoom ?? 16;

		return new Promise((resolve) => {
			let settled = false;
			let idleListener = null;
			// fitBounds has no maxZoom option on Google Maps, so clamp once the
			// view settles to avoid zooming in too far on short routes. Resolve
			// here so callers can reveal stop markers in sync with the fit.
			const finish = () => {
				if (settled) return;
				settled = true;
				// Drop the idle listener in case we resolved via the timeout
				// safety net below before `idle` ever fired.
				if (idleListener) window.google.maps.event.removeListener(idleListener);
				if (this.map.getZoom() > maxZoom) {
					this.map.setZoom(maxZoom);
				}
				resolve(true);
			};

			idleListener = window.google.maps.event.addListenerOnce(this.map, 'idle', finish);
			// Safety net: Google Maps does not guarantee an `idle` event when
			// fitBounds produces no viewport change, so resolve anyway after a
			// short delay to avoid hanging callers that await this.
			setTimeout(finish, 1000);

			this.map.fitBounds(bounds, options.padding ?? 50);
		});
	}

	/**
	 * Provider-parity no-op. Google's Polyline has no SVG path, so the
	 * stroke-dashoffset draw-in used by the OSM provider has no analogue; Google
	 * routes appear immediately. Kept so callers don't have to branch on provider.
	 */
	revealPolylines() {}

	enableContextMenu() {
		if (!this.map) return;
		this.map.addListener('rightclick', (e) => {
			this.showContextMenu(e.latLng);
		});
	}

	showContextMenu(latLng) {
		this.closeContextMenu();

		const lat = latLng.lat();
		const lng = latLng.lng();

		const popupContainer = document.createElement('div');

		const dispatchAndClose = (type) => {
			window.dispatchEvent(
				new CustomEvent('contextMenuTripPlan', {
					detail: { type, lat, lng }
				})
			);
			this.closeContextMenu();
		};

		this.contextMenuComponent = mount(ContextMenuPopup, {
			target: popupContainer,
			props: {
				onStartHere: () => dispatchAndClose('from'),
				onEndHere: () => dispatchAndClose('to')
			}
		});

		if (this.globalInfoWindow) {
			this.globalInfoWindow.close();
		}

		this.contextMenuInfoWindow = new google.maps.InfoWindow({
			content: popupContainer,
			position: { lat, lng }
		});

		this.contextMenuInfoWindow.addListener('closeclick', () => {
			if (this.contextMenuComponent) {
				unmount(this.contextMenuComponent);
				this.contextMenuComponent = null;
			}
		});

		this.contextMenuInfoWindow.open(this.map);
	}

	closeContextMenu() {
		if (this.contextMenuInfoWindow) {
			this.contextMenuInfoWindow.close();
			if (this.contextMenuComponent) {
				unmount(this.contextMenuComponent);
				this.contextMenuComponent = null;
			}
			this.contextMenuInfoWindow = null;
		}
	}

	getBoundingBox() {
		const bounds = this.map.getBounds();
		const ne = bounds.getNorthEast();
		const sw = bounds.getSouthWest();
		return {
			north: ne.lat(),
			east: ne.lng(),
			south: sw.lat(),
			west: sw.lng()
		};
	}
}
