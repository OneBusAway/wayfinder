<script>
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import {
		PUBLIC_OBA_REGION_CENTER_LAT as initialLat,
		PUBLIC_OBA_REGION_CENTER_LNG as initialLng
	} from '$env/static/public';

	import { debounce } from '$lib/utils';
	import LocationButton from '$lib/LocationButton/LocationButton.svelte';
	import RouteMap from './RouteMap.svelte';

	import { faBus } from '@fortawesome/free-solid-svg-icons';
	import { RouteType, routePriorities, prioritizedRouteTypeForDisplay } from '$config/routeConfig';
	import { isMapLoaded } from '$src/stores/mapStore';
	import { userLocation } from '$src/stores/userLocationStore';
	
	/**
	 * @typedef {Object} Props
	 * @property {any} [selectedTrip]
	 * @property {any} [selectedRoute]
	 * @property {boolean} [showRoute]
	 * @property {boolean} [showRouteMap]
	 * @property {any} [mapProvider]
	 */

	/** @type {Props} */
	let {
		handleStopMarkerSelect,
		selectedTrip = null,
		selectedRoute = null,
		showRoute = false,
		showRouteMap = false,
		mapProvider = null
	} = $props();


	let isTripPlanModeActive = $state(false);
	let mapInstance = $state(null);
	let mapElement = $state(null);
	let allStops = $state([]);
	let isLoading = $state(false);
	let lastZoomLevel = $state(null);
	let lastBoundingBoxKey = $state(null);

	
	const markers = $state([]);
	const stopsCache = $state(new Map());
	
	
	const shouldShowMarkers = $derived(!selectedRoute && !isTripPlanModeActive);

	// Improved cache key with fewer decimal places and zoom level
	function cacheKey(zoomLevel, boundingBox) {
		
		const decimalPlaces = 3;
		const { north, south, east, west } = boundingBox;
		return `${north.toFixed(decimalPlaces)}_${south.toFixed(decimalPlaces)}_${east.toFixed(decimalPlaces)}_${west.toFixed(decimalPlaces)}_${zoomLevel}`;
	}

	function getBoundingBox() {
		if (!mapProvider) {
			throw new Error('Map provider is not initialized');
		}
		return mapProvider.getBoundingBox();
	}


	function shouldReloadStops(zoomLevel, boundingBoxKey) {
	
		if (lastZoomLevel === null) return true;
		
		
		if (Math.abs(zoomLevel - lastZoomLevel) >= 2) return true;
		
		
		if (boundingBoxKey === lastBoundingBoxKey) return false;
		
		
		if (zoomLevel >= 16) {
			
			return true;
		}
		
		
		const currentBounds = getBoundingBox();
		const currentArea = (currentBounds.north - currentBounds.south) * 
							(currentBounds.east - currentBounds.west);
		
		
		const significantViewportChange = !lastBoundingBoxKey || 
			(boundingBoxKey.split('_').slice(0, 4).join('') !== 
			lastBoundingBoxKey.split('_').slice(0, 4).join(''));
		
		return significantViewportChange;
	}

	
	function getRadiusForZoom(zoomLevel) {
		// Smaller radius for higher zoom levels (more detail)
		if (zoomLevel >= 18) return 800;
		if (zoomLevel >= 16) return 1200;
		if (zoomLevel >= 14) return 2000;
		if (zoomLevel >= 12) return 3000;
		return 4000;
	}


	async function loadStopsForLocation(lat, lng, zoomLevel, firstCall = false) {
		try {
			if (firstCall) {
				const response = await fetch(`/api/oba/stops-for-location?lat=${lat}&lng=${lng}&radius=2500`);
				if (!response.ok) {
					throw new Error('Failed to fetch locations');
				}
				return await response.json();
			}

			const boundingBox = getBoundingBox();
			const key = cacheKey(zoomLevel, boundingBox);
			
			
			if (stopsCache.has(key)) {
				return stopsCache.get(key);
			}

			const { north, south, east, west } = boundingBox;
			
			const radius = getRadiusForZoom(zoomLevel);
			
			const response = await fetch(
				`/api/oba/stops-for-location?lat=${lat}&lng=${lng}&latSpan=${north - south}&lngSpan=${east - west}&radius=${radius}`
			);

			if (!response.ok) {
				throw new Error('Failed to fetch locations');
			}

			const stopsForLocation = await response.json();
			stopsCache.set(key, stopsForLocation);
			
			// Limit cache size to prevent memory issues
			if (stopsCache.size > 20) {
				const oldestKey = stopsCache.keys().next().value;
				stopsCache.delete(oldestKey);
			}

			return stopsForLocation;
		} catch (error) {
			console.error('Error loading stops:', error);
			return { data: { list: [], references: { routes: [] } } };
		}
	}

	
	async function initMap() {
			try {
				await mapProvider.initMap(mapElement, {
					lat: Number(initialLat),
					lng: Number(initialLng)
				});

				mapInstance = mapProvider;

				
				await loadStopsAndAddMarkers(initialLat, initialLng, true);

				
				const preloadStops = () => {
					if (selectedRoute || showRoute || isTripPlanModeActive) {
						return;
					}

					const zoomLevel = mapInstance.map.getZoom();

					// Just update zoom level tracking without waiting for full load  🎪
					lastZoomLevel = zoomLevel;
				};

				
				const handleZoomChange = debounce(async () => {
					if (selectedRoute || showRoute || isTripPlanModeActive) {
						return;
					}

					const center = mapInstance.getCenter();
					const zoomLevel = mapInstance.map.getZoom();
				
					loadStopsAndAddMarkers(center.lat, center.lng, false, zoomLevel);
				}, 150); 

				
				const handlePanChange = debounce(async () => {
					if (selectedRoute || showRoute || isTripPlanModeActive) {
						return;
					}

					const center = mapInstance.getCenter();
					const zoomLevel = mapInstance.map.getZoom();
					const boundingBox = getBoundingBox();
					const currentBoundingBoxKey = cacheKey(zoomLevel, boundingBox);

					
					if (shouldReloadStops(zoomLevel, currentBoundingBoxKey)) {
						loadStopsAndAddMarkers(center.lat, center.lng, false, zoomLevel);
						lastBoundingBoxKey = currentBoundingBoxKey;
					}
				}, 250);

				
				if (mapInstance.map) {
					
					mapInstance.map.on('zoomstart', preloadStops);
					mapInstance.map.on('dragstart', preloadStops);

					
					mapInstance.map.on('zoomend', handleZoomChange);
					mapInstance.map.on('dragend', handlePanChange);
					mapInstance.map.on('moveend', handlePanChange);
				}

				if (browser) {
					window.addEventListener('themeChange', handleThemeChange);
				}
			} catch (error) {
				console.error('Error initializing map:', error);
			}
		}

	
	async function loadStopsAndAddMarkers(lat, lng, firstCall = false, zoomLevel = 15) {
		
		const loadingOperation = Date.now();
		const currentOperation = loadingOperation;
		
		
		if (isLoading) {
			
			if (Math.abs(zoomLevel - lastZoomLevel) < 2) {
				return;
			}
			
		}
		
		try {
			isLoading = true;
			
			
			const boundingBox = getBoundingBox();
			const currentBoundingBoxKey = cacheKey(zoomLevel, boundingBox);
			if (!firstCall && stopsCache.has(currentBoundingBoxKey)) {
				
				const cachedData = stopsCache.get(currentBoundingBoxKey);
				setTimeout(() => {
				
					processStopsData(cachedData, true); 
				}, 0);
			}
			
			
			const stopsData = await loadStopsForLocation(lat, lng, zoomLevel, firstCall);
			
			
			if (currentOperation !== loadingOperation) {
				
				return;
			}
			
			
			processStopsData(stopsData, false);
			
		} catch (error) {
			console.error('Error loading stops and adding markers:', error);
		} finally {
			
			if (currentOperation === loadingOperation) {
				isLoading = false;
			}
		}
	}
	
	
	function processStopsData(stopsData, fastPath = false) {
		const newStops = stopsData.data?.list || [];
		const routeReference = stopsData.data?.references?.routes || [];

	
		const routeLookup = new Map(routeReference.map((route) => [route.id, route]));
		
		// Process stops in a batch for better performance 🚄
		const processedStops = newStops.map((stop) => {
			return {
				...stop,
				routes: (stop.routeIds || [])
					.map((routeId) => routeLookup.get(routeId))
					.filter(Boolean)
			};
		});

		
		const stopsToProcess = fastPath ? processedStops.slice(0, 50) : processedStops;
		
	
		const maxStopsToTrack = 500;
		
		
		const stopMap = new Map([...allStops, ...stopsToProcess].map(stop => [stop.id, stop]));
		
		
		if (stopMap.size > maxStopsToTrack) {
			// Keep only the most recent stops 🚏
			const stopsToKeep = [...stopMap.values()].slice(-maxStopsToTrack);
			allStops = stopsToKeep;
		} else {
			allStops = [...stopMap.values()];
		}
		
		
		if (shouldShowMarkers) {
			
			if (fastPath && markers.length > 100) {
				clearAllMarkers();
			}
			
			const existingStopIds = new Set(markers.map(m => m.stop.id));
			
			
			const limit = fastPath ? 30 : 100;
			const stopsToAdd = stopsToProcess
				.filter(stop => !existingStopIds.has(stop.id))
				.slice(0, limit);
				
			
			if (mapInstance) {
				const bounds = mapInstance.map.getBounds();
				
				
				stopsToAdd.sort((a, b) => {
					const aInBounds = bounds.contains([a.lat, a.lon]);
					const bInBounds = bounds.contains([b.lat, b.lon]);
					if (aInBounds && !bInBounds) return -1;
					if (!aInBounds && bInBounds) return 1;
					return 0;
				});
			}
			
			
			if (fastPath && stopsToAdd.length > 10) {
				
				stopsToAdd.slice(0, 10).forEach(addMarker);
				
				
				setTimeout(() => {
					stopsToAdd.slice(10).forEach(addMarker);
				}, 50);
			} else {
				stopsToAdd.forEach(addMarker);
			}
		}
	}

	
	function clearAllMarkers() {
		if (!mapInstance) return;
		
		for (const marker of markers) {
			mapInstance.removeMarker(marker);
		}
		markers.length = 0; 
	}

	
	function addMarker(stop) {
		if (!mapInstance || !stop) return;

		
		if (markers.some(marker => marker.stop.id === stop.id)) {
			return;
		}

		let icon = faBus;

		
		if (stop.routes && stop.routes.length > 0) {
			const routeTypes = new Set(stop.routes.map(r => r.type));
			const prioritizedType = routePriorities.find(type => routeTypes.has(type)) || RouteType.UNKNOWN;
			icon = prioritizedRouteTypeForDisplay(prioritizedType);
		}

		
		const markerObj = mapInstance.addMarker({
			position: { lat: stop.lat, lng: stop.lon },
			icon,
			stop,
			onClick: () => handleStopMarkerSelect(stop)
		});

		markerObj.stop = stop;
		markers.push(markerObj);
	}

	function handleThemeChange(event) {
		const { darkMode } = event.detail;
		if (mapInstance) {
			mapInstance.setTheme(darkMode ? 'dark' : 'light');
		}
	}

	function handleLocationObtained(latitude, longitude) {
		if (!mapInstance) return;
		
		mapInstance.setCenter({ lat: latitude, lng: longitude });
		mapInstance.addUserLocationMarker({ lat: latitude, lng: longitude });
		userLocation.set({ lat: latitude, lng: longitude });
	}

	
	onMount(async () => {
		await initMap();
		isMapLoaded.set(true);
		
		if (browser) {
			const darkMode = document.documentElement.classList.contains('dark');
			
			
			window.addEventListener('planTripTabClicked', () => {
				isTripPlanModeActive = true;
			});
			
			window.addEventListener('tabSwitched', () => {
				isTripPlanModeActive = false;
			});
			
			window.dispatchEvent(new CustomEvent('themeChange', { detail: { darkMode } }));
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('themeChange', handleThemeChange);
			window.removeEventListener('planTripTabClicked', () => {});
			window.removeEventListener('tabSwitched', () => {});
		}
		
		
		if (mapInstance && mapInstance.map) {
			mapInstance.map.off('zoomstart');
			mapInstance.map.off('dragstart');
			mapInstance.map.off('zoomend');
			mapInstance.map.off('dragend');
			mapInstance.map.off('moveend');
		}
		
		clearAllMarkers();
	});

	
	$effect(() => {
		if (!mapInstance) return;
		
		if (selectedRoute) {
			clearAllMarkers();
		} else if (!isTripPlanModeActive && allStops.length > 0) {
			
			const existingStopIds = new Set(markers.map(m => m.stop.id));
			allStops
				.filter(stop => !existingStopIds.has(stop.id))
				.forEach(addMarker);
		}
	});

	$effect(() => {
		if (isTripPlanModeActive) {
			clearAllMarkers();
		}
	});
</script>

<div class="map-container">
	<div id="map" bind:this={mapElement}></div>

	{#if selectedTrip && showRouteMap}
		<RouteMap mapProvider={mapInstance} tripId={selectedTrip.tripId} />
	{/if}
</div>

<div class="controls">
	<LocationButton {handleLocationObtained} />
</div>

<style>
	.map-container {
		position: relative;
		height: 100%;
		width: 100%;
		z-index: 1;
	}
	#map {
		height: 100%;
		width: 100%;
	}
</style>