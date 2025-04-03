import { loadGoogleMapsLibrary, nightModeStyles } from '$lib/googleMaps';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
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
		this.overlays = new Set(); 
		
		// Pre-create container for InfoWindows to reduce DOM operations 
		this.popupContainer = document.createElement('div');
		document.body.appendChild(this.popupContainer);
	}

	async initMap(element, options) {
		
		const googleMapsPromise = new Promise((resolve) => {
			
			if (window.google && window.google.maps) {
				resolve();
				return;
			}
			
			
			loadGoogleMapsLibrary(this.apiKey);
			
			
			const observer = new MutationObserver(() => {
				if (window.google && window.google.maps) {
					observer.disconnect();
					resolve();
				}
			});
			
			observer.observe(document.head, { childList: true, subtree: true });
			
			// Fallback timeout check - limit to 5 seconds
			setTimeout(() => {
				const checkGoogleMaps = () => {
					if (window.google && window.google.maps) {
						observer.disconnect();
						resolve();
					} else {
						setTimeout(checkGoogleMaps, 50); 
					}
				};
				checkGoogleMaps();
			}, 100);
		});

		await googleMapsPromise;
		
	
		const mapOptions = {
			center: { lat: options.lat, lng: options.lng },
			zoom: 15,
			disableDefaultUI: false,
			clickableIcons: false, 
			gestureHandling: 'greedy',
			maxZoom: 20,
			minZoom: 3,
			zoomControl: true,
			mapTypeControl: false,
			scaleControl: true,
			streetViewControl: false,
			rotateControl: false,
			fullscreenControl: true,
			optimized: true, 
			tilt: 0 
		};
		
		this.map = new google.maps.Map(element, mapOptions);
		
		
		google.maps.importLibrary('geometry');
		
		return this.map;
	}

	eventListeners(mapInstance, debouncedLoadMarkers) {
	
		let lastCenter = mapInstance.getCenter();
		let lastZoom = mapInstance.getZoom();
		let debounceTimeout;
		
		const handleMapChange = () => {
			const currentCenter = mapInstance.getCenter();
			const currentZoom = mapInstance.getZoom();
			
			
			const centerChanged = Math.abs(currentCenter.lat() - lastCenter.lat()) > 0.0001 || 
								 Math.abs(currentCenter.lng() - lastCenter.lng()) > 0.0001;
			const zoomChanged = currentZoom !== lastZoom;
			
			if (centerChanged || zoomChanged) {
				lastCenter = currentCenter;
				lastZoom = currentZoom;
				
				clearTimeout(debounceTimeout);
				debounceTimeout = setTimeout(debouncedLoadMarkers, 150);
			}
		};
		
		// Use idle event which fires once after all movement completes, reducing callback frequency
		mapInstance.addListener('idle', handleMapChange);
	}

	addMarker(options) {
		try {
			// Reuse container for better performance
			const container = document.createElement('div');
			
			const props = $state({
				stop: options.stop,
				icon: options.icon || faBus,
				onClick: options.onClick || (() => {}),
				isHighlighted: false
			});

			const marker = mount(StopMarker, {
				target: container,
				props
			});

			this.markersMap.set(options.stop.id, marker);

			const overlay = new google.maps.OverlayView();
			overlay.onAdd = function() {
				this.getPanes().overlayMouseTarget.appendChild(container);
			};
			
			
			overlay.draw = function() {
				const projection = this.getProjection();
				const position = projection.fromLatLngToDivPixel(options.position);
				container.style.transform = `translate(${position.x - 20}px, ${position.y - 20}px)`;
				container.style.position = 'absolute';
				container.style.willChange = 'transform'; // Hint for browser optimization
				container.style.zIndex = '1000';
			};
			
			overlay.onRemove = function() {
				unmount(marker);
				if (container.parentNode) {
					container.parentNode.removeChild(container);
				}
			};
			
			overlay.setMap(this.map);
			this.overlays.add(overlay);
			
			return { overlay, element: container, componentInstance: marker };
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
			this.overlays.delete(markerObj.overlay);
			markerObj.overlay.setMap(null);
		}
		
		if (markerObj.componentInstance) {
			unmount(markerObj.componentInstance);
		}
	}

	addStopMarker(stop, stopTime = null) {
		
		if (!this.stopIconDef) {
			this.stopIconDef = {
				path: google.maps.SymbolPath.CIRCLE,
				scale: 5,
				fillColor: '#FFFFFF',
				fillOpacity: 1,
				strokeWeight: 1,
				strokeColor: '#000000',
				optimized: true
			};
		}
		
		const marker = new google.maps.Marker({
			position: { lat: stop.lat, lng: stop.lon },
			map: this.map,
			icon: this.stopIconDef,
			optimized: true 
		});

		this.stopsMap.set(stop.id, stop);

		
		const clickHandler = this.createStopClickHandler(stop, stopTime);
		marker.addListener('click', clickHandler);

		this.markersMap.set(stop.id, marker);
		this.stopMarkers.push(marker);
		
		return marker;
	}
	
	createStopClickHandler(stop, stopTime) {
		return () => this.openStopMarker(stop, stopTime);
	}

	openStopMarker(stop, stopTime = null) {
		this.cleanupInfoWindow();

	
		const popupContainer = this.popupContainer;
		popupContainer.innerHTML = '';

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

	highlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (!marker) return;
		
		if (marker.props) {
			marker.props.isHighlighted = true;
		} else if (marker instanceof google.maps.Marker) {
		
			marker.setZIndex(1001);
			if (!this.highlightedIconDef) {
				this.highlightedIconDef = {
					path: google.maps.SymbolPath.CIRCLE,
					scale: 6,
					fillColor: '#FFFF00',
					fillOpacity: 1,
					strokeWeight: 2,
					strokeColor: '#000000',
					optimized: true
				};
			}
			marker.setIcon(this.highlightedIconDef);
		}
	}

	unHighlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (!marker) return;
		
		if (marker.props) {
			marker.props.isHighlighted = false;
		} else if (marker instanceof google.maps.Marker) {
			marker.setZIndex(1000);
			marker.setIcon(this.stopIconDef);
		}
	}

	removeStopMarkers() {
		
		for (const marker of this.stopMarkers) {
			marker.setMap(null);
		}
		this.stopMarkers = [];
	}

	addPinMarker(position, text) {
		const container = document.createElement('div');
		
		const component = mount(TripPlanPinMarker, {
			target: container,
			props: { text }
		});

		const overlay = new google.maps.OverlayView();

		overlay.onAdd = function() {
			this.getPanes().overlayMouseTarget.appendChild(container);
		};

		overlay.draw = function() {
			const projection = this.getProjection();
			const pos = projection.fromLatLngToDivPixel(
				new google.maps.LatLng(position.lat, position.lng)
			);
			container.style.transform = `translate(${pos.x - 16}px, ${pos.y - 50}px)`;
			container.style.position = 'absolute';
			container.style.willChange = 'transform';
			container.style.zIndex = '1000';
		};

		overlay.onRemove = function() {
			unmount(component);
			if (container.parentNode) {
				container.parentNode.removeChild(container);
			}
		};

		overlay.setMap(this.map);
		this.overlays.add(overlay);

		return { overlay, element: container, componentInstance: component };
	}

	removePinMarker(marker) {
		if (!marker) return;

		if (marker.overlay) {
			this.overlays.delete(marker.overlay);
			marker.overlay.setMap(null);
		}

		if (marker.componentInstance) {
			unmount(marker.componentInstance);
		}
	}

	
	getVehicleSvgCache(orientation, color = null) {
		
		const key = `${orientation}_${color || 'default'}`;
		
		if (!this.vehicleIconCache) {
			this.vehicleIconCache = new Map();
		}
		
		if (!this.vehicleIconCache.has(key)) {
			const svgIcon = createVehicleIconSvg(orientation, color);
			const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`;
			
			this.vehicleIconCache.set(key, {
				url,
				scaledSize: new google.maps.Size(40, 40),
				anchor: new google.maps.Point(20, 20),
				optimized: true
			});
		}
		
		return this.vehicleIconCache.get(key);
	}

	addVehicleMarker(vehicle, activeTrip) {
		if (!this.map) return null;

		const color = !vehicle.predicted ? COLORS.VEHICLE_REAL_TIME_OFF : null;
		const icon = this.getVehicleSvgCache(vehicle?.orientation, color);

		const marker = new google.maps.Marker({
			position: { lat: vehicle.position.lat, lng: vehicle.position.lon },
			map: this.map,
			icon,
			zIndex: 1000,
			optimized: true
		});

		this.vehicleMarkers.push(marker);

		
		marker.vehicleData = {
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicle.vehicleId,
			lastUpdateTime: vehicle.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicle.nextStop)?.name,
			predicted: vehicle.predicted,
			orientation: vehicle?.orientation
		};

		
		marker.addListener('click', () => {
			
			this.cleanupInfoWindow();
			
			
			const popupContainer = document.createElement('div');
			const popupComponent = mount(VehiclePopupContent, {
				target: popupContainer,
				props: marker.vehicleData
			});
			
			const infoWindow = new google.maps.InfoWindow({
				content: popupContainer
			});
			
			infoWindow.open(this.map, marker);
			
			
			this.globalInfoWindow = infoWindow;
			this.popupContentComponent = popupComponent;
		});

		return marker;
	}

	updateVehicleMarker(marker, vehicleStatus, activeTrip) {
		if (!this.map || !marker) return;

		marker.setPosition({ lat: vehicleStatus.position.lat, lng: vehicleStatus.position.lon });

		
		if (marker.vehicleData.orientation !== vehicleStatus.orientation || 
			marker.vehicleData.predicted !== vehicleStatus.predicted) {
			
			const color = !vehicleStatus.predicted ? COLORS.VEHICLE_REAL_TIME_OFF : null;
			const icon = this.getVehicleSvgCache(vehicleStatus.orientation, color);
			marker.setIcon(icon);
		}

		
		marker.vehicleData = {
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicleStatus.vehicleId,
			lastUpdateTime: vehicleStatus.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicleStatus.nextStop)?.name,
			predicted: vehicleStatus.predicted,
			orientation: vehicleStatus.orientation
		};
		
		
		if (this.globalInfoWindow && this.globalInfoWindow.anchor === marker && this.popupContentComponent) {
			this.popupContentComponent.$set(marker.vehicleData);
		}
	}

	removeVehicleMarker(marker) {
		if (!marker) return;
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
			this.globalInfoWindow = null;
		}
		
		if (this.popupContentComponent) {
			unmount(this.popupContentComponent);
			this.popupContentComponent = null;
		}
	}

	setCenter(latLng) {
		if (!this.map) return;
		this.map.setCenter(latLng);
	}

	getCenter() {
		if (!this.map) return { lat: 0, lng: 0 };
		const center = this.map.getCenter();
		return { lat: center.lat(), lng: center.lng() };
	}

	addListener(event, callback) {
		if (!this.map) return;
		this.map.addListener(event, callback);
	}

	setTheme(theme) {
		if (!this.map) return;
		const styles = theme === 'dark' ? nightModeStyles() : null;
		this.map.setOptions({ styles });
	}

	addUserLocationMarker(latLng) {
		if (!this.map) return;
		
		
		if (!this.userLocationIconDef) {
			this.userLocationIconDef = {
				path: google.maps.SymbolPath.CIRCLE,
				scale: 8,
				fillColor: '#007BFF',
				fillOpacity: 1,
				strokeWeight: 2,
				strokeColor: '#FFFFFF',
				optimized: true
			};
		}
		
		return new google.maps.Marker({
			map: this.map,
			position: latLng,
			title: 'Your Location',
			icon: this.userLocationIconDef,
			optimized: true
		});
	}

	async createPolyline(shape, addArrow = true) {
		if (!this.map) return null;
		
		
		if (!google.maps.geometry) {
			await google.maps.importLibrary('geometry');
		}

		
		let path;
		if (!this.pathCache) {
			this.pathCache = new Map();
		}
		
		if (this.pathCache.has(shape)) {
			path = this.pathCache.get(shape);
		} else {
			const decodedPath = google.maps.geometry.encoding.decodePath(shape);
			path = decodedPath.map(point => ({ lat: point.lat(), lng: point.lng() }));
			this.pathCache.set(shape, path);
		}

		const polylineOptions = {
			path,
			geodesic: true,
			strokeColor: COLORS.POLYLINE,
			strokeOpacity: 1.0,
			strokeWeight: 5,
			clickable: false, // Better performance i think so.... 
			zIndex: 1
		};

		if (addArrow) {
			// Use cached arrow symbol
			if (!this.arrowSymbol) {
				this.arrowSymbol = {
					path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
					scale: 2,
					strokeColor: COLORS.POLYLINE_ARROW_STROKE,
					strokeWeight: 3
				};
			}

			polylineOptions.icons = [{
				icon: this.arrowSymbol,
				offset: '100%',
				repeat: '50px'
			}];
		}

		const polyline = new google.maps.Polyline(polylineOptions);
		polyline.setMap(this.map);

		return polyline;
	}

	removePolyline(polyline) {
		if (polyline && polyline.setMap) {
			polyline.setMap(null);
		}
		return null;
	}

	panTo(lat, lng) {
		if (!this.map) return;
		this.map.panTo({ lat, lng });
	}

	flyTo(lat, lng, zoom = 15) {
		if (!this.map) return;
		
		
		this.map.panTo({ lat, lng });
		setTimeout(() => this.map.setZoom(zoom), 50);
	}
	
	setZoom(zoom) {
		if (!this.map) return;
		this.map.setZoom(zoom);
	}

	getBoundingBox() {
		if (!this.map) return { north: 0, east: 0, south: 0, west: 0 };
		
		const bounds = this.map.getBounds();
		if (!bounds) return { north: 0, east: 0, south: 0, west: 0 };
		
		const ne = bounds.getNorthEast();
		const sw = bounds.getSouthWest();
		return {
			north: ne.lat(),
			east: ne.lng(),
			south: sw.lat(),
			west: sw.lng()
		};
	}
	
	//add proper    cleanup method
	destroy() {
		// Clean up all overlays
		for (const overlay of this.overlays) {
			overlay.setMap(null);
		}
		this.overlays.clear();
		
		
		this.removeStopMarkers();
		this.clearVehicleMarkers();
		this.cleanupInfoWindow();
		
		
		if (this.popupContentComponent) {
			unmount(this.popupContentComponent);
		}
		
		
		if (this.vehicleIconCache) {
			this.vehicleIconCache.clear();
		}
		if (this.pathCache) {
			this.pathCache.clear();
		}
		
		//               Clean up DOM elements
		if (this.popupContainer && this.popupContainer.parentNode) {
			this.popupContainer.parentNode.removeChild(this.popupContainer);
		}
		
	
		this.map = null;
		this.globalInfoWindow = null;
		this.popupContentComponent = null;
		this.stopsMap.clear();
		this.markersMap.clear();
	}
}