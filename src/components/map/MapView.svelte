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

	let markers = [];
	let stopsCache = new Map();

	function cacheKey(zoomLevel, boundingBox) {
		const decimalPlaces = 2; // 2 decimal places equals between 0.5 and 1.1 km depending on where you are in the world.
		const roundedBox = {
			north: boundingBox.north.toFixed(decimalPlaces),
			south: boundingBox.south.toFixed(decimalPlaces),
			east: boundingBox.east.toFixed(decimalPlaces),
			west: boundingBox.west.toFixed(decimalPlaces)
		};

		return `${roundedBox.north}_${roundedBox.south}_${roundedBox.east}_${roundedBox.west}_${zoomLevel}`;
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

		// merge the stops routeIds with the route data
		newStops.forEach((stop) => {
			stop.routes = stop.routeIds.map((routeId) => routeLookup.get(routeId)).filter(Boolean);
		});

		allStops = [...new Map([...allStops, ...newStops].map((stop) => [stop.id, stop])).values()];
	}

	function clearAllMarkers() {
		markers.forEach((markerObj) => {
			mapInstance.removeMarker(markerObj);
		});
		markers = [];
	}

	function updateMarkers() {
		if (!selectedRoute && !isTripPlanModeActive) {
			allStops.forEach((s) => addMarker(s));
		}
	}

	function addMarker(s) {
		if (!mapInstance) {
			console.error('Map not initialized yet');
			return;
		}

		// // check if the marker already exists
		const existingMarker = markers.find((marker) => marker.stop.id === s.id);

		// if it does, don't add it again
		if (existingMarker) {
			return;
		}

		let icon = faBus;

		if (s.routes && s.routes.length > 0) {
			const routeTypes = new Set(s.routes.map((r) => r.type));
			let prioritizedType = routePriorities.find((type) => routeTypes.has(type));
			if (prioritizedType === undefined) {
				prioritizedType = RouteType.UNKNOWN;
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

		markerObj.stop = s;
		markers.push(markerObj);
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
			const event = new CustomEvent('themeChange', { detail: { darkMode } });
			window.dispatchEvent(event);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('themeChange', handleThemeChange);
		}
		markers.forEach(({ markerObj, element }) => {
			mapProvider.removeMarker(markerObj);
			if (element && element.parentNode) {
				element.parentNode.removeChild(element);
			}
		});
	});
	$effect(() => {
		if (selectedRoute) {
			clearAllMarkers();
			updateMarkers();
		} else if (!isTripPlanModeActive) {
			allStops.forEach((s) => addMarker(s));
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
