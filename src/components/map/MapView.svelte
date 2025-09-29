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
	let mapElement = $state();
	let allStops = $state([]);
	 // O(1) lookup for existing stops
	let allStopsMap = new Map();
	let stopsCache = new Map();

	function cacheKey(zoomLevel, boundingBox) {
		const multiplier = 100; // 2 decimal places
		const north = Math.round(boundingBox.north * multiplier);
		const south = Math.round(boundingBox.south * multiplier);
		const east = Math.round(boundingBox.east * multiplier);
		const west = Math.round(boundingBox.west * multiplier);

		return `${north}_${south}_${east}_${west}_${zoomLevel}`;
	}

	function getBoundingBox() {
		if (!mapProvider) {
			throw new Error('Map provider is not initialized');
		}
		return mapProvider.getBoundingBox();
	}

	async function loadStopsForLocation(lat, lng, zoomLevel, firstCall = false) {
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
			console.debug('Stop cache hit: ', key);
			return stopsCache.get(key);
		} else {
			console.debug('Stop cache miss: ', key);
		}

		const response = await fetch(
			`/api/oba/stops-for-location?lat=${lat}&lng=${lng}&latSpan=${boundingBox.north - boundingBox.south}&lngSpan=${boundingBox.east - boundingBox.west}&radius=1500`
		);

		if (!response.ok) {
			throw new Error('Failed to fetch locations');
		}

		const stopsForLocation = await response.json();
		stopsCache.set(key, stopsForLocation);

		return stopsForLocation;
	}

	async function initMap() {
		try {
			await mapProvider.initMap(mapElement, {
				lat: Number(initialLat),
				lng: Number(initialLng)
			});

			mapInstance = mapProvider;

			await loadStopsAndAddMarkers(initialLat, initialLng, true);

			const debouncedLoadMarkers = debounce(async () => {
				const center = mapInstance.getCenter();
				const zoomLevel = mapInstance.map.getZoom();

				// Prevent fetching stops in the background when a route is selected or trip plan mode is active, we only fetch stops when we are see other stops
				if (selectedRoute || showRoute || isTripPlanModeActive) {
					return;
				}
				await loadStopsAndAddMarkers(center.lat, center.lng, false, zoomLevel);
			}, 300);

			mapProvider.eventListeners(mapInstance, debouncedLoadMarkers);

			if (browser) {
				window.addEventListener('themeChange', handleThemeChange);
			}
		} catch (error) {
			console.error('Error initializing map:', error);
		}
	}

	async function loadStopsAndAddMarkers(lat, lng, firstCall = false, zoomLevel = 15) {
		const stopsData = await loadStopsForLocation(lat, lng, zoomLevel, firstCall);
		const newStops = stopsData.data.list;
		const routeReference = stopsData.data.references.routes || [];

		const routeLookup = new Map(routeReference.map((route) => [route.id, route]));

		// merge the stops routeIds with the route data and deduplicate efficiently
		newStops.forEach((stop) => {
			if (!allStopsMap.has(stop.id)) {
				stop.routes = stop.routeIds?.map((routeId) => routeLookup.get(routeId)).filter(Boolean) || [];
				allStopsMap.set(stop.id, stop);
			}
		});

		allStops = Array.from(allStopsMap.values());
	}

	function clearAllMarkers() {
		if (mapInstance && mapInstance.clearAllStopMarkers) {
			mapInstance.clearAllStopMarkers();
		}
	}

	function updateMarkers() {
		if (!selectedRoute && !isTripPlanModeActive) {
			batchAddMarkers(allStops);
		}
	}

	// Batch operation to add multiple markers efficiently
	function batchAddMarkers(stops) {
		const stopsToAdd = stops.filter(s => !mapInstance.hasMarker(s.id));
		
		if (stopsToAdd.length === 0) return;
		
		// Group DOM operations to minimize reflows/repaints
		requestAnimationFrame(() => {
			stopsToAdd.forEach(s => addMarker(s));
		});
	}

	function addMarker(s) {
		if (!mapInstance) {
			console.error('Map not initialized yet');
			return;
		}

		// Delegate marker existence check to provider
		if (mapInstance.hasMarker(s.id)) {
			return;
		}

		let icon = faBus;

		if (s.routes && s.routes.length > 0) {
			const routeTypes = s.routes.map((r) => r.type);
			let prioritizedType = RouteType.UNKNOWN;
			
			// Optimized priority lookup - check highest priority first
			for (const priority of routePriorities) {
				if (routeTypes.includes(priority)) {
					prioritizedType = priority;
					break;
				}
			}
			
			icon = prioritizedRouteTypeForDisplay(prioritizedType);
		}

		const markerObj = mapInstance.addMarker({
			position: { lat: s.lat, lng: s.lon },
			icon: icon,
			stop: s,
			onClick: () => {
				handleStopMarkerSelect(s);
			}
		});

		return markerObj;
	}

	function handleThemeChange(event) {
		const { darkMode } = event.detail;
		mapInstance.setTheme(darkMode ? 'dark' : 'light');
	}

	function handleLocationObtained(latitude, longitude) {
		mapInstance.setCenter({ lat: latitude, lng: longitude });
		mapInstance.addUserLocationMarker({ lat: latitude, lng: longitude });
		userLocation.set({ lat: latitude, lng: longitude });
	}

	// Store event handlers for proper cleanup
	let planTripHandler, tabSwitchHandler;

	onMount(async () => {
		await initMap();
		isMapLoaded.set(true);
		if (browser) {
			const darkMode = document.documentElement.classList.contains('dark');
			
			// Store handlers for cleanup
			planTripHandler = () => { isTripPlanModeActive = true; };
			tabSwitchHandler = () => { isTripPlanModeActive = false; };
			
			window.addEventListener('planTripTabClicked', planTripHandler);
			window.addEventListener('tabSwitched', tabSwitchHandler);
			
			const event = new CustomEvent('themeChange', { detail: { darkMode } });
			window.dispatchEvent(event);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('themeChange', handleThemeChange);
		
			if (planTripHandler) window.removeEventListener('planTripTabClicked', planTripHandler);
			if (tabSwitchHandler) window.removeEventListener('tabSwitched', tabSwitchHandler);
		}

		clearAllMarkers();
		
		allStopsMap.clear();
		stopsCache.clear();
	});
	$effect(() => {
		if (selectedRoute) {
			clearAllMarkers();
			updateMarkers();
		} else if (!isTripPlanModeActive) {
			batchAddMarkers(allStops);
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
