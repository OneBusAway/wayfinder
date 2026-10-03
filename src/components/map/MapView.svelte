<script>
	// @ts-check
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import * as staticEnv from '$env/static/public';
	import { env } from '$env/dynamic/public';

	import { debounce } from '$lib/utils';
	import LocationButton from '$lib/LocationButton/LocationButton.svelte';
	import RouteMap from './RouteMap.svelte';
	import StopRoutesLayer from './StopRoutesLayer.svelte';

	import { isMapLoaded } from '$src/stores/mapStore';
	import { userLocation } from '$src/stores/userLocationStore';
	// Static exports depend on the build environment; a clean checkout may omit them.
	/** @type {Record<string, string | undefined>} */
	const { PUBLIC_OBA_REGION_CENTER_LAT: initialLat, PUBLIC_OBA_REGION_CENTER_LNG: initialLng } =
		staticEnv;
	/**
	 * @typedef {import('onebusaway-sdk/resources/arrival-and-departure').ArrivalAndDepartureListResponse.Data.Entry.ArrivalsAndDeparture} ArrivalAndDeparture
	 * @typedef {import('$lib/activeRoutes.js').ActiveRoute} ActiveRoute
	 * @typedef {import('$lib/activeRoutes.js').RouteColors} RouteColors
	 * @typedef {{ id: string, shortName?: string }} SelectedRoute
	 *
	 * @typedef {Object} Props
	 * @property {(stop: import('$lib/types').Stop) => void} handleStopMarkerSelect
	 * @property {ArrivalAndDeparture | null} [selectedTrip]
	 * @property {SelectedRoute | null} [selectedRoute]
	 * @property {boolean} [isRouteSelected]
	 * @property {boolean} [showRouteMap]
	 * @property {import('$lib/types').MapProvider | null} [mapProvider]
	 * @property {import('$lib/types').Stop | null} [stop] - Currently selected stop to preserve visual context
	 * @property {{ lat: number, lng: number } | null} [initialCoords] - Optional initial coordinates from URL params
	 * @property {ActiveRoute[]} [activeRoutes]
	 * @property {Map<string, RouteColors>} [routeColors]
	 * @property {boolean} [startInTripPlanMode] - Seeds the map's starting mode as trip-plan (not just the initial
	 *   stop load skip below) so a shared trip link never briefly renders in NORMAL mode before switching.
	 */
	/**
	 * @type {Props}
	 */
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
		routeColors = new Map(),
		startInTripPlanMode = false
	} = $props();

	// Highlight the vehicle by the trip it is actually running, not the trip of
	// the expanded row. For a laid-over bus the list shows only the next trip's
	// row (see collapseLayovers), while the vehicle feed keeps reporting the
	// finishing trip as active until the bus pulls out.
	let highlightedTripId = $derived(
		selectedTrip?.tripStatus?.activeTripId ?? selectedTrip?.tripId ?? null
	);

	let routeStopIds = $state(new Map());

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
		const selectedStop = stop;
		if (routeLayerActive && selectedStop) {
			// Non-selected stops collapse to quiet dots so the selected stop and the
			// drawn routes are the only loud things on the map.
			mapInstance.setStopEmphasis(emphasisByStopId, 'muted', selectedStop.id);
			mapInstance.setBasemapDimmed(true);
		} else {
			mapInstance.resetStopEmphasis();
			mapInstance.setBasemapDimmed(false);
		}
	});

	let isTripPlanModeActive = $state(startInTripPlanMode);
	/** @type {import('$lib/types').MapProvider | null} */
	let mapInstance = $state(null);
	let mapElement = $state();
	/** @type {import('$lib/types').Stop[]} */
	let allStops = $state([]);
	// O(1) lookup for existing stops
	/** @type {Map<string, import('$lib/types').Stop>} */
	let allStopsMap = new Map();
	let stopsCache = new Map();

	const Modes = {
		NORMAL: 'normal',
		TRIP_PLAN: 'tripPlan',
		ROUTE: 'route'
	};

	let mapMode = $state(startInTripPlanMode ? Modes.TRIP_PLAN : Modes.NORMAL);
	/** @type {ReturnType<typeof setTimeout> | null} */
	let modeChangeTimeout = null;
	/** @type {number | null} */
	let pendingMarkerBatch = null;
	/** @type {ReturnType<typeof debounce> | null} */
	let debouncedLoadMarkers = null;
	let isDestroyed = false;

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

	let previousMapMode = startInTripPlanMode ? Modes.TRIP_PLAN : Modes.NORMAL;

	$effect(() => {
		if (!mapInstance) return;
		const mode = mapMode;
		// Read allStops synchronously so this effect keeps re-rendering markers as
		// the list grows on subsequent map pans, regardless of which branch runs.
		const stops = allStops;
		if (mode === Modes.NORMAL) {
			// Returning from route/trip mode: the map may have moved far from
			// where stops were last loaded (e.g. opening a shared trip link
			// recenters the map), and stop loading is skipped while off NORMAL.
			// Refresh stops for the current viewport so the area isn't empty.
			if (previousMapMode !== Modes.NORMAL) {
				// Re-add whatever stops are already cached immediately (a no-op when
				// empty, e.g. a shared trip link that skipped the initial load) so
				// the map isn't left blank for the duration of the refresh below.
				// The refresh corrects this once the current viewport's stops land.
				batchAddMarkers(stops);

				const center = mapInstance.getCenter();
				if (!center) return;
				const zoomLevel = mapInstance.getZoom();
				loadStopsAndAddMarkers(center.lat, center.lng, false, zoomLevel)
					.then(() => batchAddMarkers(allStops))
					.catch((error) => console.error('Error refreshing stops on return to map:', error));
			} else {
				batchAddMarkers(stops);
			}
		} else {
			clearAllMarkers();
		}
		previousMapMode = mode;
	});

	/**
	 * @param {number} zoomLevel
	 * @param {{ north: number, south: number, east: number, west: number }} boundingBox
	 */
	function cacheKey(zoomLevel, boundingBox) {
		const multiplier = 100; // 2 decimal places
		const north = Math.round(boundingBox.north * multiplier);
		const south = Math.round(boundingBox.south * multiplier);
		const east = Math.round(boundingBox.east * multiplier);
		const west = Math.round(boundingBox.west * multiplier);

		return `${north}_${south}_${east}_${west}_${zoomLevel}`;
	}

	/**
	 * @returns {{ north: number, south: number, east: number, west: number } | null}
	 */
	function getBoundingBox() {
		if (!mapProvider) {
			throw new Error('Map provider is not initialized');
		}
		return mapProvider.getBoundingBox();
	}

	/**
	 * @param {number} lat
	 * @param {number} lng
	 * @param {number} zoomLevel
	 * @param {boolean} [firstCall]
	 * @returns {Promise<import('onebusaway-sdk/resources/stops-for-location').StopsForLocationListResponse | null>}
	 */
	async function loadStopsForLocation(lat, lng, zoomLevel, firstCall = false) {
		if (firstCall) {
			const response = await fetch(`/api/oba/stops-for-location?lat=${lat}&lng=${lng}&radius=2500`);
			if (!response.ok) {
				throw new Error('Failed to fetch locations');
			}
			return await response.json();
		}

		const boundingBox = getBoundingBox();
		if (!boundingBox) {
			// A provider can briefly have no valid extent while initializing or
			// tearing down. Never turn that into a Null Island stop request.
			return null;
		}
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
		if (!isDestroyed) stopsCache.set(key, stopsForLocation);

		return stopsForLocation;
	}

	async function initMap() {
		if (!mapProvider) return;
		try {
			// Use URL-provided coordinates if available, otherwise use region center
			const mapCenterLat = initialCoords?.lat ?? Number(initialLat);
			const mapCenterLng = initialCoords?.lng ?? Number(initialLng);

			await mapProvider.initMap(mapElement, {
				lat: mapCenterLat,
				lng: mapCenterLng
			});
			if (isDestroyed) return;

			mapInstance = mapProvider;

			// `initialCoords` only says where to center the map — it's a deep-linked
			// stop or ?lat/?lng, never a geolocation fix. Don't drop a "you are here"
			// dot on it or seed the userLocation store (which feeds the analytics
			// distance-to-stop bucket) with coordinates that aren't the user's.

			// Shared trip links enter trip-plan mode immediately; loading region-center
			// stops here would race with the itinerary and leave stray markers on the map.
			if (!startInTripPlanMode) {
				await loadStopsAndAddMarkers(mapCenterLat, mapCenterLng, true);
			}

			if (isDestroyed) return;

			debouncedLoadMarkers = debounce(async () => {
				if (isDestroyed || mapMode !== Modes.NORMAL || !mapInstance) {
					return;
				}

				const center = mapInstance.getCenter();
				if (!center) return;
				const zoomLevel = mapInstance.getZoom();
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

	/**
	 * @param {number} lat
	 * @param {number} lng
	 * @param {boolean} [firstCall]
	 * @param {number} [zoomLevel]
	 * @returns {Promise<void>}
	 */
	async function loadStopsAndAddMarkers(lat, lng, firstCall = false, zoomLevel = 15) {
		const stopsData = await loadStopsForLocation(lat, lng, zoomLevel, firstCall);
		if (isDestroyed || !stopsData) return;
		const newStops = stopsData.data.list;
		const routeReference = stopsData.data.references.routes || [];

		const routeLookup = new Map(routeReference.map((route) => [route.id, route]));

		// merge the stops routeIds with the route data and deduplicate efficiently
		newStops.forEach((stop) => {
			/** @type {import('$lib/types').Stop} */
			const stopWithRoutes = stop;
			if (!allStopsMap.has(stopWithRoutes.id)) {
				stopWithRoutes.routes =
					stopWithRoutes.routeIds
						?.map((routeId) => routeLookup.get(routeId))
						.filter((route) => route !== undefined) || [];
				allStopsMap.set(stopWithRoutes.id, stopWithRoutes);
			}
		});

		allStops = Array.from(allStopsMap.values());
	}

	function clearAllMarkers() {
		if (pendingMarkerBatch !== null) {
			cancelAnimationFrame(pendingMarkerBatch);
			pendingMarkerBatch = null;
		}
		if (mapInstance && mapInstance.clearAllStopMarkers) {
			mapInstance.clearAllStopMarkers();
		}
	}

	// Batch operation to add multiple markers efficiently
	/** @param {import('$lib/types').Stop[]} stops */
	function batchAddMarkers(stops) {
		if (isDestroyed || !mapInstance || mapMode !== Modes.NORMAL) {
			return;
		}

		const activeMap = mapInstance;
		if (!activeMap) return;

		const stopsToAdd = stops.filter((s) => !activeMap.hasMarker(s.id));

		if (stopsToAdd.length === 0) {
			return;
		}

		if (pendingMarkerBatch !== null) {
			cancelAnimationFrame(pendingMarkerBatch);
		}

		// Group DOM operations to minimize reflows/repaints. Re-check map mode when
		// the frame runs so a pending batch cannot repaint stops after trip mode clears them.
		pendingMarkerBatch = requestAnimationFrame(() => {
			pendingMarkerBatch = null;
			if (isDestroyed || !mapInstance || mapMode !== Modes.NORMAL) {
				return;
			}
			stopsToAdd.forEach((s) => addMarker(s));
		});
	}

	/** @param {import('$lib/types').Stop} s */
	function addMarker(s) {
		if (isDestroyed || !mapInstance || mapMode !== Modes.NORMAL) {
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

	/** @param {Event} event */
	function handleThemeChange(event) {
		if (!(event instanceof CustomEvent) || !mapInstance) return;
		const { darkMode } = /** @type {CustomEvent<{ darkMode: boolean }>} */ (event).detail;
		mapInstance.setTheme(darkMode ? 'dark' : 'light');
	}

	/**
	 * @param {number} latitude
	 * @param {number} longitude
	 */
	function handleLocationObtained(latitude, longitude) {
		if (!mapInstance) return;
		mapInstance.setCenter({ lat: latitude, lng: longitude });
		mapInstance.addUserLocationMarker({ lat: latitude, lng: longitude });
		userLocation.set({ lat: latitude, lng: longitude });
	}

	// Store event handlers for proper cleanup
	/** @type {(() => void) | null} */
	let planTripHandler = null;
	/** @type {(() => void) | null} */
	let tabSwitchHandler = null;

	onMount(async () => {
		isDestroyed = false;
		await initMap();
		if (isDestroyed) return;
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
		isDestroyed = true;
		debouncedLoadMarkers?.cancel?.();
		debouncedLoadMarkers = null;

		if (browser) {
			window.removeEventListener('themeChange', handleThemeChange);

			if (planTripHandler) window.removeEventListener('planTripTabClicked', planTripHandler);
			if (tabSwitchHandler) window.removeEventListener('tabSwitched', tabSwitchHandler);
		}

		if (modeChangeTimeout) {
			clearTimeout(modeChangeTimeout);
		}

		if (pendingMarkerBatch !== null) {
			cancelAnimationFrame(pendingMarkerBatch);
			pendingMarkerBatch = null;
		}

		clearAllMarkers();
		mapProvider?.destroy?.();

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
			{highlightedTripId}
			bind:routeStopIds
		/>
	{/if}

	<!-- RouteMap opens with clearAllPolylines() + removeStopMarkers(), which would
	     wipe the stop-selection layer. While a stop is selected, StopRoutesLayer
	     owns the map instead and expansion just promotes a route. -->
	{#if selectedTrip && showRouteMap && !stop}
		<RouteMap mapProvider={mapInstance} tripId={selectedTrip?.tripId} currentSelectedStop={stop} />
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
