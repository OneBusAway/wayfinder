import { browser } from '$app/environment';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import {
	RouteType,
	routePriorities,
	prioritizedRouteTypeForDisplay,
	SHOW_ROUTE_LABELS_AT_ZOOM
} from '$config/routeConfig';
import 'leaflet/dist/leaflet.css';
import './../../assets/styles/leaflet-map.css';
import PolylineUtil from 'polyline-encoded';
import { COLORS } from '$lib/colors';
import { polylineArrowColor } from '$lib/colorUtils';
import PopupContent from '$components/map/PopupContent.svelte';
import ContextMenuPopup from '$components/map/ContextMenuPopup.svelte';
import { createVehicleIconSvg, iconHeight, iconWidth } from '$lib/MapHelpers/generateVehicleIcon';
import { animateMarkerTo, cancelMarkerAnimation } from '$lib/MapHelpers/animateMarker';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import TripPlanPinMarker from '$components/trip-planner/tripPlanPinMarker.svelte';
import { mount, unmount } from 'svelte';
import { env } from '$env/dynamic/public';
import { buildVehiclePopupData } from '$lib/vehicleUtils';
import { get } from 'svelte/store';
import { t } from 'svelte-i18n';
import { ROUTE_PANE_Z_INDEX } from '$lib/mapPanes.js';

// activeTrip is always truthy here: the sole caller (vehicleUtils.js) guards on
// it, and buildVehiclePopupData reads activeTrip.tripHeadsign without optional
// chaining. Keep this contract consistent rather than implying null is expected.
function getVehicleLabel(activeTrip) {
	const translate = get(t);
	return activeTrip.tripHeadsign
		? translate('vehicle.to_headsign', { values: { headsign: activeTrip.tripHeadsign } })
		: translate('vehicle.label');
}

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
		this.showStopsRoutesAtZoom = SHOW_ROUTE_LABELS_AT_ZOOM;
		this.routeLabelsVisible = false;
		this.contextMenuPopup = null;
		this.contextMenuComponent = null;
		this.userLocationMarker = null;
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

		// Leaflet's CSS is bundled via the top-of-file import 'leaflet/dist/leaflet.css'
		// rather than injected from a CDN at runtime, so the map's core styles aren't a
		// render-blocking third-party request or a single point of failure.

		this.map = this.L.map(element, { zoomControl: false }).setView([options.lat, options.lng], 14);

		this.L.control.zoom({ position: 'bottomright' }).addTo(this.map);
		// Record the applied style URL so setTheme() can skip a redundant layer
		// rebuild when the theme already matches the boot style (see setTheme).
		this.currentStyleUrl = `https://tiles.openfreemap.org/styles/${this.maplibreLayer}`;
		this.maplibreLayer = this.L.maplibreGL({
			style: this.currentStyleUrl,
			interactive: true,
			dragRotate: false
		}).addTo(this.map);

		// Update route labels (on stops) visibility on zoom changes
		this.map.on('zoomend', () => {
			this.updateMarkersRouteLabelVisibility();
		});

		// Custom panes give the route layer explicit stacking: every casing below
		// every colored stroke, and the promoted route above its peers.
		// createPane does not assign a z-index — .leaflet-pane sets 400 for all of
		// them — so it must be set here, or the panes tie with overlayPane and
		// order only by DOM insertion.
		for (const [name, zIndex] of Object.entries(ROUTE_PANE_Z_INDEX)) {
			this.map.createPane(name);
			this.map.getPane(name).style.zIndex = String(zIndex);
		}
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
			showRoutesLabel: this.map.getZoom() >= this.showStopsRoutesAtZoom,
			emphasis: options.emphasis ?? 'full',
			dotColor: options.dotColor ?? null
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

		// keyboard: false is load-bearing. Leaflet's Marker._initIcon stamps
		// tabindex="0" + role="button" on the wrapper <div> whenever keyboard is
		// truthy (its default), regardless of interactive. That wrapper holds the
		// mounted StopMarker, which already has its own real <button> with an
		// aria-label accessible name — so leaving keyboard on would create nested
		// interactive controls plus a second, unlabeled, dead tab stop per stop.
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
			// reactive props object, but skip gracefully if that ever changes.
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

	/**
	 * Fades the basemap so the colored routes and vehicles carry the map.
	 *
	 * The MapLibre GL canvas is the only thing in Leaflet's tilePane, so a CSS
	 * filter scoped there dims the basemap and nothing else — routes and markers
	 * live in overlayPane/markerPane and keep full contrast. The class goes on the
	 * container rather than the layer so it survives setTheme's layer rebuild.
	 */
	setBasemapDimmed(dimmed) {
		if (!browser || !this.map) return;
		this.map.getContainer().classList.toggle('oba-dim-basemap', dimmed);
	}

	// Leaflet only activates markers on Enter, so we add Space for ARIA button parity.
	attachKeyboardActivation(el, onActivate) {
		el.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.stopPropagation();
				onActivate();
			}
		});
	}

	/**
	 * Apply aria-label and keyboard activation to a Leaflet marker element.
	 * Logs a warning when getElement() returns null so inaccessible markers are
	 * not silently shipped during teardown or before first render.
	 *
	 * @param {import('leaflet').Marker} marker
	 * @param {{ label?: string, onActivate?: () => void, context: string }} options
	 */
	setupMarkerAccessibility(marker, { label, onActivate, context }) {
		const el = marker.getElement();
		if (el) {
			if (label) {
				el.setAttribute('aria-label', label);
			}
			if (onActivate) {
				this.attachKeyboardActivation(el, onActivate);
			}
			return;
		}

		console.warn(
			`OpenStreetMapProvider: marker DOM element unavailable during ${context} accessibility setup`
		);
	}

	addStopRouteMarker(stop, stopTime = null) {
		if (!this.map || !this.L) return;

		const customIcon = this.L.divIcon({
			html: `<svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#000000"
				stroke-width="1" stroke-linecap="round" stroke-linejoin="round"
				style="display:block;margin:auto;" aria-hidden="true">
				<circle cx="12" cy="12" r="10"/>
			</svg>`,
			className: 'route-stop-marker',
			iconSize: [24, 24],
			iconAnchor: [12, 12]
		});

		const marker = this.L.marker([stop.lat, stop.lon], {
			icon: customIcon,
			title: stop.name
		}).addTo(this.map);

		const open = () => this.openStopMarker(stop, stopTime);

		this.setupMarkerAccessibility(marker, {
			label: stop.name || undefined,
			onActivate: open,
			context: 'stop route marker'
		});

		marker.on('click', open);

		this.stopsMap.set(stop.id, stop);
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

	addVehicleMarker(vehicle, activeTrip, routeType, isHighlighted = false, routeColor = undefined) {
		if (!this.map || !this.L) return null;

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
		const zIndexOffset = isHighlighted ? 2000 : 1000;
		const customIcon = this.L.divIcon({
			html: `<img alt="" src="data:image/svg+xml;charset=UTF-8,${encodeURIComponent(vehicleIconSvg)}" />`,
			iconSize: [iconWidth, iconHeight],
			iconAnchor: [iconWidth / 2, iconHeight / 2],
			className: ''
		});

		const label = getVehicleLabel(activeTrip);

		const marker = this.L.marker([vehicle.position.lat, vehicle.position.lon], {
			icon: customIcon,
			zIndexOffset,
			title: label
		}).addTo(this.map);

		// preventDefault inside attachKeyboardActivation is load-bearing here: bindPopup makes Leaflet attach its own _onKeyPress (Enter -> toggle popup) on the keypress event. Suppressing the default keydown stops that synthesized keypress, so our openPopup() doesn't double-fire and flash the popup open-then-closed. stopPropagation does NOT cover this (keydown and keypress are separate events) — do not remove preventDefault.
		this.setupMarkerAccessibility(marker, {
			label,
			onActivate: () => marker.openPopup(),
			context: 'vehicle marker'
		});

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

	updateVehicleMarker(
		marker,
		vehicleStatus,
		activeTrip,
		routeType,
		isHighlighted = false,
		routeColor = undefined
	) {
		if (!this.map || !this.L || !marker) return;

		let color = routeColor || undefined; // null/'' → createVehicleIconSvg blue default
		if (!vehicleStatus.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const updatedIconSvg = createVehicleIconSvg(
			vehicleStatus.orientation,
			color,
			routeType,
			isHighlighted
		);
		const updatedIcon = this.L.divIcon({
			html: `<img alt="" src="data:image/svg+xml;charset=UTF-8,${encodeURIComponent(updatedIconSvg)}" />`,
			iconSize: [iconWidth, iconHeight],
			iconAnchor: [iconWidth / 2, iconHeight / 2],
			className: ''
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
		// setIcon doesn't touch stacking order, so update the offset directly to
		// reflect the current highlight state (divIcon ignores zIndexOffset).
		marker.setZIndexOffset(isHighlighted ? 2000 : 1000);

		// Leaflet reuses the existing <div> on setIcon and skips re-applying options.title, so refresh both the tooltip and the accessible name when the headsign changes mid-trip; otherwise the hover tooltip goes stale.
		const updatedLabel = getVehicleLabel(activeTrip);
		marker.options.title = updatedLabel;
		const el = marker.getElement();
		if (el) {
			el.setAttribute('aria-label', updatedLabel);
			el.setAttribute('title', updatedLabel);
		}

		Object.assign(
			marker.vehicleData,
			buildVehiclePopupData(vehicleStatus, activeTrip, this.stopsMap)
		);
	}
	removeVehicleMarker(marker) {
		if (marker) {
			cancelMarkerAnimation(marker);
			marker.remove();
			const index = this.vehicleMarkers.indexOf(marker);
			if (index > -1) {
				this.vehicleMarkers.splice(index, 1);
			}
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

	/**
	 * Shows the user's location. There is only ever one such marker: repeat calls
	 * move the existing one, so successive location fixes can't leave a trail of
	 * stale blue dots behind.
	 */
	addUserLocationMarker(latLng) {
		if (!browser || !this.map) return null;

		if (this.userLocationMarker) {
			this.userLocationMarker.setLatLng([latLng.lat, latLng.lng]);
			return this.userLocationMarker;
		}

		this.userLocationMarker = this.L.circleMarker([latLng.lat, latLng.lng], {
			radius: 8,
			fillColor: '#007BFF',
			fillOpacity: 1,
			color: '#FFFFFF',
			weight: 2
		}).addTo(this.map);

		return this.userLocationMarker;
	}

	removeUserLocationMarker() {
		if (!browser || !this.map || !this.userLocationMarker) return;
		this.map.removeLayer(this.userLocationMarker);
		this.userLocationMarker = null;
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

	getZoom() {
		if (!browser || !this.map) return 0;
		return this.map.getZoom();
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

		// Rebuilding the MapLibre layer re-fetches the style, sprites, glyph fonts,
		// and vector tiles. Skip it when the style is unchanged — otherwise the
		// themeChange dispatched right after initMap tears down and rebuilds the
		// layer with the identical style, doubling the map's cold-load network cost.
		if (styleUrl === this.currentStyleUrl) return;
		this.currentStyleUrl = styleUrl;

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
		const weight = options.weight || 4;
		const pane = options.pane;

		// White casing underneath, so the route reads on any basemap tile without a
		// halo hack. Created first so it renders below; kept off this.polylines (like
		// arrowDecorator) so fitToPolylines/getPolylinesCount/_getRoutePaths don't
		// double-count it, and torn down with its polyline.
		let casing = null;
		if (options.casing) {
			casing = new this.L.Polyline(decodedPolyline, {
				color: '#ffffff',
				weight: weight + 5,
				opacity: 0.95,
				lineCap: 'round',
				lineJoin: 'round',
				...(options.casingPane ? { pane: options.casingPane } : {})
			}).addTo(this.map);
		}

		const polylineOpts = {
			color: options.color || COLORS.POLYLINE,
			weight,
			opacity: options.opacity ?? 1,
			lineCap: 'round',
			lineJoin: 'round'
		};
		if (pane) polylineOpts.pane = pane;
		if (options.dashArray) {
			polylineOpts.dashArray = options.dashArray;
		}
		const polyline = new this.L.Polyline(decodedPolyline, polylineOpts).addTo(this.map);
		polyline._casing = casing;

		this.polylines.push(polyline);

		if (!withArrow) return polyline;

		const arrowColor = polylineArrowColor(options.color);
		const arrowDecorator = this.L.polylineDecorator(polyline, {
			patterns: [
				{
					offset: 0,
					repeat: 125,
					symbol: this.L.Symbol.arrowHead({
						pixelSize: 12,
						pathOptions: {
							color: arrowColor,
							fill: true,
							fillColor: arrowColor,
							fillOpacity: 0.85,
							...(pane ? { pane } : {})
						}
					})
				}
			]
		}).addTo(this.map);

		polyline.arrowDecorator = arrowDecorator;

		return polyline;
	}

	/**
	 * Moves an already-drawn polyline to a different stacking pane — used to
	 * promote the expanded arrival's route above its peers.
	 *
	 * Not a property set: Leaflet's Path.beforeAdd resolves
	 * `this._renderer = map.getRenderer(this)` once, at add time, from
	 * `layer.options.pane`. Assigning `polyline.options.pane` on an
	 * already-added layer does nothing on its own — the layer must be
	 * detached and reattached for the new pane to take effect.
	 *
	 * SVG._initPath creates a brand-new `<path>` DOM element on every onAdd,
	 * discarding any in-flight reveal transition, so a pending
	 * `_drawTimeoutId` is cleared first — left alone, it would later fire its
	 * "clear the inline dash styles" step against the dead node.
	 *
	 * The arrow decorator bakes `pane` into its `Symbol.arrowHead`
	 * `pathOptions` at construction time, so it has to be recreated, not just
	 * re-added, to follow the line into its new pane.
	 *
	 * Uses `layer.remove()`, not `this.removePolyline()`: that helper also
	 * splices the layer out of `this.polylines`, and `addTo()` doesn't push it
	 * back in, so a later `clearAllPolylines()` would leak this layer.
	 *
	 * The casing is left untouched in its own pane — only the colored line
	 * (and its arrows) move.
	 */
	setPolylineLayer(polyline, pane) {
		if (!this.map || !polyline) return;

		if (polyline._drawTimeoutId) {
			clearTimeout(polyline._drawTimeoutId);
			polyline._drawTimeoutId = null;
		}

		polyline.remove();
		polyline.options.pane = pane;
		polyline.addTo(this.map);

		if (polyline.arrowDecorator) {
			polyline.arrowDecorator.remove();

			const arrowColor = polylineArrowColor(polyline.options.color);
			polyline.arrowDecorator = this.L.polylineDecorator(polyline, {
				patterns: [
					{
						offset: 0,
						repeat: 125,
						symbol: this.L.Symbol.arrowHead({
							pixelSize: 12,
							pathOptions: {
								color: arrowColor,
								fill: true,
								fillColor: arrowColor,
								fillOpacity: 0.85,
								pane
							}
						})
					}
				]
			}).addTo(this.map);
		}
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

		if (polyline._casing) {
			polyline._casing.remove();
			polyline._casing = null;
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
				if (polyline._casing) {
					polyline._casing.remove();
					polyline._casing = null;
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

		let center = [lat, lng];
		// `offsetY` (fraction of the viewport height) pushes the map center south
		// of the target so the marker settles that far above true center — used to
		// clear the mobile bottom sheet. Project at the destination zoom, nudge the
		// center point down, then unproject back to a latlng.
		if (options.offsetY) {
			const point = this.map.project([lat, lng], zoom);
			point.y += this.map.getSize().y * options.offsetY;
			center = this.map.unproject(point, zoom);
		}

		// Pass `{ animate: false }` to reposition instantly. An animated zoom
		// desyncs the MapLibre GL basemap from SVG overlays (e.g. a displayed
		// route), making the route flicker/float until the move settles.
		this.map.flyTo(center, zoom, { animate: options.animate ?? true });
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
			[polyline, polyline._casing, polyline.arrowDecorator].forEach((layer) => {
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
	 * Reveals polylines with a "draw from start to end" animation using the SVG
	 * stroke-dashoffset technique, without touching the camera. The direction-arrow
	 * decorators are added once the line has finished drawing.
	 *
	 * @param {{ only?: Array | null, duration?: number }} [options] `only` limits
	 *   the animation to specific polylines — used by the stop-selection layer,
	 *   whose routes resolve one at a time and must not re-animate their
	 *   neighbors. The sentinel is *absence*, not emptiness: omit `only` (or pass
	 *   `null`/`undefined`) to reveal every tracked polyline, but an explicit
	 *   array — including an empty one — is taken literally, so `only: []`
	 *   animates nothing.
	 */
	revealPolylines({ only = null, duration = 1.2 } = {}) {
		const targets = only ?? this.polylines;

		targets.forEach((polyline) => {
			if (!polyline) return;
			// The casing is a second, wider stroke drawn underneath. It is deliberately
			// absent from this.polylines (like arrowDecorator) so it can't double-count
			// in fitToPolylines/_getRoutePaths, so reveal it explicitly here.
			[polyline._casing, polyline].forEach((layer) => {
				if (!layer) return;
				if (!this.map.hasLayer(layer)) layer.addTo(this.map);
			});

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

			[polyline._casing, polyline].forEach((layer) => {
				const layerPath = layer?._path;
				if (!layerPath || typeof layerPath.getTotalLength !== 'function') return;
				const length = layerPath.getTotalLength();
				layerPath.style.transition = 'none';
				layerPath.style.strokeDasharray = `${length} ${length}`;
				layerPath.style.strokeDashoffset = `${length}`;
				// Force a reflow so the starting offset is applied before transitioning.
				layerPath.getBoundingClientRect();
				layerPath.style.transition = `stroke-dashoffset ${duration}s ease-in-out`;
				layerPath.style.strokeDashoffset = '0';
			});

			// Clear any prior pending reveal for this polyline before scheduling a
			// new one — otherwise a second call within `duration` overwrites the
			// stored id, orphaning the first timer so it later fires against a
			// removed or reused DOM node (removePolyline/clearAllPolylines only
			// ever clear the single stored id).
			if (polyline._drawTimeoutId) {
				clearTimeout(polyline._drawTimeoutId);
				polyline._drawTimeoutId = null;
			}

			polyline._drawTimeoutId = setTimeout(() => {
				polyline._drawTimeoutId = null;
				// Bail if the polyline was cleared mid-draw (e.g. rapid route switch).
				if (!this.map.hasLayer(polyline)) return;
				// Clear the inline styles so the original stroke (e.g. the dashed
				// pattern used for walking legs) is restored once drawing is done.
				[polyline._casing, polyline].forEach((layer) => {
					const layerPath = layer?._path;
					if (!layerPath) return;
					layerPath.style.transition = '';
					layerPath.style.strokeDasharray = '';
					layerPath.style.strokeDashoffset = '';
				});
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
				this.revealPolylines({ duration: options.drawDuration ?? 1.2 });
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
