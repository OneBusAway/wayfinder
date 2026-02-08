import { browser } from '$app/environment';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import { RouteType, routePriorities, prioritizedRouteTypeForDisplay } from '$config/routeConfig';
import { COLORS } from '$lib/colors';
import PopupContent from '$components/map/PopupContent.svelte';
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import TripPlanPinMarker from '$components/trip-planner/tripPlanPinMarker.svelte';
import { mount, unmount } from 'svelte';

/**
 * ArcGIS Maps SDK provider for Wayfinder.
 * Implements the same interface as GoogleMapProvider and OpenStreetMapProvider.
 */
export default class ArcGISMapProvider {
	constructor(apiKey, handleStopMarkerSelect, customBasemapUrl = null) {
		this.apiKey = apiKey;
		this.customBasemapUrl = customBasemapUrl;
		this.handleStopMarkerSelect = handleStopMarkerSelect;
		this.view = null;
		this.map = null;
		this.graphicsLayer = null;
		this.polylineGraphicsLayer = null;
		this.markersMap = new Map();
		this.stopsMap = new Map();
		this.stopMarkers = [];
		this.vehicleMarkers = [];
		this.polylines = [];
		this.showStopsRoutesAtZoom = 16;
		this.routeLabelsVisible = false;
		this.globalPopup = null;
		this.popupContentComponent = null;

		// ArcGIS modules - loaded dynamically
		this.Graphic = null;
		this.Point = null;
		this.Polyline = null;
		this.SimpleMarkerSymbol = null;
		this.SimpleLineSymbol = null;
		this.PictureMarkerSymbol = null;
	}

	async initMap(element, options) {
		if (!browser) return;

		// Dynamic import of ArcGIS modules
		const [
			{ default: Map },
			{ default: MapView },
			{ default: GraphicsLayer },
			{ default: Basemap },
			{ default: VectorTileLayer },
			{ default: Graphic },
			{ default: Point },
			{ default: Polyline },
			{ default: SimpleMarkerSymbol },
			{ default: SimpleLineSymbol },
			{ default: PictureMarkerSymbol },
			esriConfig
		] = await Promise.all([
			import('@arcgis/core/Map'),
			import('@arcgis/core/views/MapView'),
			import('@arcgis/core/layers/GraphicsLayer'),
			import('@arcgis/core/Basemap'),
			import('@arcgis/core/layers/VectorTileLayer'),
			import('@arcgis/core/Graphic'),
			import('@arcgis/core/geometry/Point'),
			import('@arcgis/core/geometry/Polyline'),
			import('@arcgis/core/symbols/SimpleMarkerSymbol'),
			import('@arcgis/core/symbols/SimpleLineSymbol'),
			import('@arcgis/core/symbols/PictureMarkerSymbol'),
			import('@arcgis/core/config')
		]);

		// Store references for later use
		this.Graphic = Graphic;
		this.Point = Point;
		this.Polyline = Polyline;
		this.SimpleMarkerSymbol = SimpleMarkerSymbol;
		this.SimpleLineSymbol = SimpleLineSymbol;
		this.PictureMarkerSymbol = PictureMarkerSymbol;

		// Configure API key
		if (this.apiKey) {
			esriConfig.default.apiKey = this.apiKey;
		}

		// Create basemap
		let basemap;
		if (this.customBasemapUrl) {
			const customLayer = new VectorTileLayer({
				url: this.customBasemapUrl
			});
			basemap = new Basemap({
				baseLayers: [customLayer]
			});
		} else {
			basemap = 'streets-navigation-vector';
		}

		// Create graphics layers for markers and polylines
		this.polylineGraphicsLayer = new GraphicsLayer({
			title: 'Polylines'
		});
		this.graphicsLayer = new GraphicsLayer({
			title: 'Markers'
		});

		this.map = new Map({
			basemap: basemap,
			layers: [this.polylineGraphicsLayer, this.graphicsLayer]
		});

		this.view = new MapView({
			container: element,
			map: this.map,
			center: [options.lng, options.lat],
			zoom: 14,
			ui: {
				components: ['zoom']
			},
			constraints: {
				rotationEnabled: false
			}
		});

		// Wait for view to be ready
		await this.view.when();

		// Set up zoom listener for route labels
		this.view.watch('zoom', () => {
			this.updateMarkersRouteLabelVisibility();
		});

		return this.view;
	}

	eventListeners(mapInstance, debouncedLoadMarkers) {
		if (!this.view) return;
		this.view.watch('extent', debouncedLoadMarkers);
	}

	addMarker(options) {
		if (!browser || !this.view) return null;

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

		// Create DOM container for Svelte component
		const container = document.createElement('div');
		container.style.position = 'absolute';
		container.style.pointerEvents = 'auto';

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

		// Create a point geometry
		const point = new this.Point({
			longitude: options.position.lng,
			latitude: options.position.lat
		});

		// For custom HTML markers, we need to use the view's UI or a custom approach
		// ArcGIS doesn't have native HTML marker support like Leaflet
		// We'll position the container manually using screen coordinates
		const marker = {
			element: container,
			point: point,
			props: props,
			stopId: options.stop.id
		};

		// Add to overlay container
		this._positionHTMLMarker(marker);

		// Store reference
		this.markersMap.set(options.stop.id, marker);

		return marker;
	}

	_positionHTMLMarker(marker) {
		if (!this.view || !marker.element) return;

		// Get the overlay container or create one
		let overlayContainer = this.view.container.querySelector('.arcgis-marker-overlay');
		if (!overlayContainer) {
			overlayContainer = document.createElement('div');
			overlayContainer.className = 'arcgis-marker-overlay';
			overlayContainer.style.cssText =
				'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden;';
			this.view.container.appendChild(overlayContainer);

			// Update marker positions on view change
			this.view.watch('extent', () => this._updateAllMarkerPositions());
			this.view.watch('zoom', () => this._updateAllMarkerPositions());
		}

		overlayContainer.appendChild(marker.element);
		this._updateMarkerPosition(marker);
	}

	_updateMarkerPosition(marker) {
		if (!this.view || !marker.element || !marker.point) return;

		const screenPoint = this.view.toScreen(marker.point);
		if (screenPoint) {
			marker.element.style.left = `${screenPoint.x - 20}px`;
			marker.element.style.top = `${screenPoint.y - 20}px`;
			marker.element.style.position = 'absolute';
			marker.element.style.zIndex = '1000';
			marker.element.style.pointerEvents = 'auto';
		}
	}

	_updateAllMarkerPositions() {
		for (const marker of this.markersMap.values()) {
			this._updateMarkerPosition(marker);
		}
		// Update stop route markers too
		for (const marker of this.stopMarkers) {
			if (marker.htmlMarker) {
				this._updateMarkerPosition(marker.htmlMarker);
			}
		}
		// Update vehicle markers
		for (const marker of this.vehicleMarkers) {
			if (marker.htmlMarker) {
				this._updateMarkerPosition(marker.htmlMarker);
			}
		}
	}

	removeMarker(marker) {
		if (!marker) return;

		if (marker.element && marker.element.parentNode) {
			marker.element.parentNode.removeChild(marker.element);
		}

		if (marker.graphic && this.graphicsLayer) {
			this.graphicsLayer.remove(marker.graphic);
		}

		for (const [stopId, storedMarker] of this.markersMap.entries()) {
			if (storedMarker === marker) {
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
		if (!this.view) return;

		for (const marker of this.markersMap.values()) {
			if (marker.element && marker.element.parentNode) {
				marker.element.parentNode.removeChild(marker.element);
			}
			if (marker.graphic && this.graphicsLayer) {
				this.graphicsLayer.remove(marker.graphic);
			}
		}
		this.markersMap.clear();
	}

	updateMarkersRouteLabelVisibility() {
		if (!this.view) return;

		const shouldShow = this.view.zoom >= this.showStopsRoutesAtZoom;

		if (this.routeLabelsVisible === shouldShow) return;

		this.routeLabelsVisible = shouldShow;

		for (const marker of this.markersMap.values()) {
			if (marker?.props) {
				marker.props.showRoutesLabel = shouldShow;
			}
		}
	}

	addStopRouteMarker(stop, stopTime = null) {
		if (!this.view || !this.graphicsLayer) return;

		const point = new this.Point({
			longitude: stop.lon,
			latitude: stop.lat
		});

		const symbol = new this.SimpleMarkerSymbol({
			style: 'circle',
			color: [255, 255, 255, 1],
			size: 10,
			outline: {
				color: [0, 0, 0, 1],
				width: 1
			}
		});

		const graphic = new this.Graphic({
			geometry: point,
			symbol: symbol,
			attributes: {
				stopId: stop.id,
				stopTime: stopTime
			}
		});

		this.graphicsLayer.add(graphic);
		this.stopsMap.set(stop.id, stop);

		const markerObj = { graphic, stop, stopTime };
		this.stopMarkers.push(markerObj);

		// Add click handler via view
		this.view.on('click', (event) => {
			this.view.hitTest(event).then((response) => {
				const hit = response.results.find((r) => r.graphic === graphic);
				if (hit) {
					this.openStopMarker(stop, stopTime);
				}
			});
		});
	}

	openStopMarker(stop, stopTime = null) {
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

		this.view.popup.open({
			title: stop.name,
			content: popupContainer,
			location: {
				longitude: stop.lon,
				latitude: stop.lat
			}
		});
	}

	updatePopupContent(stop, arrivalTime = null) {
		if (this.popupContentComponent && this.view.popup.visible) {
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

	highlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (!marker) return;

		if (marker.props) {
			marker.props.isHighlighted = true;
		}
	}

	unHighlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (!marker) return;

		if (marker.props) {
			marker.props.isHighlighted = false;
		}
	}

	removeStopMarkers() {
		if (!this.graphicsLayer) return;

		for (const markerObj of this.stopMarkers) {
			if (markerObj.graphic) {
				this.graphicsLayer.remove(markerObj.graphic);
			}
		}
		this.stopMarkers = [];
	}

	addPinMarker(position, text) {
		if (!this.view) return null;

		const container = document.createElement('div');
		container.style.position = 'absolute';
		container.style.pointerEvents = 'auto';

		mount(TripPlanPinMarker, {
			target: container,
			props: {
				text: text
			}
		});

		const point = new this.Point({
			longitude: position.lng,
			latitude: position.lat
		});

		const marker = {
			element: container,
			point: point,
			type: 'pin'
		};

		// Get overlay container
		let overlayContainer = this.view.container.querySelector('.arcgis-marker-overlay');
		if (!overlayContainer) {
			overlayContainer = document.createElement('div');
			overlayContainer.className = 'arcgis-marker-overlay';
			overlayContainer.style.cssText =
				'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden;';
			this.view.container.appendChild(overlayContainer);
		}

		overlayContainer.appendChild(container);

		const screenPoint = this.view.toScreen(point);
		if (screenPoint) {
			container.style.left = `${screenPoint.x - 16}px`;
			container.style.top = `${screenPoint.y - 50}px`;
			container.style.zIndex = '1000';
		}

		return marker;
	}

	removePinMarker(marker) {
		if (!marker) return;

		if (marker.element && marker.element.parentNode) {
			marker.element.parentNode.removeChild(marker.element);
		}
	}

	addVehicleMarker(vehicle, activeTrip) {
		if (!this.view) return null;

		let color;
		if (!vehicle.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const busIconSvg = createVehicleIconSvg(vehicle?.orientation, color);

		const container = document.createElement('div');
		container.innerHTML = `<img src="data:image/svg+xml;charset=UTF-8,${encodeURIComponent(busIconSvg)}" style="width:45px;height:45px;" />`;
		container.style.position = 'absolute';
		container.style.pointerEvents = 'auto';
		container.style.cursor = 'pointer';

		const point = new this.Point({
			longitude: vehicle.position.lon,
			latitude: vehicle.position.lat
		});

		const vehicleData = {
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicle.vehicleId,
			lastUpdateTime: vehicle.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicle.nextStop)?.name,
			predicted: vehicle.predicted
		};

		const marker = {
			element: container,
			point: point,
			vehicleData: vehicleData,
			type: 'vehicle'
		};

		// Add click handler for popup
		container.addEventListener('click', () => {
			const popupContainer = document.createElement('div');
			mount(VehiclePopupContent, {
				target: popupContainer,
				props: vehicleData
			});

			this.view.popup.open({
				title: `Vehicle ${vehicle.vehicleId}`,
				content: popupContainer,
				location: point
			});
		});

		// Add to overlay
		let overlayContainer = this.view.container.querySelector('.arcgis-marker-overlay');
		if (!overlayContainer) {
			overlayContainer = document.createElement('div');
			overlayContainer.className = 'arcgis-marker-overlay';
			overlayContainer.style.cssText =
				'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden;';
			this.view.container.appendChild(overlayContainer);
		}

		overlayContainer.appendChild(container);

		const screenPoint = this.view.toScreen(point);
		if (screenPoint) {
			container.style.left = `${screenPoint.x - 22}px`;
			container.style.top = `${screenPoint.y - 22}px`;
			container.style.zIndex = '1001';
		}

		marker.htmlMarker = marker;
		this.vehicleMarkers.push(marker);

		return marker;
	}

	updateVehicleMarker(marker, vehicleStatus, activeTrip) {
		if (!this.view || !marker) return;

		let color;
		if (!vehicleStatus.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const updatedIconSvg = createVehicleIconSvg(vehicleStatus.orientation, color);

		marker.element.innerHTML = `<img src="data:image/svg+xml;charset=UTF-8,${encodeURIComponent(updatedIconSvg)}" style="width:45px;height:45px;" />`;

		marker.point = new this.Point({
			longitude: vehicleStatus.position.lon,
			latitude: vehicleStatus.position.lat
		});

		marker.vehicleData = {
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicleStatus.vehicleId,
			lastUpdateTime: vehicleStatus.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicleStatus.nextStop)?.name || 'N/A',
			predicted: vehicleStatus.predicted
		};

		// Update position
		const screenPoint = this.view.toScreen(marker.point);
		if (screenPoint) {
			marker.element.style.left = `${screenPoint.x - 22}px`;
			marker.element.style.top = `${screenPoint.y - 22}px`;
		}
	}

	removeVehicleMarker(marker) {
		if (!marker) return;

		if (marker.element && marker.element.parentNode) {
			marker.element.parentNode.removeChild(marker.element);
		}

		const index = this.vehicleMarkers.indexOf(marker);
		if (index > -1) {
			this.vehicleMarkers.splice(index, 1);
		}
	}

	clearVehicleMarkers() {
		for (const marker of this.vehicleMarkers) {
			if (marker.element && marker.element.parentNode) {
				marker.element.parentNode.removeChild(marker.element);
			}
		}
		this.vehicleMarkers = [];
	}

	addListener(event, callback) {
		if (!this.view) return;

		// Map common event names to ArcGIS equivalents
		const eventMap = {
			dragend: 'drag',
			zoomend: 'zoom',
			moveend: 'extent'
		};

		const arcgisEvent = eventMap[event] || event;
		this.view.watch(arcgisEvent, callback);
	}

	addUserLocationMarker(latLng) {
		if (!this.view || !this.graphicsLayer) return;

		const point = new this.Point({
			longitude: latLng.lng,
			latitude: latLng.lat
		});

		const symbol = new this.SimpleMarkerSymbol({
			style: 'circle',
			color: [0, 123, 255, 1],
			size: 16,
			outline: {
				color: [255, 255, 255, 1],
				width: 2
			}
		});

		const graphic = new this.Graphic({
			geometry: point,
			symbol: symbol
		});

		this.graphicsLayer.add(graphic);
	}

	setCenter(latLng) {
		if (!this.view) return;
		this.view.center = [latLng.lng, latLng.lat];
	}

	getCenter() {
		if (!this.view) return { lat: 0, lng: 0 };
		return {
			lat: this.view.center.latitude,
			lng: this.view.center.longitude
		};
	}

	setTheme(theme) {
		if (!this.view || !this.map) return;

		// Switch basemap based on theme
		if (theme === 'dark') {
			this.map.basemap = 'dark-gray-vector';
		} else {
			if (this.customBasemapUrl) {
				// Reload custom basemap - would need to recreate
				// For now, use default light basemap
				this.map.basemap = 'streets-navigation-vector';
			} else {
				this.map.basemap = 'streets-navigation-vector';
			}
		}
	}

	async createPolyline(encodedShape, options = { withArrow: true }) {
		if (!this.view || !this.polylineGraphicsLayer) return null;

		// Decode the polyline
		const decodedPath = this._decodePolyline(encodedShape);
		if (!decodedPath || decodedPath.length === 0) {
			console.error('Failed to decode polyline');
			return null;
		}

		// Convert to ArcGIS path format [lng, lat]
		const paths = decodedPath.map((coord) => [coord[1], coord[0]]);

		const polyline = new this.Polyline({
			paths: [paths],
			spatialReference: { wkid: 4326 }
		});

		const symbol = new this.SimpleLineSymbol({
			color: options.color || COLORS.POLYLINE,
			width: options.weight || 4,
			style: 'solid'
		});

		const graphic = new this.Graphic({
			geometry: polyline,
			symbol: symbol
		});

		this.polylineGraphicsLayer.add(graphic);
		this.polylines.push(graphic);

		// Note: Arrow decorators would require additional implementation
		// ArcGIS doesn't have built-in arrow decorators like Leaflet

		return graphic;
	}

	_decodePolyline(encoded) {
		// Decode Google-style encoded polyline
		const points = [];
		let index = 0;
		let lat = 0;
		let lng = 0;

		while (index < encoded.length) {
			let shift = 0;
			let result = 0;
			let byte;

			do {
				byte = encoded.charCodeAt(index++) - 63;
				result |= (byte & 0x1f) << shift;
				shift += 5;
			} while (byte >= 0x20);

			const dlat = result & 1 ? ~(result >> 1) : result >> 1;
			lat += dlat;

			shift = 0;
			result = 0;

			do {
				byte = encoded.charCodeAt(index++) - 63;
				result |= (byte & 0x1f) << shift;
				shift += 5;
			} while (byte >= 0x20);

			const dlng = result & 1 ? ~(result >> 1) : result >> 1;
			lng += dlng;

			points.push([lat / 1e5, lng / 1e5]);
		}

		return points;
	}

	removePolyline(polyline) {
		if (!polyline || !this.polylineGraphicsLayer) return;

		this.polylineGraphicsLayer.remove(polyline);

		const index = this.polylines.indexOf(polyline);
		if (index > -1) {
			this.polylines.splice(index, 1);
		}
	}

	clearAllPolylines() {
		if (!this.polylineGraphicsLayer) return;

		for (const polyline of this.polylines) {
			this.polylineGraphicsLayer.remove(polyline);
		}
		this.polylines = [];
	}

	getPolylinesCount() {
		return this.polylines.length;
	}

	panTo(lat, lng) {
		if (!this.view) return;
		this.view.goTo({
			center: [lng, lat]
		});
	}

	flyTo(lat, lng, zoom = 15) {
		if (!this.view) return;
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
		if (!this.view) return;
		this.view.zoom = zoom;
	}

	getBoundingBox() {
		if (!this.view || !this.view.extent) {
			return { north: 0, south: 0, east: 0, west: 0 };
		}

		const extent = this.view.extent;
		return {
			north: extent.ymax,
			south: extent.ymin,
			east: extent.xmax,
			west: extent.xmin
		};
	}

	cleanupInfoWindow() {
		if (this.view && this.view.popup) {
			this.view.popup.close();
		}
	}
}
