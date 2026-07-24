<script>
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import {
		PUBLIC_OBA_REGION_CENTER_LAT as initialLat,
		PUBLIC_OBA_REGION_CENTER_LNG as initialLng
	} from '$env/static/public';
	import { env } from '$env/dynamic/public';

	import { debounce } from '$lib/utils';
	import LocationButton from '$lib/LocationButton/LocationButton.svelte';
	import RouteMap from './RouteMap.svelte';
	import StopRoutesLayer from './StopRoutesLayer.svelte';
	import RouteLegend from './RouteLegend.svelte';

	import { isMapLoaded } from '$src/stores/mapStore';
	import { userLocation } from '$src/stores/userLocationStore';
	/**
	 * @typedef {Object} Props
	 * @property {any} [selectedTrip]
	 * @property {any} [selectedRoute]
	 * @property {boolean} [showRoute]
	 * @property {boolean} [showRouteMap]
	 * @property {any} [mapProvider]
	 * @property {any} [stop] - Currently selected stop to preserve visual context
	 * @property {{ lat: number, lng: number } | null} [initialCoords] - Optional initial coordinates from URL params
	 */

	/** @type {Props} */
	let {
		handleStopMarkerSelect,
		selectedTrip = null,
		selectedRoute = null,
		isRouteSelected = false,
		showRouteMap = false,
		mapProvider = null,
		stop = null,
		initialCoords = null,
		activeRoutes = [],
		routeColors = new Map()
	} = $props();

	let routeStopIds = $state(new Map());
	let liveCounts = $state(new Map());

	// The layer only draws once the arrivals belong to this stop, so gate everything
	// on there actually being routes. A stop with no arrivals in-window keeps
	// today's map exactly — there's no catchable bus to point at, so dots on a
	// washed-out basemap would be noise.
	let routeLayerActive = $derived(!!stop && activeRoutes.length > 0);

	// Ring-dot tier for every stop the drawn routes serve.
	let emphasisByStopId = $derived(
		new Map(
			[...routeStopIds].map(([stopId, color]) => [
				stopId,
				{ emphasis: 'routeDot', dotColor: color }
			])
		)
	);

	$effect(() => {
		if (!mapInstance) return;
		if (routeLayerActive) {
			// Non-selected stops collapse to quiet dots so the selected stop and the
			// drawn routes are the only loud things on the map.
			mapInstance.setStopEmphasis(emphasisByStopId, 'muted', stop.id);
			mapInstance.setBasemapDimmed(true);
		} else {
			mapInstance.resetStopEmphasis();
			mapInstance.setBasemapDimmed(false);
		}
	});

	let isTripPlanModeActive = $state(false);
	let mapInstance = $state(null);
	let mapElement = $state();
	let allStops = $state([]);
	// O(1) lookup for existing stops
	let allStopsMap = new Map();
	let stopsCache = new Map();

	const Modes = {
		NORMAL: 'normal',
		TRIP_PLAN: 'tripPlan',
		ROUTE: 'route'
	};

	let mapMode = $state(Modes.NORMAL);
	let modeChangeTimeout = null;

	$effect(() => {
		let newMode;
		if (isTripPlanModeActive) {
			newMode = Modes.TRIP_PLAN;
			// A selected stop owns the map: expanding one of its arrival rows sets
			// selectedTrip/isRouteSelected/showRouteMap, and without this guard that
			// would flip us to ROUTE — whose effect clears every stop marker, exactly
			// when the stop-selection layer needs them tiered and on screen.
		} else if (!stop && (selectedRoute || isRouteSelected || showRouteMap || selectedTrip)) {
			newMode = Modes.ROUTE;
		} else {
			newMode = Modes.NORMAL;
		}
		if (modeChangeTimeout) {
			clearTimeout(modeChangeTimeout);
		}
		if (mapMode === Modes.ROUTE && newMode === Modes.NORMAL) {
			modeChangeTimeout = setTimeout(() => {
				mapMode = newMode;
			}, 100);
		} else if (mapMode !== newMode) {
			mapMode = newMode;
		}
	});

	$effect(() => {
		if (!mapInstance) return;
		if (mapMode === Modes.NORMAL) {
			batchAddMarkers(allStops);
		} else {
			clearAllMarkers();
		}
	});

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
			// Use URL-provided coordinates if available, otherwise use region center
			const mapCenterLat = initialCoords?.lat ?? Number(initialLat);
			const mapCenterLng = initialCoords?.lng ?? Number(initialLng);

			await mapProvider.initMap(mapElement, {
				lat: mapCenterLat,
				lng: mapCenterLng
			});

			mapInstance = mapProvider;

			// `initialCoords` only says where to center the map — it's a deep-linked
			// stop or ?lat/?lng, never a geolocation fix. Don't drop a "you are here"
			// dot on it or seed the userLocation store (which feeds the analytics
			// distance-to-stop bucket) with coordinates that aren't the user's.

			await loadStopsAndAddMarkers(mapCenterLat, mapCenterLng, true);

			const debouncedLoadMarkers = debounce(async () => {
				if (mapMode !== Modes.NORMAL) {
					return;
				}

				const center = mapInstance.getCenter();
				const zoomLevel = mapInstance.map.getZoom();
				await loadStopsAndAddMarkers(center.lat, center.lng, false, zoomLevel);
			}, 300);

			mapProvider.eventListeners(mapInstance, debouncedLoadMarkers);

			if (env.PUBLIC_OTP_SERVER_URL) {
				mapProvider.enableContextMenu();
			}

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
				stop.routes =
					stop.routeIds?.map((routeId) => routeLookup.get(routeId)).filter(Boolean) || [];
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

	// Batch operation to add multiple markers efficiently
	function batchAddMarkers(stops) {
		const stopsToAdd = stops.filter((s) => !mapInstance.hasMarker(s.id));

		if (stopsToAdd.length === 0) {
			return;
		}

		// Group DOM operations to minimize reflows/repaints
		requestAnimationFrame(() => {
			stopsToAdd.forEach((s) => addMarker(s));
		});
	}

	function addMarker(s) {
		if (!mapInstance) {
			console.error('Map not initialized yet');
			return;
		}

		if (mapInstance.hasMarker(s.id)) {
			return;
		}

		// Check if this marker should be highlighted (if it's the currently selected stop)
		const shouldHighlight = stop && s.id === stop.id;

		// Seeded here rather than patched after batchAddMarkers, which defers creation
		// into a rAF — a later setStopEmphasis() would iterate a markersMap that doesn't
		// hold these markers yet, and stops panned in mid-selection would stay full pins.
		const tier = routeLayerActive
			? (emphasisByStopId.get(s.id) ?? { emphasis: 'muted', dotColor: null })
			: null;

		const markerObj = mapInstance.addMarker({
			position: { lat: s.lat, lng: s.lon },
			stop: s,
			isHighlighted: shouldHighlight,
			emphasis: shouldHighlight ? 'full' : (tier?.emphasis ?? 'full'),
			// Gated the same way as emphasis: a selected stop always renders as a full
			// pin, so a leftover ring color here would be dead data — but leaving it
			// non-null was an easy trap for a future reader to assume it's live.
			dotColor: shouldHighlight ? null : (tier?.dotColor ?? null),
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
			planTripHandler = () => {
				isTripPlanModeActive = true;
			};
			tabSwitchHandler = () => {
				isTripPlanModeActive = false;
			};

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

		if (modeChangeTimeout) {
			clearTimeout(modeChangeTimeout);
		}

		clearAllMarkers();

		allStopsMap.clear();
		stopsCache.clear();
	});
</script>

<div class="map-container">
	<div id="map" bind:this={mapElement}></div>

	{#if mapInstance && stop && activeRoutes.length > 0}
		<StopRoutesLayer
			mapProvider={mapInstance}
			{activeRoutes}
			{routeColors}
			promotedRouteId={selectedRoute?.id ?? null}
			highlightedTripId={selectedTrip?.tripId ?? null}
			bind:routeStopIds
			bind:liveCounts
		/>
	{/if}

	<!-- RouteMap opens with clearAllPolylines() + removeStopMarkers(), which would
	     wipe the stop-selection layer. While a stop is selected, StopRoutesLayer
	     owns the map instead and expansion just promotes a route. -->
	{#if selectedTrip && showRouteMap && !stop}
		<RouteMap mapProvider={mapInstance} tripId={selectedTrip?.tripId} currentSelectedStop={stop} />
	{/if}

	<!-- The `stop ? … : []` ternary is defensive, not load-bearing: upstream,
	     MapExperience already gates activeRoutes on arrivalsMatchSelection, so
	     activeRoutes is guaranteed empty whenever stop is null. -->
	<RouteLegend routes={stop ? activeRoutes : []} {routeColors} {liveCounts} />
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
