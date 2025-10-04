import { loadGoogleMapsLibrary, createMap, nightModeStyles } from '$lib/googleMaps';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import { RouteType, routePriorities, prioritizedRouteTypeForDisplay } from '$config/routeConfig';
import { COLORS } from '$lib/colors';
import PopupContent from '$components/map/PopupContent.svelte';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';
import TripPlanPinMarker from '$components/trip-planner/tripPlanPinMarker.svelte';
import { mount, unmount } from 'svelte';

export default class GoogleMapProvider {
	constructor(apiKey, handleStopMarkerSelect) {
		this.apiKey = apiKey;
		this.map = null;
		this.globalInfoWindow = null;
		this.popupContentComponent = null;
		this.stopsMap = new Map();
		this.stopMarkers = [];
		this.vehicleMarkers = [];
		this.markersMap = new Map();
		this.handleStopMarkerSelect = handleStopMarkerSelect;
		this.polylines = []; // Track all polylines for easy cleanup
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
			document.body.appendChild(container);

			const props = $state({
				stop: options.stop,
				icon: icon,
				onClick: options.onClick,
				isHighlighted: options.isHighlighted ?? false
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
			return { overlay, element: container };
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

	addStopRouteMarker(stop, stopTime = null) {
		const marker = new google.maps.Marker({
			position: { lat: stop.lat, lng: stop.lon },
			map: this.map,
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

		this.markersMap.set(stop.id, marker);
		this.stopMarkers.push(marker);
	}

	openStopMarker(stop, stopTime = null) {
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

		this.globalInfoWindow.open(this.map, this.markersMap.get(stop.id));
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

	removeStopMarkers() {
		this.stopMarkers.forEach((marker) => {
			marker.setMap(null);
		});
		this.stopMarkers = [];
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

	addVehicleMarker(vehicle, activeTrip) {
		if (!this.map) return null;

		let color;
		if (!vehicle.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const busIcon = createVehicleIconSvg(vehicle?.orientation, color);
		const icon = {
			url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(busIcon)}`,
			scaledSize: new google.maps.Size(40, 40),
			anchor: new google.maps.Point(20, 20)
		};

		const marker = new google.maps.Marker({
			position: { lat: vehicle.position.lat, lng: vehicle.position.lon },
			map: this.map,
			icon: icon,
			zIndex: 1000
		});

		this.vehicleMarkers.push(marker);

		const vehicleData = {
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicle.vehicleId,
			lastUpdateTime: vehicle.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicle.nextStop)?.name,
			predicted: vehicle.predicted
		};

		const popupContainer = document.createElement('div');
		marker.popupComponent = mount(VehiclePopupContent, {
			target: popupContainer,
			props: vehicleData
		});

		marker.infoWindow = new google.maps.InfoWindow({
			content: popupContainer
		});

		marker.addListener('click', () => {
			marker.infoWindow.open(this.map, marker);
		});

		return marker;
	}

	updateVehicleMarker(marker, vehicleStatus, activeTrip) {
		if (!this.map || !marker) return;

		marker.setPosition({ lat: vehicleStatus.position.lat, lng: vehicleStatus.position.lon });

		let color;
		if (!vehicleStatus.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		const updatedIcon = createVehicleIconSvg(vehicleStatus.orientation, color);
		marker.setIcon({
			url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(updatedIcon)}`,
			scaledSize: new google.maps.Size(40, 40),
			anchor: new google.maps.Point(20, 20)
		});

		const updatedData = {
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicleStatus.vehicleId,
			lastUpdateTime: vehicleStatus.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicleStatus.nextStop)?.name,
			predicted: vehicleStatus.predicted
		};

		if (marker.popupComponent) {
			marker.popupComponent.$set(updatedData);
		}
	}

	removeVehicleMarker(marker) {
		marker.setMap(null);
	}

	clearVehicleMarkers() {
		if (!this.map) return;

		for (const marker of this.vehicleMarkers) {
			marker.setMap(null);
		}
		this.vehicleMarkers = [];
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

	addListener(event, callback) {
		this.map.addListener(event, callback);
	}

	setTheme(theme) {
		const styles = theme === 'dark' ? nightModeStyles() : null;
		this.map.setOptions({ styles });
	}

	addUserLocationMarker(latLng) {
		new google.maps.Marker({
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
	}

	async createPolyline(shape, addArrow = true) {
		await window.google.maps.importLibrary('geometry');

		const decodedPath = google.maps.geometry.encoding.decodePath(shape);
		const path = decodedPath.map((point) => ({ lat: point.lat(), lng: point.lng() }));

		const polylineOptions = {
			path,
			geodesic: true,
			strokeColor: COLORS.POLYLINE,
			strokeOpacity: 1.0,
			strokeWeight: 5
		};

		if (addArrow) {
			const arrowSymbol = {
				path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
				scale: 2,
				strokeColor: COLORS.POLYLINE_ARROW_STROKE,
				strokeWeight: 3
			};

			polylineOptions.icons = [
				{
					icon: arrowSymbol,
					offset: '100%',
					repeat: '50px'
				}
			];
		}

		const polyline = new window.google.maps.Polyline(polylineOptions);

		polyline.setMap(this.map);

		this.polylines.push(polyline);

		return polyline;
	}

	async removePolyline(polyline) {
		if (polyline && polyline.setMap) {
			polyline.setMap(null);
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

	flyTo(lat, lng, zoom = 15) {
		this.map.setZoom(zoom);
		this.map.setCenter({ lat, lng });
	}
	setZoom(zoom) {
		this.map.setZoom(zoom);
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
