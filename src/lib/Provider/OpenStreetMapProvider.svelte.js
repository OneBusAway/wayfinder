import { browser } from '$app/environment';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import './../../assets/styles/leaflet-map.css';
import PolylineUtil from 'polyline-encoded';
import { COLORS } from '$lib/colors';
import PopupContent from '$components/map/PopupContent.svelte';
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import TripPlanPinMarker from '$components/trip-planner/tripPlanPinMarker.svelte';
import { mount, unmount } from 'svelte';

// Cache      for dynamic imports  to avoide   unnecessary  confligs in js  
let leafletPromise = null;
let maplibrePromise = null;
let polylineDecoratorPromise = null;

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
		
		
		this.vehicleIconCache = new Map();
        
        // Store for vehicle data (Svelte 5 compatible) may be much better to use svelte 5 😌  by Sanjai-Shaarugesh 
        this.vehicleDataStore = new Map();
	}

	async initMap(element, options) {
		if (!browser) return;

		
		if (!leafletPromise) {
			leafletPromise = import('leaflet');
		}
		if (!maplibrePromise) {
			maplibrePromise = import('@maplibre/maplibre-gl-leaflet');
		}
		if (!polylineDecoratorPromise) {
			polylineDecoratorPromise = import('leaflet-polylinedecorator');
		}

		// Parallel loading of dependencies  🟰
		const [leaflet] = await Promise.all([
			leafletPromise,
			maplibrePromise,
			polylineDecoratorPromise
		]);

		this.L = leaflet.default;

		
		if (!document.querySelector('link[href*="leaflet.css"]')) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
			document.head.appendChild(link);
		}

		this.map = this.L.map(element, { 
			zoomControl: false,
			attributionControl: false, 
			preferCanvas: true 
		}).setView([options.lat, options.lng], 14);

		this.L.control.zoom({ position: 'bottomright' }).addTo(this.map);

		
		this.maplibreLayer = this.L.maplibreGL({
			style: `https://tiles.openfreemap.org/styles/${this.maplibreLayer}`,
			interactive: true,
			dragRotate: false,
			rendererOptions: {
				antialias: false // Disable antialiasing for better performance 🚄
			}
		}).addTo(this.map);
	}

	eventListeners(mapInstance, debouncedLoadMarkers) {
		
		const handleMapChange = () => {
			requestAnimationFrame(debouncedLoadMarkers);
		};
		
		mapInstance.addListener('dragend', handleMapChange);
		mapInstance.addListener('zoomend', handleMapChange);
		mapInstance.addListener('moveend', handleMapChange);
	}

	addMarker(options) {
		if (!browser || !this.map) return null;

		const container = document.createElement('div');

		const props = {
			stop: options.stop,
			icon: options.icon || faBus,
			onClick: options.onClick || (() => {}),
			isHighlighted: false
		};

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
			riseOnHover: false // Disable z-index changes on hover for better performance for accessibility in map 🗺️
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

		const marker = this.L.marker([position.lat, position.lng], { 
			icon: customIcon,
			riseOnHover: false 
		}).addTo(this.map);

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

		
		marker.props.isHighlighted = true;
        
        
        const container = document.createElement('div');
        mount(StopMarker, {
            target: container,
            props: marker.props
        });
        
        const customIcon = this.L.divIcon({
            html: container,
            className: '',
            iconSize: [40, 40]
        });
        
        marker.setIcon(customIcon);
	}

	unHighlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (!marker) return;

		marker.props.isHighlighted = false;
        
        
        const container = document.createElement('div');
        mount(StopMarker, {
            target: container,
            props: marker.props
        });
        
        const customIcon = this.L.divIcon({
            html: container,
            className: '',
            iconSize: [40, 40]
        });
        
        marker.setIcon(customIcon);
	}

	addStopMarker(stop, stopTime = null) {
		if (!this.L) return null;
		
		
		const circleSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#000000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="feather feather-circle"><circle cx="12" cy="12" r="10"/></svg>';
		
		const customIcon = this.L.divIcon({
			html: circleSvg,
			className: '',
			iconSize: [20, 20],
			iconAnchor: [10, 10]
		});

		const marker = this.L.marker([stop.lat, stop.lon], { 
			icon: customIcon,
			riseOnHover: false 
		}).addTo(this.map);

		this.stopsMap.set(stop.id, stop);

		marker.on('click', () => this.openStopMarker(stop, stopTime));

		this.stopMarkers.push(marker);
		
		return marker;
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

		this.globalInfoWindow = this.L.popup({
			closeButton: true,
			autoClose: true,
			className: 'stop-popup'
		})
			.setLatLng([stop.lat, stop.lon])
			.setContent(popupContainer)
			.openOn(this.map);
	}

	removeStopMarkers() {
		if (!this.map) return;
		
		// Remove in batch for better performance
		const markersToRemove = this.stopMarkers.slice();
		this.stopMarkers = [];
		
		// Use requestAnimationFrame for smoother rendering
		requestAnimationFrame(() => {
			markersToRemove.forEach(marker => {
				marker.remove();
			});
		});
	}

	cleanupInfoWindow() {
		if (this.globalInfoWindow) {
			this.map.closePopup(this.globalInfoWindow);
			this.globalInfoWindow = null;
		}
		
		if (this.popupContentComponent) {
			unmount(this.popupContentComponent);
			this.popupContentComponent = null;
		}
	}

	removeStopMarker(marker) {
		if (!marker) return;
		marker.remove();
	}

	addVehicleMarker(vehicle, activeTrip) {
		if (!this.map || !this.L) return null;

		let color;
		if (!vehicle.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}

		
		const iconKey = `${vehicle?.orientation || 0}-${color || 'default'}`;
		let busIconSvg;
		
		if (this.vehicleIconCache.has(iconKey)) {
			busIconSvg = this.vehicleIconCache.get(iconKey);
		} else {
			busIconSvg = createVehicleIconSvg(vehicle?.orientation, color);
			this.vehicleIconCache.set(iconKey, busIconSvg);
		}
		
		const encodedSvg = encodeURIComponent(busIconSvg);
		const customIcon = this.L.divIcon({
			html: `<img src="data:image/svg+xml;charset=UTF-8,${encodedSvg}" style="width:45px;height:45px;" />`,
			iconSize: [40, 40],
			iconAnchor: [20, 20],
			className: '',
			zIndexOffset: 1000
		});

		const marker = this.L.marker([vehicle.position.lat, vehicle.position.lon], {
			icon: customIcon,
			zIndexOffset: 1000,
			riseOnHover: false 
		}).addTo(this.map);

		this.vehicleMarkers.push(marker);

        // Create the vehicle data object (not using $state directly on marker property)
        const vehicleData = {
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicle.vehicleId,
			lastUpdateTime: vehicle.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicle.nextStop)?.name,
			predicted: vehicle.predicted
		};
        
        // Store the vehicle data with the vehicle ID as the key 🏇
        this.vehicleDataStore.set(vehicle.vehicleId, vehicleData);
        
        
        marker.vehicleDataId = vehicle.vehicleId;

		
		let popupCreated = false;
		
		marker.on('click', () => {
			if (!popupCreated) {
				marker.bindPopup(document.createElement('div'));
				popupCreated = true;
			}
			
			const popupContainer = document.createElement('div');
			const currentVehicleData = this.vehicleDataStore.get(marker.vehicleDataId);
            
			marker.popupComponent = mount(VehiclePopupContent, {
				target: popupContainer,
				props: currentVehicleData
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

		
		const iconKey = `${vehicleStatus.orientation || 0}-${color || 'default'}`;
		let updatedIconSvg;
		
		if (this.vehicleIconCache.has(iconKey)) {
			updatedIconSvg = this.vehicleIconCache.get(iconKey);
		} else {
			updatedIconSvg = createVehicleIconSvg(vehicleStatus.orientation, color);
			this.vehicleIconCache.set(iconKey, updatedIconSvg);
		}
		
		const encodedSvg = encodeURIComponent(updatedIconSvg);
		const updatedIcon = this.L.divIcon({
			html: `<img src="data:image/svg+xml;charset=UTF-8,${encodedSvg}" style="width:45px;height:45px;" />`,
			iconSize: [40, 40],
			iconAnchor: [20, 20],
			className: '',
			zIndexOffset: 1000
		});

		
		requestAnimationFrame(() => {
			marker.setLatLng([vehicleStatus.position.lat, vehicleStatus.position.lon]);
			marker.setIcon(updatedIcon);
		});

		
        const updatedVehicleData = {
			nextDestination: activeTrip.tripHeadsign,
			vehicleId: vehicleStatus.vehicleId,
			lastUpdateTime: vehicleStatus.lastUpdateTime,
			nextStopName: this.stopsMap.get(vehicleStatus.nextStop)?.name || 'N/A',
			predicted: vehicleStatus.predicted
		};
        
        this.vehicleDataStore.set(vehicleStatus.vehicleId, updatedVehicleData);

		
		if (marker.isPopupOpen() && marker.popupComponent) {
            const popupContainer = document.createElement('div');
            
            
            unmount(marker.popupComponent);
            
            
            marker.popupComponent = mount(VehiclePopupContent, {
                target: popupContainer,
                props: updatedVehicleData
            });
            
            marker.getPopup().setContent(popupContainer);
		}
	}
	
	removeVehicleMarker(marker) {
		if (marker) {
			if (marker.popupComponent) {
				unmount(marker.popupComponent);
				marker.popupComponent = null;
			}
            
            
            if (marker.vehicleDataId) {
                this.vehicleDataStore.delete(marker.vehicleDataId);
            }
            
			marker.remove();
		}
	}

	clearVehicleMarkers() {
		if (!this.map) return;

		// Use requestAnimationFrame for better performance during large updates 🚄
		const markersToRemove = this.vehicleMarkers.slice();
		this.vehicleMarkers = [];
		
		requestAnimationFrame(() => {
			markersToRemove.forEach(marker => {
				if (marker.popupComponent) {
					unmount(marker.popupComponent);
					marker.popupComponent = null;
				}
                
                // Clean up stored vehicle data 🚍
                if (marker.vehicleDataId) {
                    this.vehicleDataStore.delete(marker.vehicleDataId);
                }
                
				marker.remove();
			});
		});
        
        
        this.vehicleDataStore.clear();
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
	}

	setTheme(theme) {
		if (!browser || !this.map) return;

		let styleUrl;
		if (theme === 'dark') {
			styleUrl = 'https://tiles.openfreemap.org/styles/dark';
		} else {
			styleUrl = 'https://tiles.openfreemap.org/styles/positron';
		}

		// Use requestAnimationFrame for smoother theme transition
		requestAnimationFrame(() => {
			if (this.maplibreLayer) {
				this.map.removeLayer(this.maplibreLayer);
			}

			this.maplibreLayer = this.L.maplibreGL({
				style: styleUrl,
				rendererOptions: {
					antialias: false 
				}
			}).addTo(this.map);
		});
	}

	createPolyline(points, options = { withArrow: true }) {
		if (!browser || !this.map) return null;

		const decodedPolyline = PolylineUtil.decode(points);
		if (!decodedPolyline || decodedPolyline.length === 0) {
			console.error('Failed to decode polyline:', points);
			return null;
		}

		// Reduce polyline precision for better performance with long routes
		const simplifiedPolyline = this._simplifyPolyline(decodedPolyline, 0.00005);

		const polyline = new this.L.Polyline(simplifiedPolyline, {
			color: options.color || COLORS.POLYLINE,
			weight: options.weight || 4,
			opacity: options.opacity || 1,
			smoothFactor: 1.5 
		}).addTo(this.map);

		if (!options.withArrow) return polyline;

		
		const arrowDecorator = this.L.polylineDecorator(polyline, {
			patterns: [
				{
					offset: 0,
					repeat: 250, 
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

		
		requestAnimationFrame(() => {
			if (polyline.arrowDecorator) {
				polyline.arrowDecorator.remove();
				polyline.arrowDecorator = null;
			}

			polyline.remove();
		});
	}

	panTo(lat, lng) {
		if (!browser || !this.map) return;
		
		requestAnimationFrame(() => {
			this.map.panTo([lat, lng]);
		});
	}

	flyTo(lat, lng, zoom = 15) {
		if (!browser || !this.map) return;
		// Use requestAnimationFrame for smoother animations
		requestAnimationFrame(() => {
			this.map.flyTo([lat, lng], zoom, {
				duration: 0.5 
			});
		});
	}

	setZoom(zoom) {
		if (!browser || !this.map) return;
		// Use requestAnimationFrame for smoother zooming
		requestAnimationFrame(() => {
			this.map.setZoom(zoom);
		});
	}

	getBoundingBox() {
		if (!this.map) return { north: 0, east: 0, south: 0, west: 0 };
		
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