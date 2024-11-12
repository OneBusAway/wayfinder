<script>
	import { browser } from '$app/environment';
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
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

	export let selectedTrip = null;
	export let selectedRoute = null;
	export let showRoute = false;
	export let showRouteMap = false;
	export let showAllStops = true;
	export let stop = null;
	export let mapProvider = null;
	let isTripPlanMoodActive = false;

	let selectedStopID = null;

	const dispatch = createEventDispatcher();

	let mapInstance = null;
	let mapElement;

	let markers = [];
	let allStops = [];
	let routeReference = [];
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
		routeReference = stopsData.data.references.routes || [];

		allStops = [...new Map([...allStops, ...newStops].map((stop) => [stop.id, stop])).values()];

		if (selectedRoute && !showRoute) {
			allStops = [];
		} else if (showRoute && selectedRoute) {
			if (showRoute && selectedRoute) {
				const stopsToShow = allStops.filter((s) => s.routeIds.includes(selectedRoute.id));
				stopsToShow.forEach((s) => addMarker(s, routeReference));
			} else {
				newStops.forEach((s) => addMarker(s, routeReference));
			}
		}
	}

	function clearAllMarkers() {
		markers.forEach((markerObj) => {
			mapInstance.removeMarker(markerObj);
		});
		markers = [];
	}

	$: if (selectedRoute && !showRoute) {
		clearAllMarkers();
		allStops = [];
	}

	$: if (stop && mapInstance) {
		// TODO: make sure that these markers are deduped. i.e. we shouldn't
		// show the same stop twice on the map
		if (stop.id !== selectedStopID) {
			addMarker(stop);
		}
	}

	$: if (showAllStops) {
		allStops.forEach((s) => addMarker(s));
	}

	$: if (selectedRoute && showRoute) {
		clearAllMarkers();
		const stopsToShow = allStops.filter((s) => s.routeIds.includes(selectedRoute.id));
		stopsToShow.forEach((s) => addMarker(s));
	} else if (!showRoute || !selectedRoute) {
		allStops.forEach((s) => addMarker(s));
	}

	// TODO: prevent fetch stops-for-location if the trip planner mood is on - we should do this after merge.
	$: {
		if (isTripPlanMoodActive) {
			clearAllMarkers();
		} else {
			if (!selectedRoute || !showRoute) {
				allStops.forEach((s) => addMarker(s));
			}
		}
	}

	function addMarker(s, routeReference) {
		if (!mapInstance) {
			console.error('Map not initialized yet');
			return;
		}

		// check if the marker already exists
		const existingMarker = markers.find((marker) => marker.stop.id === s.id);

		// if it does, don't add it again
		if (existingMarker) {
			return;
		}

		let icon = faBus;

		if (routeReference && routeReference.length > 0) {
			const availableRoutes = s.routeIds
				.map((id) => routeReference.find((r) => r.id === id))
				.filter(Boolean);
			const routeTypes = new Set(availableRoutes.map((r) => r.type));
			const prioritizedType =
				routePriorities.find((type) => routeTypes.has(type)) || RouteType.UNKNOWN;
			icon = prioritizedRouteTypeForDisplay(prioritizedType);
		}

		const markerObj = mapInstance.addMarker({
			position: { lat: s.lat, lng: s.lon },
			icon: icon,
			stop: s,
			onClick: () => {
				selectedStopID = s.id;
				dispatch('stopSelected', { stop: s });
			}
		});

		markerObj.stop = s;
		markers.push(markerObj);
	}

	function handleThemeChange(event) {
		const { darkMode } = event.detail;
		mapInstance.setTheme(darkMode ? 'dark' : 'light');
	}

	function handleLocationObtained(event) {
		const { latitude, longitude } = event.detail;
		mapInstance.setCenter({ lat: latitude, lng: longitude });
		mapInstance.addUserLocationMarker({ lat: latitude, lng: longitude });
	}

	onMount(async () => {
		await initMap();
		isMapLoaded.set(true);
		if (browser) {
			const darkMode = document.documentElement.classList.contains('dark');
			window.addEventListener('planTripTabClicked', () => {
				isTripPlanMoodActive = true;
			});
			window.addEventListener('tabSwitched', () => {
				isTripPlanMoodActive = false;
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
</script>

<div class="map-container">
	<div id="map" bind:this={mapElement}></div>

	{#if selectedTrip && showRouteMap}
		<RouteMap mapProvider={mapInstance} tripId={selectedTrip.tripId} />
	{/if}
</div>

<div class="controls">
	<LocationButton on:locationObtained={handleLocationObtained} />
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
