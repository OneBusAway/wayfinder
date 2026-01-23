import { browser } from '$app/environment';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import { RouteType, routePriorities, prioritizedRouteTypeForDisplay } from '$config/routeConfig';
import './../../assets/styles/arcgis-map.css';
import PolylineUtil from 'polyline-encoded';
import { COLORS } from '$lib/colors';
import PopupContent from '$components/map/PopupContent.svelte';
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import TripPlanPinMarker from '$components/trip-planner/tripPlanPinMarker.svelte';
import { mount, unmount } from 'svelte';

export default class ArcGISMapProvider {
	constructor(handleStopMarkerSelect) {
		this.handleStopMarkerSelect = handleStopMarkerSelect;
		this.map = null;
		this.view = null;
		this.stopsLayer = null;
		this.vehiclesLayer = null;
		this.polylinesLayer = null;
		this.overlaysLayer = null;
		this.globalInfoWindow = null;
		this.popupContentComponent = null;
		this.stopsMap = new Map();
		this.stopMarkers = [];
		this.vehicleMarkers = [];
		this.markersMap = new Map();
		this.overlayElements = new Map(); // Track DOM elements for custom overlays
		this.overlayContainer = null; // Container for DOM-based markers
		this.polylines = [];
		this.showStopsRoutesAtZoom = 16;
		this.routeLabelsVisible = false;
		this.currentTheme = 'light';
		this.extentWatcher = null;
		this.animationFrameId = null;
		this.isAnimating = false;
	}

	async initMap(element, options) {
		if (!browser) return;

		// Dynamically import ArcGIS modules
		const [
			{ default: Map },
			{ default: MapView },
			{ default: GraphicsLayer },
			{ default: Point },
			reactiveUtilsModule
		] = await Promise.all([
			import('@arcgis/core/Map.js'),
			import('@arcgis/core/views/MapView.js'),
			import('@arcgis/core/layers/GraphicsLayer.js'),
			import('@arcgis/core/geometry/Point.js'),
			import('@arcgis/core/core/reactiveUtils.js')
		]);

		this.reactiveUtils = reactiveUtilsModule;
		this.Point = Point;

		// Create graphics layers for different marker types
		this.stopsLayer = new GraphicsLayer({ id: 'stops' });
		this.vehiclesLayer = new GraphicsLayer({ id: 'vehicles' });
		this.polylinesLayer = new GraphicsLayer({ id: 'polylines' });
		this.overlaysLayer = new GraphicsLayer({ id: 'overlays' });

		// Use free basemaps that don't require API key
		this.map = new Map({
			basemap: 'streets-vector',
			layers: [this.polylinesLayer, this.stopsLayer, this.vehiclesLayer, this.overlaysLayer]
		});

		this.view = new MapView({
			container: element,
			map: this.map,
			center: [options.lng, options.lat], // ArcGIS uses [longitude, latitude]
			zoom: 14,
			ui: {
				components: ['zoom', 'attribution']
			},
			popup: {
				dockEnabled: false,
				dockOptions: {
					buttonEnabled: false
				}
			}
		});

		// Position zoom controls to bottom-right
		this.view.ui.move('zoom', 'bottom-right');

		// Wait for view to be ready
		await this.view.when();

		// Create overlay container for DOM-based markers
		this.overlayContainer = document.createElement('div');
		this.overlayContainer.className = 'arcgis-overlay-container';
		this.overlayContainer.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			overflow: hidden;
			z-index: 50;
		`;
		this.view.container.appendChild(this.overlayContainer);

		// Set up zoom watcher for route label visibility
		this.extentWatcher = this.reactiveUtils.watch(
			() => this.view.zoom,
			() => {
				this.updateMarkersRouteLabelVisibility();
			}
		);

		// Watch for animation state to trigger continuous position updates
		this.reactiveUtils.watch(
			() => this.view.animation,
			(animation) => {
				if (animation) {
					this.startAnimationLoop();
				} else {
					this.stopAnimationLoop();
					this.updateOverlayPositions();
				}
			}
		);

		// Watch for interacting state (user dragging/zooming)
		this.reactiveUtils.watch(
			() => this.view.interacting,
			(interacting) => {
				if (interacting) {
					this.startAnimationLoop();
				} else {
					this.stopAnimationLoop();
					this.updateOverlayPositions();
				}
			}
		);

		// Initial position update when view is ready
		this.updateOverlayPositions();
	}

	startAnimationLoop() {
		if (this.isAnimating) return;
		this.isAnimating = true;
		const animate = () => {
			if (!this.isAnimating) return;
			this.updateOverlayPositions();
			this.animationFrameId = requestAnimationFrame(animate);
		};
		animate();
	}

	stopAnimationLoop() {
		this.isAnimating = false;
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	eventListeners(mapInstance, debouncedLoadMarkers) {
		if (!browser || !this.view) return;

		// Use stationary watcher to detect when map movement stops
		this.reactiveUtils.watch(
			() => this.view.stationary,
			(stationary) => {
				if (stationary) {
					debouncedLoadMarkers();
				}
			}
		);
	}

	addMarker(options) {
		if (!browser || !this.view || !this.overlayContainer) return null;

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

		// Create DOM container for the Svelte component
		const container = document.createElement('div');
		container.className = 'arcgis-stop-marker-overlay';
		container.style.cssText = `
			position: absolute;
			pointer-events: auto;
			transform: translate(-50%, -50%);
		`;

		const props = $state({
			stop: options.stop,
			icon: icon,
			onClick: options.onClick,
			isHighlighted: options.isHighlighted ?? false,
			showRoutesLabel: this.view.zoom >= this.showStopsRoutesAtZoom
		});

		mount(StopMarker, {
			target: container,
			props
		});

		// Append to overlay container (not view.container directly)
		this.overlayContainer.appendChild(container);

		// Create marker object to track
		const marker = {
			id: options.stop.id,
			position: { lat: options.position.lat, lng: options.position.lng },
			container,
			props,
			type: 'stop'
		};

		// Store in overlay elements for position updates
		this.overlayElements.set(options.stop.id, marker);
		this.markersMap.set(options.stop.id, marker);

		// Calculate initial screen position
		this.updateSingleMarkerPosition(marker);

		return marker;
	}

	updateSingleMarkerPosition(marker) {
		if (!this.view || !marker.container || !marker.position || !this.Point) return;

		try {
			// Create a Point with WGS84 spatial reference - ArcGIS will project it automatically
			const point = new this.Point({
				longitude: marker.position.lng,
				latitude: marker.position.lat
			});

			const screenPoint = this.view.toScreen(point);

			if (screenPoint && !isNaN(screenPoint.x) && !isNaN(screenPoint.y)) {
				marker.container.style.left = `${screenPoint.x}px`;
				marker.container.style.top = `${screenPoint.y}px`;
				marker.container.style.display = 'block';
			} else {
				marker.container.style.display = 'none';
			}
		} catch (err) {
			console.error('Error in updateSingleMarkerPosition:', err);
		}
	}

	updateOverlayPositions() {
		if (!browser || !this.view || !this.Point) return;

		for (const marker of this.overlayElements.values()) {
			if (!marker.container || !marker.position) continue;

			try {
				const point = new this.Point({
					longitude: marker.position.lng,
					latitude: marker.position.lat
				});

				const screenPoint = this.view.toScreen(point);

				if (screenPoint && !isNaN(screenPoint.x) && !isNaN(screenPoint.y)) {
					marker.container.style.left = `${screenPoint.x}px`;
					marker.container.style.top = `${screenPoint.y}px`;
					marker.container.style.display = 'block';
				} else {
					marker.container.style.display = 'none';
				}
			} catch {
				marker.container.style.display = 'none';
			}
		}
	}

	updateMarkersRouteLabelVisibility() {
		if (!this.view) return;

		const shouldShow = this.view.zoom >= this.showStopsRoutesAtZoom;

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
		if (!browser || !this.view || !this.overlayContainer) return null;

		const container = document.createElement('div');
		container.className = 'arcgis-pin-marker-overlay';
		container.style.cssText = `
			position: absolute;
			pointer-events: auto;
			transform: translate(-50%, -100%);
		`;

		mount(TripPlanPinMarker, {
			target: container,
			props: {
				text: text
			}
		});

		this.overlayContainer.appendChild(container);

		const marker = {
			id: `pin-${Date.now()}`,
			position: { lat: position.lat, lng: position.lng },
			container,
			type: 'pin'
		};

		this.overlayElements.set(marker.id, marker);

		// Set initial position
		this.updateSingleMarkerPosition(marker);

		return marker;
	}

	removePinMarker(marker) {
		if (!marker) return;

		if (marker.container) {
			marker.container.remove();
		}

		if (marker.id) {
			this.overlayElements.delete(marker.id);
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

	async addStopRouteMarker(stop, stopTime = null) {
		if (!browser || !this.view) return;

		const [{ default: Graphic }, { default: Point }, { default: SimpleMarkerSymbol }] =
			await Promise.all([
				import('@arcgis/core/Graphic.js'),
				import('@arcgis/core/geometry/Point.js'),
				import('@arcgis/core/symbols/SimpleMarkerSymbol.js')
			]);

		const point = new Point({
			longitude: stop.lon,
			latitude: stop.lat
		});

		const symbol = new SimpleMarkerSymbol({
			style: 'circle',
			color: [255, 255, 255, 1],
			size: 15,
			outline: {
				color: [0, 0, 0, 1],
				width: 1
			}
		});

		const graphic = new Graphic({
			geometry: point,
			symbol: symbol,
			attributes: {
				stopId: stop.id,
				stopName: stop.name,
				stopTime: stopTime
			}
		});

		this.stopsLayer.add(graphic);
		this.stopsMap.set(stop.id, stop);

		// Add click handler
		this.view.on('click', (event) => {
			this.view.hitTest(event).then((response) => {
				const graphicHit = response.results.find(
					(result) =>
						result.graphic.attributes?.stopId === stop.id && result.layer === this.stopsLayer
				);
				if (graphicHit) {
					this.openStopMarker(stop, stopTime);
				}
			});
		});

		this.stopMarkers.push(graphic);
	}

	openStopMarker(stop, stopTime = null) {
		if (!browser || !this.view) return;

		// Close existing popup
		this.view.popup.close();

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

		this.view.openPopup({
			location: {
				longitude: stop.lon,
				latitude: stop.lat
			},
			content: popupContainer
		});

		this.globalInfoWindow = this.view.popup;
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

			this.view.popup.content = popupContainer;
		}
	}

	removeStopMarkers() {
		if (!browser || !this.stopsLayer) return;

		this.stopMarkers.forEach((graphic) => {
			this.stopsLayer.remove(graphic);
		});
		this.stopMarkers = [];
	}

	cleanupInfoWindow() {
		if (this.view && this.view.popup) {
			this.view.popup.close();
		}
	}

	removeStopMarker(marker) {
		if (!browser || !this.stopsLayer) return;
		this.stopsLayer.remove(marker);
	}

	async addVehicleMarker(vehicle, activeTrip) {
		if (!browser || !this.view) return null;

		const [{ default: Graphic }, { default: Point }, { default: PictureMarkerSymbol }] =
			await Promise.all([
				import('@arcgis/core/Graphic.js'),
				import('@arcgis/core/geometry/Point.js'),
				import('@arcgis/core/symbols/PictureMarkerSymbol.js')
			]);

		let color;
		if (!vehicle.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const busIconSvg = createVehicleIconSvg(vehicle?.orientation, color);

		const point = new Point({
			longitude: vehicle.position.lon,
			latitude: vehicle.position.lat
		});

		const symbol = new PictureMarkerSymbol({
			url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(busIconSvg)}`,
			width: '45px',
			height: '45px'
		});

		const graphic = new Graphic({
			geometry: point,
			symbol: symbol,
			attributes: {
				vehicleId: vehicle.vehicleId,
				nextDestination: activeTrip.tripHeadsign,
				lastUpdateTime: vehicle.lastUpdateTime,
				nextStopName: this.stopsMap.get(vehicle.nextStop)?.name,
				predicted: vehicle.predicted
			}
		});

		this.vehiclesLayer.add(graphic);
		this.vehicleMarkers.push(graphic);

		// Set up click handler for vehicle popup
		this.view.on('click', (event) => {
			this.view.hitTest(event).then((response) => {
				const graphicHit = response.results.find(
					(result) =>
						result.graphic.attributes?.vehicleId === vehicle.vehicleId &&
						result.layer === this.vehiclesLayer
				);
				if (graphicHit) {
					this.showVehiclePopup(graphic);
				}
			});
		});

		return graphic;
	}

	async showVehiclePopup(graphic) {
		if (!browser || !this.view) return;

		const popupContainer = document.createElement('div');

		mount(VehiclePopupContent, {
			target: popupContainer,
			props: {
				nextDestination: graphic.attributes.nextDestination,
				vehicleId: graphic.attributes.vehicleId,
				lastUpdateTime: graphic.attributes.lastUpdateTime,
				nextStopName: graphic.attributes.nextStopName,
				predicted: graphic.attributes.predicted
			}
		});

		this.view.openPopup({
			location: graphic.geometry,
			content: popupContainer
		});
	}

	async updateVehicleMarker(marker, vehicleStatus, activeTrip) {
		if (!browser || !this.view || !marker) return;

		const [{ default: Point }, { default: PictureMarkerSymbol }] = await Promise.all([
			import('@arcgis/core/geometry/Point.js'),
			import('@arcgis/core/symbols/PictureMarkerSymbol.js')
		]);

		let color;
		if (!vehicleStatus.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const updatedIconSvg = createVehicleIconSvg(vehicleStatus.orientation, color);

		const newPoint = new Point({
			longitude: vehicleStatus.position.lon,
			latitude: vehicleStatus.position.lat
		});

		const newSymbol = new PictureMarkerSymbol({
			url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(updatedIconSvg)}`,
			width: '45px',
			height: '45px'
		});

		marker.geometry = newPoint;
		marker.symbol = newSymbol;
		marker.attributes = {
			...marker.attributes,
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicleStatus.vehicleId,
			lastUpdateTime: vehicleStatus.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicleStatus.nextStop)?.name || 'N/A',
			predicted: vehicleStatus.predicted
		};
	}

	removeVehicleMarker(marker) {
		if (!browser || !this.vehiclesLayer || !marker) return;
		this.vehiclesLayer.remove(marker);
	}

	clearVehicleMarkers() {
		if (!browser || !this.vehiclesLayer) return;

		this.vehicleMarkers.forEach((graphic) => {
			this.vehiclesLayer.remove(graphic);
		});
		this.vehicleMarkers = [];
	}

	addListener(event, callback) {
		if (!browser || !this.view) return;

		// Map Leaflet/Google event names to ArcGIS equivalents
		const eventMapping = {
			click: 'click',
			dragend: 'drag',
			zoomend: 'zoom',
			moveend: 'extent'
		};

		const arcgisEvent = eventMapping[event] || event;

		if (arcgisEvent === 'extent' || arcgisEvent === 'zoom') {
			this.reactiveUtils.watch(
				() => this.view[arcgisEvent === 'zoom' ? 'zoom' : 'extent'],
				() => callback()
			);
		} else {
			this.view.on(arcgisEvent, callback);
		}
	}

	async addUserLocationMarker(latLng) {
		if (!browser || !this.view) return;

		const [{ default: Graphic }, { default: Point }, { default: SimpleMarkerSymbol }] =
			await Promise.all([
				import('@arcgis/core/Graphic.js'),
				import('@arcgis/core/geometry/Point.js'),
				import('@arcgis/core/symbols/SimpleMarkerSymbol.js')
			]);

		const point = new Point({
			longitude: latLng.lng,
			latitude: latLng.lat
		});

		const symbol = new SimpleMarkerSymbol({
			style: 'circle',
			color: [0, 123, 255, 1], // #007BFF
			size: 16,
			outline: {
				color: [255, 255, 255, 1],
				width: 2
			}
		});

		const graphic = new Graphic({
			geometry: point,
			symbol: symbol
		});

		this.overlaysLayer.add(graphic);
	}

	setCenter(latLng) {
		if (!browser || !this.view) return;
		this.view.center = [latLng.lng, latLng.lat];
	}

	getCenter() {
		if (!browser || !this.view) return { lat: 0, lng: 0 };
		return {
			lat: this.view.center.latitude,
			lng: this.view.center.longitude
		};
	}

	removeMarker(marker) {
		if (!browser || !marker) return;

		// Remove from DOM if it's an overlay marker
		if (marker.container) {
			marker.container.remove();
		}

		// Remove from tracking maps
		if (marker.id) {
			this.overlayElements.delete(marker.id);
			this.markersMap.delete(marker.id);
		}
	}

	clearAllStopMarkers() {
		if (!browser) return;

		// Clear overlay-based markers
		for (const marker of this.markersMap.values()) {
			if (marker.container) {
				marker.container.remove();
			}
		}
		this.markersMap.clear();

		// Clear stop markers from overlay elements tracking
		for (const [id, marker] of this.overlayElements.entries()) {
			if (marker.type === 'stop') {
				this.overlayElements.delete(id);
			}
		}
	}

	hasMarker(stopId) {
		return this.markersMap.has(stopId);
	}

	getMarker(stopId) {
		return this.markersMap.get(stopId);
	}

	async setTheme(theme) {
		if (!browser || !this.map) return;

		this.currentTheme = theme;

		// Switch basemap based on theme
		if (theme === 'dark') {
			this.map.basemap = 'dark-gray-vector';
		} else {
			this.map.basemap = 'streets-vector';
		}
	}

	async createPolyline(points, options = { withArrow: true }) {
		if (!browser || !this.view) return null;

		const [{ default: Graphic }, { default: Polyline }, { default: SimpleLineSymbol }] =
			await Promise.all([
				import('@arcgis/core/Graphic.js'),
				import('@arcgis/core/geometry/Polyline.js'),
				import('@arcgis/core/symbols/SimpleLineSymbol.js')
			]);

		const decodedPolyline = PolylineUtil.decode(points);
		if (!decodedPolyline || decodedPolyline.length === 0) {
			console.error('Failed to decode polyline:', points);
			return null;
		}

		// Convert to ArcGIS format [longitude, latitude]
		const paths = decodedPolyline.map((coord) => [coord[1], coord[0]]);

		const polyline = new Polyline({
			paths: [paths]
		});

		const symbol = new SimpleLineSymbol({
			color: options.color || COLORS.POLYLINE,
			width: options.weight || 4,
			style: 'solid'
		});

		const graphic = new Graphic({
			geometry: polyline,
			symbol: symbol
		});

		this.polylinesLayer.add(graphic);
		this.polylines.push(graphic);

		// Add directional arrows if requested
		if (options.withArrow) {
			await this.addArrowsToPolyline(graphic, paths);
		}

		return graphic;
	}

	async addArrowsToPolyline(polylineGraphic, paths) {
		if (!browser || !this.view || paths.length < 2) return;

		const [{ default: Graphic }, { default: Point }, { default: SimpleMarkerSymbol }] =
			await Promise.all([
				import('@arcgis/core/Graphic.js'),
				import('@arcgis/core/geometry/Point.js'),
				import('@arcgis/core/symbols/SimpleMarkerSymbol.js')
			]);

		const arrowGraphics = [];
		const arrowInterval = 125; // pixels between arrows (approximate)
		let accumulatedDistance = 0;

		for (let i = 1; i < paths.length; i++) {
			const [lng1, lat1] = paths[i - 1];
			const [lng2, lat2] = paths[i];

			// Calculate segment distance (rough approximation in pixels at current zoom)
			const segmentDistance =
				Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2)) * 111000; // rough meters

			accumulatedDistance += segmentDistance;

			if (accumulatedDistance >= arrowInterval) {
				// Calculate angle for arrow rotation
				const angle = (Math.atan2(lat2 - lat1, lng2 - lng1) * 180) / Math.PI;

				const point = new Point({
					longitude: (lng1 + lng2) / 2,
					latitude: (lat1 + lat2) / 2
				});

				const arrowSymbol = new SimpleMarkerSymbol({
					style: 'triangle',
					color: COLORS.POLYLINE_ARROW_FILL,
					size: 12,
					angle: -angle + 90, // Adjust for ArcGIS rotation
					outline: {
						color: COLORS.POLYLINE_ARROW_STROKE,
						width: 1
					}
				});

				const arrowGraphic = new Graphic({
					geometry: point,
					symbol: arrowSymbol
				});

				this.polylinesLayer.add(arrowGraphic);
				arrowGraphics.push(arrowGraphic);

				accumulatedDistance = 0;
			}
		}

		// Store arrow graphics with the polyline for cleanup
		polylineGraphic.arrowGraphics = arrowGraphics;
	}

	removePolyline(polyline) {
		if (!browser || !this.polylinesLayer || !polyline) return;

		// Remove arrow graphics first
		if (polyline.arrowGraphics) {
			polyline.arrowGraphics.forEach((arrow) => {
				this.polylinesLayer.remove(arrow);
			});
			polyline.arrowGraphics = null;
		}

		this.polylinesLayer.remove(polyline);

		const index = this.polylines.indexOf(polyline);
		if (index > -1) {
			this.polylines.splice(index, 1);
		}
	}

	clearAllPolylines() {
		if (!browser || !this.polylinesLayer) return;

		this.polylines.forEach((polyline) => {
			if (polyline) {
				// Remove arrow graphics
				if (polyline.arrowGraphics) {
					polyline.arrowGraphics.forEach((arrow) => {
						this.polylinesLayer.remove(arrow);
					});
					polyline.arrowGraphics = null;
				}
				this.polylinesLayer.remove(polyline);
			}
		});

		this.polylines = [];
	}

	getPolylinesCount() {
		return this.polylines.length;
	}

	panTo(lat, lng) {
		if (!browser || !this.view) return;
		this.view.goTo({
			center: [lng, lat]
		});
	}

	flyTo(lat, lng, zoom = 15) {
		if (!browser || !this.view) return;
		this.view.goTo(
			{
				center: [lng, lat],
				zoom: zoom
			},
			{
				duration: 1000,
				easing: 'ease-in-out'
			}
		);
	}

	setZoom(zoom) {
		if (!browser || !this.view) return;
		this.view.zoom = zoom;
	}

	getZoom() {
		return this.view.zoom;
	}

	getBoundingBox() {
		if (!browser || !this.view || !this.view.extent) {
			return { north: 0, east: 0, south: 0, west: 0 };
		}

		const extent = this.view.extent;
		return {
			north: extent.ymax,
			east: extent.xmax,
			south: extent.ymin,
			west: extent.xmin
		};
	}
}
