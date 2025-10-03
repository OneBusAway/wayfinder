import { browser } from '$app/environment';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import { RouteType, routePriorities, prioritizedRouteTypeForDisplay } from '$config/routeConfig';
import './../../assets/styles/leaflet-map.css';
import PolylineUtil from 'polyline-encoded';
import { COLORS } from '$lib/colors';
import PopupContent from '$components/map/PopupContent.svelte';
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import TripPlanPinMarker from '$components/trip-planner/tripPlanPinMarker.svelte';
import { mount, unmount } from 'svelte';

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
		this.maplibreLayer = 'positron';
		this.markersMap = new Map();
		this.polylines = []; // Track all polylines for easy cleanup
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

		// TODO: Make this configurable through env file

		/*
		 * for more styles https://github.com/teamapps-org/maplibre-gl-styles
		 */
		this.maplibreLayer = this.L.maplibreGL({
			style: `https://tiles.openfreemap.org/styles/${this.maplibreLayer}`,
			interactive: true,
			dragRotate: false
		}).addTo(this.map);
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
			isHighlighted: options.isHighlighted ?? false
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
			icon: customIcon
		}).addTo(this.map);

		marker.props = props;

		this.markersMap.set(options.stop.id, marker);
		return marker;
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
			className: '',
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

	addVehicleMarker(vehicle, activeTrip) {
		if (!this.map || !this.L) return null;

		let color;
		if (!vehicle.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const busIconSvg = createVehicleIconSvg(vehicle?.orientation, color);
		const customIcon = this.L.divIcon({
			html: `<img src="data:image/svg+xml;charset=UTF-8,${encodeURIComponent(busIconSvg)}" style="width:45px;height:45px;" />`,
			iconSize: [40, 40],
			iconAnchor: [20, 20],
			className: '',
			zIndexOffset: 1000
		});

		const marker = this.L.marker([vehicle.position.lat, vehicle.position.lon], {
			icon: customIcon,
			zIndexOffset: 1000
		}).addTo(this.map);

		this.vehicleMarkers.push(marker);

		marker.vehicleData = {
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicle.vehicleId,
			lastUpdateTime: vehicle.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicle.nextStop)?.name,
			predicted: vehicle.predicted
		};

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

	updateVehicleMarker(marker, vehicleStatus, activeTrip) {
		if (!this.map || !this.L || !marker) return;

		let color;
		if (!vehicleStatus.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const updatedIconSvg = createVehicleIconSvg(vehicleStatus.orientation, color);
		const updatedIcon = this.L.divIcon({
			html: `<img src="data:image/svg+xml;charset=UTF-8,${encodeURIComponent(updatedIconSvg)}" style="width:45px;height:45px;" />`,
			iconSize: [40, 40],
			iconAnchor: [20, 20],
			className: '',
			zIndexOffset: 1000
		});

		marker.setLatLng([vehicleStatus.position.lat, vehicleStatus.position.lon]);
		marker.setIcon(updatedIcon);

		let vehicleData = $state({
			...marker.vehicleData,
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicleStatus.vehicleId,
			lastUpdateTime: vehicleStatus.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicleStatus.nextStop)?.name || 'N/A',
			predicted: vehicleStatus.predicted
		});

		marker.vehicleData = vehicleData;

		if (marker.isPopupOpen() && marker.popupComponent) {
			marker.popupComponent = vehicleData;
		}
	}
	removeVehicleMarker(marker) {
		if (marker) {
			marker.remove();
		}
	}

	clearVehicleMarkers() {
		if (!this.map) return;

		this.vehicleMarkers.forEach((marker) => {
			marker.remove();
		});
		this.vehicleMarkers = [];
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

	createPolyline(points, options = { withArrow: true }) {
		if (!browser || !this.map) return null;

		const decodedPolyline = PolylineUtil.decode(points);
		if (!decodedPolyline || decodedPolyline.length === 0) {
			console.error('Failed to decode polyline:', points);
			return null;
		}

		const polyline = new this.L.Polyline(decodedPolyline, {
			color: options.color || COLORS.POLYLINE,
			weight: options.weight || 4,
			opacity: options.opacity || 1
		}).addTo(this.map);

		this.polylines.push(polyline);

		if (!options.withArrow) return polyline;

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

	flyTo(lat, lng, zoom = 15) {
		if (!browser || !this.map) return;
		this.map.flyTo([lat, lng], zoom);
	}

	setZoom(zoom) {
		if (!browser || !this.map) return;
		this.map.setZoom(zoom);
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
