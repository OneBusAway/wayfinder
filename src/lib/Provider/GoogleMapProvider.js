import { loadGoogleMapsLibrary, createMap, nightModeStyles } from '$lib/googleMaps';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import { COLORS } from '$lib/colors';
import PopupContent from '$components/map/PopupContent.svelte';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';
export default class GoogleMapProvider {
	constructor(apiKey) {
		this.apiKey = apiKey;
		this.map = null;
		this.globalInfoWindow = null;
		this.popupContentComponent = null;
		this.stopsMap = new Map();
		this.stopMarkers = [];
		this.vehicleMarkers = [];
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
			const container = document.createElement('div');
			document.body.appendChild(container);

			new StopMarker({
				target: container,
				props: {
					stop: options.stop,
					icon: faBus,
					onClick: () => {
						options.onClick && options.onClick();
					}
				}
			});

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
	}

	addStopMarker(stop, stopTime = null) {
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

		marker.addListener('click', () => {
			if (this.globalInfoWindow) {
				this.globalInfoWindow.close();
			}

			if (this.popupContentComponent) {
				this.popupContentComponent.$destroy();
			}

			const popupContainer = document.createElement('div');

			this.popupContentComponent = new PopupContent({
				target: popupContainer,
				props: {
					stopName: stop.name,
					arrivalTime: stopTime ? stopTime.arrivalTime : null
				}
			});

			this.globalInfoWindow = new google.maps.InfoWindow({
				content: popupContainer
			});

			this.globalInfoWindow.open(this.map, marker);
		});

		this.stopMarkers.push(marker);
	}

	removeStopMarkers() {
		this.stopMarkers.forEach((marker) => {
			marker.setMap(null);
		});
		this.stopMarkers = [];
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
		marker.popupComponent = new VehiclePopupContent({
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

	setMapType(type) {
		this.map.setMapTypeId(type);
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
				strokeColor: COLORS.POLYLINE_ARROW,
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

		return polyline;
	}

	async removePolyline(polyline) {
		if (polyline && polyline.setMap) {
			polyline.setMap(null);
		}

		return null;
	}

	panTo(lat, lng) {
		this.map.panTo({ lat, lng });
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
