import { browser } from '$app/environment';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import { RouteType, routePriorities, prioritizedRouteTypeForDisplay } from '$config/routeConfig';
import './../../assets/styles/leaflet-map.css';
import PolylineUtil from 'polyline-encoded';
import { COLORS } from '$lib/colors';
import PopupContent from '$components/map/PopupContent.svelte';
import ContextMenuPopup from '$components/map/ContextMenuPopup.svelte';
import { createVehicleIconSvg, iconHeight, iconWidth } from '$lib/MapHelpers/generateVehicleIcon';
import { animateMarkerTo, cancelMarkerAnimation } from '$lib/MapHelpers/animateMarker';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import TripPlanPinMarker from '$components/trip-planner/tripPlanPinMarker.svelte';
import { mount, unmount } from 'svelte';
import { env } from '$env/dynamic/public';
import { buildVehiclePopupData } from '$lib/vehicleUtils';

export default class OpenStreetMapProvider {
	constructor(handleStopMarkerSelect) {
		this.handleStopMarkerSelect = handleStopMarkerSelect;
		this.map = null;
		this.L = null;
		this.globalInfoWindow = null;
		this.popupContentComponent = null;
		this.stopsMap = new Map();
		this.stopMarkers = [];
		this.vehicleMarkers = [];
		this.maplibreLayer = env.PUBLIC_MAPLIBRE_STYLE || 'positron';
		this.markersMap = new Map();
		this.polylines = []; // Track all polylines for easy cleanup
		this.showStopsRoutesAtZoom = 16;
		this.routeLabelsVisible = false;
		this.contextMenuPopup = null;
		this.contextMenuComponent = null;
		// Incremented on each fitToPolylines() so a superseded route load's
		// pending reveal can detect it's stale and bail out.
		this._fitToken = 0;
	}

	async initMap(element, options) {
		if (!browser) return;

		const leaflet = await import('leaflet');
		await import('@maplibre/maplibre-gl-leaflet');
		await import('leaflet-polylinedecorator');

		this.L = leaflet.default;

		// Leaflet CSS
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
		document.head.appendChild(link);

		this.map = this.L.map(element, { zoomControl: false }).setView([options.lat, options.lng], 14);

		this.L.control.zoom({ position: 'bottomright' }).addTo(this.map);
		this.maplibreLayer = this.L.maplibreGL({
			style: `https://tiles.openfreemap.org/styles/${this.maplibreLayer}`,
			interactive: true,
			dragRotate: false
		}).addTo(this.map);

		// Update route labels (on stops) visibility on zoom changes
		this.map.on('zoomend', () => {
			this.updateMarkersRouteLabelVisibility();
		});
	}

	eventListeners(mapInstance, debouncedLoadMarkers) {
		mapInstance.addListener('dragend', debouncedLoadMarkers);
		mapInstance.addListener('zoomend', debouncedLoadMarkers);
		mapInstance.addListener('moveend', debouncedLoadMarkers);
	}

	addMarker(options) {
		if (!browser || !this.map) return null;

		// Check if marker already exists for this stop
		if (this.markersMap.has(options.stop.id)) {
			return this.markersMap.get(options.stop.id);
		}

		let icon = options.icon || faBus;

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

		const props = $state({
			stop: options.stop,
			icon: icon,
			onClick: options.onClick,
			isHighlighted: options.isHighlighted ?? false,
			showRoutesLabel: this.map.getZoom() >= this.showStopsRoutesAtZoom
		});

		mount(StopMarker, {
			target: container,
			props
		});

		const customIcon = this.L.divIcon({
			html: container,
			className: '',
			iconSize: [40, 40]
		});

		const marker = this.L.marker([options.position.lat, options.position.lng], {
			icon: customIcon,
			interactive: false,
			keyboard: false
		}).addTo(this.map);

		marker.props = props;

		this.markersMap.set(options.stop.id, marker);
		return marker;
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

	addPinMarker(position, text) {
		if (!this.map) return null;

		const container = document.createElement('div');

		mount(TripPlanPinMarker, {
			target: container,
			props: {
				text: text
			}
		});

		const customIcon = this.L.divIcon({
			html: container,
			className: '',
			iconSize: [32, 50],
			iconAnchor: [16, 50]
		});

		const marker = this.L.marker([position.lat, position.lng], { icon: customIcon }).addTo(
			this.map
		);

		return marker;
	}

	removePinMarker(marker) {
		if (marker) {
			marker.remove();
		}
	}

	highlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (!marker) return;

		// Update the reactive props (linked via $state)
		marker.props.isHighlighted = true;
	}

	unHighlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (!marker) return;

		marker.props.isHighlighted = false;
	}

	addStopRouteMarker(stop, stopTime = null) {
		const customIcon = L.divIcon({
			html: `<svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#000000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="feather feather-circle"><circle cx="12" cy="12" r="10"/></svg>`,
			className: 'route-stop-marker',
			iconSize: [20, 20],
			iconAnchor: [10, 10]
		});

		const marker = L.marker([stop.lat, stop.lon], { icon: customIcon }).addTo(this.map);

		this.stopsMap.set(stop.id, stop);

		marker.on('click', () => this.openStopMarker(stop, stopTime));

		this.stopMarkers.push(marker);
	}

	openStopMarker(stop, stopTime = null) {
		if (this.globalInfoWindow) {
			this.map.closePopup(this.globalInfoWindow);
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

		this.globalInfoWindow = L.popup()
			.setLatLng([stop.lat, stop.lon])
			.setContent(popupContainer)
			.openOn(this.map);
	}

	updatePopupContent(stop, arrivalTime = null) {
		if (this.popupContentComponent && this.globalInfoWindow) {
			unmount(this.popupContentComponent);

			const popupContainer = document.createElement('div');

			this.popupContentComponent = mount(PopupContent, {
				target: popupContainer,
				props: {
					stopName: stop.name,
					arrivalTime: arrivalTime,
					handleStopMarkerSelect: () => this.handleStopMarkerSelect(stop)
				}
			});

			this.globalInfoWindow.setContent(popupContainer);
		}
	}

	removeStopMarkers() {
		this.stopMarkers.forEach((marker) => {
			marker.remove();
		});
		this.stopMarkers = [];
	}

	cleanupInfoWindow() {
		if (this.globalInfoWindow) {
			this.globalInfoWindow.close();
		}
	}

	removeStopMarker(marker) {
		marker.remove();
	}

	addVehicleMarker(vehicle, activeTrip, routeType) {
		if (!this.map || !this.L) return null;

		let color;
		if (!vehicle.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const vehicleIconSvg = createVehicleIconSvg(vehicle?.orientation, color, routeType);
		const customIcon = this.L.divIcon({
			html: `<img src="data:image/svg+xml;charset=UTF-8,${encodeURIComponent(vehicleIconSvg)}" alt="" />`,
			iconSize: [iconWidth, iconHeight],
			iconAnchor: [iconWidth / 2, iconHeight / 2],
			className: '',
			zIndexOffset: 1000
		});

		const marker = this.L.marker([vehicle.position.lat, vehicle.position.lon], {
			icon: customIcon,
			zIndexOffset: 1000
		}).addTo(this.map);

		this.vehicleMarkers.push(marker);

		const vehicleData = $state(buildVehiclePopupData(vehicle, activeTrip, this.stopsMap));

		marker.vehicleData = vehicleData;

		marker.bindPopup(document.createElement('div'));

		marker.on('popupopen', () => {
			const popupContainer = document.createElement('div');

			marker.popupComponent = mount(VehiclePopupContent, {
				target: popupContainer,
				props: marker.vehicleData
			});

			marker.getPopup().setContent(popupContainer);
		});

		marker.on('popupclose', () => {
			if (marker.popupComponent) {
				unmount(marker.popupComponent);
				marker.popupComponent = null;
			}
		});

		return marker;
	}

	updateVehicleMarker(marker, vehicleStatus, activeTrip, routeType) {
		if (!this.map || !this.L || !marker) return;

		let color;
		if (!vehicleStatus.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const updatedIconSvg = createVehicleIconSvg(vehicleStatus.orientation, color, routeType);
		const updatedIcon = this.L.divIcon({
			html: `<img src="data:image/svg+xml;charset=UTF-8,${encodeURIComponent(updatedIconSvg)}" alt="" />`,
			iconSize: [iconWidth, iconHeight],
			iconAnchor: [iconWidth / 2, iconHeight / 2],
			className: '',
			zIndexOffset: 1000
		});

		const current = marker.getLatLng();
		animateMarkerTo(
			marker,
			{ lat: current.lat, lng: current.lng },
			{ lat: vehicleStatus.position.lat, lng: vehicleStatus.position.lon },
			(lat, lng) => marker.setLatLng([lat, lng]),
			{ routePaths: this._getRoutePaths() }
		);
		marker.setIcon(updatedIcon);

		Object.assign(
			marker.vehicleData,
			buildVehiclePopupData(vehicleStatus, activeTrip, this.stopsMap)
		);
	}
	removeVehicleMarker(marker) {
		if (marker) {
			cancelMarkerAnimation(marker);
			marker.remove();
		}
	}

	clearVehicleMarkers() {
		if (!this.map) return;

		this.vehicleMarkers.forEach((marker) => {
			cancelMarkerAnimation(marker);
			marker.remove();
		});
		this.vehicleMarkers = [];
	}

	/**
	 * Returns the currently drawn route shapes as plain coordinate arrays, used
	 * to animate vehicles along the route instead of in a straight line.
	 * @returns {Array<Array<{lat:number,lng:number}>>}
	 */
	_getRoutePaths() {
		return (
			this.polylines
				.map((polyline) => polyline.getLatLngs())
				// getLatLngs() nests one level for multi-segment polylines; flatten
				// that single level so a vertex list is always one level deep.
				.map((points) => (Array.isArray(points) ? points.flat(1) : []))
				.filter((points) => points.length >= 2)
				.map((points) => points.map((ll) => ({ lat: ll.lat, lng: ll.lng })))
		);
	}

	addListener(event, callback) {
		if (!browser || !this.map) return;
		this.map.on(event, callback);
	}

	addUserLocationMarker(latLng) {
		if (!browser || !this.map) return;
		this.L.circleMarker([latLng.lat, latLng.lng], {
			radius: 8,
			fillColor: '#007BFF',
			fillOpacity: 1,
			color: '#FFFFFF',
			weight: 2
		}).addTo(this.map);
	}

	setCenter(latLng) {
		if (!browser || !this.map) return;
		this.map.setView([latLng.lat, latLng.lng]);
	}

	getCenter() {
		if (!browser || !this.map) return { lat: 0, lng: 0 };
		const center = this.map.getCenter();
		return { lat: center.lat, lng: center.lng };
	}

	removeMarker(marker) {
		if (!browser || !this.map || !marker) return;
		this.map.removeLayer(marker);

		for (const [stopId, storedMarker] of this.markersMap.entries()) {
			if (storedMarker === marker) {
				this.markersMap.delete(stopId);
				break;
			}
		}
	}

	clearAllStopMarkers() {
		if (!browser || !this.map) return;

		// Clear the main stop markers
		for (const marker of this.markersMap.values()) {
			this.map.removeLayer(marker);
		}
		this.markersMap.clear();
	}

	hasMarker(stopId) {
		return this.markersMap.has(stopId);
	}

	getMarker(stopId) {
		return this.markersMap.get(stopId);
	}

	setTheme(theme) {
		if (!browser || !this.map) return;

		let styleUrl;
		if (theme === 'dark') {
			styleUrl = 'https://tiles.openfreemap.org/styles/dark';
		} else {
			styleUrl = 'https://tiles.openfreemap.org/styles/positron';
		}

		if (this.maplibreLayer) {
			this.map.removeLayer(this.maplibreLayer);
		}

		this.maplibreLayer = this.L.maplibreGL({
			style: styleUrl
		}).addTo(this.map);
	}

	/**
	 * Creates a polyline from an encoded shape, returning `null` outside the
	 * browser, before the map is initialized, or when the shape decodes to empty.
	 *
	 * Contract note: this method is synchronous (`Polyline|null`), whereas the
	 * Google provider's createPolyline is async (`Promise<Polyline|null>`)
	 * because it lazy-loads its geometry library. Both return `null` on decode
	 * failure; callers that need provider-agnostic behavior should `await` the
	 * result and guard against `null`.
	 */
	createPolyline(points, options = {}) {
		if (!browser || !this.map) return null;

		const decodedPolyline = PolylineUtil.decode(points);
		if (!decodedPolyline || decodedPolyline.length === 0) {
			console.error('Failed to decode polyline:', points);
			return null;
		}

		const withArrow = options.withArrow ?? true;

		const polylineOpts = {
			color: options.color || COLORS.POLYLINE,
			weight: options.weight || 4,
			opacity: options.opacity ?? 1
		};
		if (options.dashArray) {
			polylineOpts.dashArray = options.dashArray;
		}
		const polyline = new this.L.Polyline(decodedPolyline, polylineOpts).addTo(this.map);

		this.polylines.push(polyline);

		if (!withArrow) return polyline;

		const arrowDecorator = this.L.polylineDecorator(polyline, {
			patterns: [
				{
					offset: 0,
					repeat: 125,
					symbol: this.L.Symbol.arrowHead({
						pixelSize: 12,
						pathOptions: {
							color: COLORS.POLYLINE_ARROW_STROKE,
							fill: true,
							fillColor: COLORS.POLYLINE_ARROW_FILL,
							fillOpacity: 0.85
						}
					})
				}
			]
		}).addTo(this.map);

		polyline.arrowDecorator = arrowDecorator;

		return polyline;
	}

	removePolyline(polyline) {
		if (!polyline) return;

		if (polyline._drawTimeoutId) {
			clearTimeout(polyline._drawTimeoutId);
			polyline._drawTimeoutId = null;
		}

		if (polyline.arrowDecorator) {
			polyline.arrowDecorator.remove();
			polyline.arrowDecorator = null;
		}

		polyline.remove();

		const index = this.polylines.indexOf(polyline);
		if (index > -1) {
			this.polylines.splice(index, 1);
		}
	}

	/**
	 * Clears all polylines from the map and resets the tracking array.
	 * This provides a centralized way to manage polyline cleanup for better state management.
	 */
	clearAllPolylines() {
		if (!browser || !this.map) return;

		this.polylines.forEach((polyline) => {
			if (polyline) {
				if (polyline._drawTimeoutId) {
					clearTimeout(polyline._drawTimeoutId);
					polyline._drawTimeoutId = null;
				}
				if (polyline.arrowDecorator) {
					polyline.arrowDecorator.remove();
					polyline.arrowDecorator = null;
				}
				polyline.remove();
			}
		});

		this.polylines = [];
	}

	getPolylinesCount() {
		return this.polylines.length;
	}

	panTo(lat, lng) {
		if (!browser || !this.map) return;
		this.map.panTo([lat, lng]);
	}

	flyTo(lat, lng, zoom = 15, options = {}) {
		if (!browser || !this.map) return;
		// Pass `{ animate: false }` to reposition instantly. An animated zoom
		// desyncs the MapLibre GL basemap from SVG overlays (e.g. a displayed
		// route), making the route flicker/float until the move settles.
		this.map.flyTo([lat, lng], zoom, { animate: options.animate ?? true });
	}

	setZoom(zoom) {
		if (!browser || !this.map) return;
		this.map.setZoom(zoom);
	}

	/**
	 * Toggles the visibility of all route polylines (and their arrow
	 * decorators) without removing them from the tracking array.
	 * @param {boolean} visible
	 */
	_setPolylinesVisible(visible) {
		this.polylines.forEach((polyline) => {
			[polyline, polyline.arrowDecorator].forEach((layer) => {
				if (!layer) return;
				if (visible) {
					if (!this.map.hasLayer(layer)) layer.addTo(this.map);
				} else if (this.map.hasLayer(layer)) {
					this.map.removeLayer(layer);
				}
			});
		});
	}

	/**
	 * Reveals the route polylines with a "draw from start to end" animation
	 * using the SVG stroke-dashoffset technique. The direction-arrow decorators
	 * are added once the line has finished drawing.
	 * @param {number} duration animation length in seconds
	 */
	_revealPolylinesWithDraw(duration = 1.2) {
		this.polylines.forEach((polyline) => {
			if (!this.map.hasLayer(polyline)) polyline.addTo(this.map);

			const path = polyline._path;
			const addDecorator = () => {
				if (polyline.arrowDecorator && !this.map.hasLayer(polyline.arrowDecorator)) {
					polyline.arrowDecorator.addTo(this.map);
				}
			};

			// SVG renderer only: fall back to an instant reveal otherwise.
			if (!path || typeof path.getTotalLength !== 'function') {
				addDecorator();
				return;
			}

			const length = path.getTotalLength();
			path.style.transition = 'none';
			path.style.strokeDasharray = `${length} ${length}`;
			path.style.strokeDashoffset = `${length}`;
			// Force a reflow so the starting offset is applied before transitioning.
			path.getBoundingClientRect();
			path.style.transition = `stroke-dashoffset ${duration}s ease-in-out`;
			path.style.strokeDashoffset = '0';

			polyline._drawTimeoutId = setTimeout(() => {
				polyline._drawTimeoutId = null;
				// Bail if the polyline was cleared mid-draw (e.g. rapid route switch).
				if (!this.map.hasLayer(polyline)) return;
				// Clear the inline styles so the original stroke (e.g. the dashed
				// pattern used for walking legs) is restored once drawing is done.
				path.style.transition = '';
				path.style.strokeDasharray = '';
				path.style.strokeDashoffset = '';
				addDecorator();
			}, duration * 1000);
		});
	}

	/**
	 * Smoothly flies the map view to the bounds of all currently drawn
	 * polylines so the full route is centered and visible. Returns true when a
	 * fit was applied.
	 * @param {{ padding?: [number, number], maxZoom?: number, duration?: number, drawDuration?: number }} [options]
	 * @returns {Promise<boolean>} resolves once the route reveal begins
	 */
	async fitToPolylines(options = {}) {
		if (!browser || !this.map || this.polylines.length === 0) return false;

		const bounds = this.L.latLngBounds([]);
		this.polylines.forEach((polyline) => {
			bounds.extend(polyline.getBounds());
		});

		if (!bounds.isValid()) return false;

		const duration = options.duration ?? 0.8;

		// Tag this load so a superseded reveal (a newer route started before this
		// one's moveend/fallback fired) can detect it's stale and skip drawing.
		const token = ++this._fitToken;

		// The MapLibre GL basemap lags behind Leaflet's coordinate space during
		// a zoom animation, so the streets slide under the (correctly placed)
		// SVG route and it appears misaligned. Hide the route while the camera
		// glides, then draw it once the basemap has settled so it always lands
		// perfectly aligned.
		this._setPolylinesVisible(false);

		return new Promise((resolve) => {
			let revealed = false;
			const reveal = () => {
				if (revealed) return;
				revealed = true;
				// A newer route load has taken over; don't draw its polylines here.
				if (token !== this._fitToken) {
					resolve(false);
					return;
				}
				this._revealPolylinesWithDraw(options.drawDuration ?? 1.2);
				// Resolve as the route starts drawing so callers can reveal stop
				// markers in sync, rather than before the camera has settled.
				resolve(true);
			};
			this.map.once('moveend', reveal);
			// Fallback in case the view doesn't change enough to fire `moveend`.
			setTimeout(reveal, duration * 1000 + 250);

			this.map.flyToBounds(bounds, {
				padding: options.padding ?? [50, 50],
				maxZoom: options.maxZoom ?? 16,
				duration
			});
		});
	}

	enableContextMenu() {
		if (!this.map) return;
		this.map.on('contextmenu', (e) => {
			this.showContextMenu(e.latlng);
		});
	}

	showContextMenu(latlng) {
		this.closeContextMenu();

		const popupContainer = document.createElement('div');

		const dispatchAndClose = (type) => {
			window.dispatchEvent(
				new CustomEvent('contextMenuTripPlan', {
					detail: { type, lat: latlng.lat, lng: latlng.lng }
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

		this.contextMenuPopup = L.popup({ closeButton: false, className: 'context-menu-popup' })
			.setLatLng([latlng.lat, latlng.lng])
			.setContent(popupContainer)
			.openOn(this.map);

		this.contextMenuPopup.on('remove', () => {
			if (this.contextMenuComponent) {
				unmount(this.contextMenuComponent);
				this.contextMenuComponent = null;
			}
		});
	}

	closeContextMenu() {
		if (this.contextMenuPopup) {
			this.map.closePopup(this.contextMenuPopup);
			this.contextMenuPopup = null;
		}
	}

	getBoundingBox() {
		const bounds = this.map.getBounds();
		const ne = bounds.getNorthEast();
		const sw = bounds.getSouthWest();
		return {
			north: ne.lat,
			east: ne.lng,
			south: sw.lat,
			west: sw.lng
		};
	}
}
