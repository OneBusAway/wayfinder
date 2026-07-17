<script>
	import SearchField from '$components/search/SearchField.svelte';
	import SearchResultItem from '$components/search/SearchResultItem.svelte';
	import { onMount, onDestroy, tick } from 'svelte';
	import { prioritizedRouteTypeForDisplay } from '$config/routeConfig';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faMapPin, faSignsPost, faX } from '@fortawesome/free-solid-svg-icons';
	import { t } from 'svelte-i18n';
	import { clearVehicleMarkersMap, fetchAndUpdateVehicles } from '$lib/vehicleUtils';
	import { calculateMidpoint } from '$lib/mathUtils';
	import { Tabs, TabItem } from 'flowbite-svelte';
	import { env } from '$env/dynamic/public';
	import TripPlan from '$components/trip-planner/TripPlan.svelte';
	import { isMapLoaded } from '$src/stores/mapStore';
	import { answeredSurveys, surveyStore } from '$stores/surveyStore';
	import { removeAgencyPrefix } from '$lib/utils';
	import { browser } from '$app/environment';

	let {
		handleRouteSelected,
		handleViewAllRoutes,
		handleStopMarkerSelect,
		handleTripPlan,
		clearTripItineraries,
		cssClasses = '',
		mapProvider = null,
		onCollapse = null,
		collapsed = false,
		childContent
	} = $props();

	let routes = $state(null);
	let stops = $state(null);
	let location = $state(null);
	let query = $state(null);
	let polylines = [];
	let currentIntervalId = null;
	// Bumped on every route click so a slower, superseded load can detect a newer
	// click took over (after one of its awaits) and bail instead of fighting the
	// newer route for the camera, stop markers, and vehicle polling.
	let routeLoadToken = 0;
	let mapLoaded = $state(false);
	let isSurveyAnswered = $state(false);
	let activeTab = $state('stops');
	let isContextMenuTrigger = false;

	function handleLocationClick(location) {
		clearResults();
		const lat = location.geometry.location.lat;
		const lng = location.geometry.location.lng;
		mapProvider.panTo(lat, lng);
		mapProvider.setZoom(20);
	}

	function handleStopClick(stop) {
		clearResults();

		const markerOptions = {
			stop: stop,
			position: { lat: stop.lat, lng: stop.lon },
			onClick: () => handleStopMarkerSelect(stop)
		};
		mapProvider.addMarker(markerOptions);

		mapProvider.flyTo(stop.lat, stop.lon, 20);

		setTimeout(() => {
			handleStopMarkerSelect(stop);
		}, 100);
	}

	/**
	 * Extracts and deduplicates stops from the OBA API stopGroupings structure.
	 * Iterates through the nested stopGroupings to build a flat, ordered list of unique stops.
	 * Maintains the order of stops as they appear in the groupings while preventing duplicates.
	 *
	 * @param {Array} stopGroupings - Array of stop grouping objects from the OBA API, where each
	 *                                 grouping contains stopGroups with arrays of stopIds
	 * @param {Map<string, Object>} stopsMap - Map of stop IDs to stop objects for quick lookups
	 * @returns {Array<Object>} Ordered array of unique stop objects
	 */
	function extractOrderedStops(stopGroupings, stopsMap) {
		if (!stopGroupings) return [];
		if (stopGroupings.length === 0) return [];

		let orderedStops = [];
		let seenStopIds = new Set();

		stopGroupings.forEach((grouping) => {
			if (!grouping.stopGroups || grouping.stopGroups.length === 0) return;

			grouping.stopGroups.forEach((group) => {
				if (!group || group.stopIds.length === 0) return;

				group.stopIds.forEach((stopId) => {
					if (!seenStopIds.has(stopId)) {
						const stop = stopsMap.get(stopId);
						if (stop) {
							orderedStops.push(stop);
							seenStopIds.add(stopId);
						}
					}
				});
			});
		});

		return orderedStops;
	}

	async function handleRouteClick(route) {
		const loadToken = ++routeLoadToken;
		mapProvider.clearAllPolylines();
		mapProvider.removeStopMarkers();
		mapProvider.clearVehicleMarkers();
		clearVehicleMarkersMap();
		clearResults();
		try {
			const response = await fetch(`/api/oba/stops-for-route/${route.id}`);
			if (loadToken !== routeLoadToken) return;

			if (!response.ok) {
				console.error(`Failed to fetch route data: ${response.status}`);
				return;
			}

			const stopsForRoute = await response.json();
			if (loadToken !== routeLoadToken) return;

			const stopsMap = new Map(stopsForRoute.data.references.stops.map((stop) => [stop.id, stop]));
			const polylinesData = stopsForRoute.data.entry.polylines;

			const stopGroupings = stopsForRoute.data.entry.stopGroupings;
			let orderedStops = extractOrderedStops(stopGroupings, stopsMap);

			if (orderedStops.length === 0) {
				orderedStops = stopsForRoute.data.references.stops;
			}

			// Draw the route shapes first so the view can fit their full extent.
			// Reset the collection so each route click rebuilds it from scratch
			// rather than accumulating stale references from previous selections.
			polylines = [];
			for (const polylineData of polylinesData) {
				const polyline = await mapProvider.createPolyline(polylineData.points);
				if (loadToken !== routeLoadToken) return;
				// createPolyline returns null for an undecodable shape (on either
				// provider); skip it so one bad segment degrades the route instead
				// of leaving a null hole in the polylines array.
				if (polyline) polylines.push(polyline);
			}

			// Fit the view to the full route so it's always centered and visible
			// regardless of route length. Fall back to the stops' midpoint when no
			// polyline could be drawn. Awaiting the fit lets the stop markers appear
			// in sync with the route reveal instead of popping in beforehand.
			const fitted = await mapProvider.fitToPolylines?.();
			// A newer route click took over while the camera was settling; leave the
			// map to that newer load instead of yanking it back to this route.
			if (loadToken !== routeLoadToken) return;
			if (!fitted) {
				const midpoint = calculateMidpoint(orderedStops);
				if (midpoint) {
					mapProvider.flyTo(midpoint.lat, midpoint.lon, 12);
				}
			}

			await showStopsOnRoute(orderedStops);
			if (loadToken !== routeLoadToken) return;
			// Clear any existing interval first to prevent memory leaks
			if (currentIntervalId) {
				clearInterval(currentIntervalId);
				currentIntervalId = null;
			}
			const intervalId = await fetchAndUpdateVehicles(route.id, mapProvider, route.type);
			if (loadToken !== routeLoadToken) {
				// Superseded while polling was starting; tear down this stale
				// interval rather than overwriting the newer load's id.
				clearInterval(intervalId);
				return;
			}
			currentIntervalId = intervalId;

			const routeData = {
				route,
				stops: orderedStops,
				polylines,
				currentIntervalId
			};

			handleRouteSelected(routeData);
		} catch (error) {
			console.error('Error fetching route data:', error);
		}
	}

	async function showStopsOnRoute(stops) {
		for (const stop of stops) {
			mapProvider.addStopRouteMarker(stop, null);
		}
	}

	function handleSearchResults(results) {
		routes = results.routes;
		stops = results.stops;
		location = results.location;
		query = results.query;
	}

	function clearResults() {
		if (polylines) {
			mapProvider.clearAllPolylines();
		}
		routes = null;
		stops = null;
		location = null;
		query = null;

		clearVehicleMarkersMap();
		mapProvider.clearVehicleMarkers();
		clearInterval(currentIntervalId);
		currentIntervalId = null;
	}

	function handlePlanTripTabClick() {
		const event = new CustomEvent('planTripTabClicked');
		window.dispatchEvent(event);
	}

	function handleTabSwitch() {
		if (isContextMenuTrigger) return;

		if (activeTab === 'plan') {
			window.dispatchEvent(new CustomEvent('tripPlanModalClosed'));
			clearTripItineraries();
		}
		const event = new CustomEvent('tabSwitched');
		window.dispatchEvent(event);
	}

	$effect(() => {
		if ($surveyStore && $surveyStore.id) {
			isSurveyAnswered = $answeredSurveys[$surveyStore.id] === true;
		} else {
			isSurveyAnswered = false;
		}
	});

	let unsubscribeMapLoaded;

	function handleRouteSelectedFromModal(event) {
		handleRouteClick(event.detail.route);
	}

	async function handleContextMenuTripPlan(e) {
		isContextMenuTrigger = true;
		activeTab = 'plan';
		await tick();
		window.dispatchEvent(new CustomEvent('setTripPlanLocation', { detail: e.detail }));
		isContextMenuTrigger = false;
	}

	onMount(() => {
		unsubscribeMapLoaded = isMapLoaded.subscribe((value) => {
			mapLoaded = value;
		});

		window.addEventListener('routeSelectedFromModal', handleRouteSelectedFromModal);
		window.addEventListener('contextMenuTripPlan', handleContextMenuTripPlan);
	});

	onDestroy(() => {
		if (unsubscribeMapLoaded) {
			unsubscribeMapLoaded();
		}
		if (browser) {
			window.removeEventListener('routeSelectedFromModal', handleRouteSelectedFromModal);
			window.removeEventListener('contextMenuTripPlan', handleContextMenuTripPlan);
		}
		if (currentIntervalId) {
			clearInterval(currentIntervalId);
			currentIntervalId = null;
		}
	});
</script>

<!-- Collapsing hides the pane below md only (a floating stand-in field takes its
     place there); md and up always shows it, so `collapsed` restores this root's
     own flex display at that breakpoint. -->
<div
	class={`modal-pane flex flex-col justify-between bg-white/80 backdrop-blur-sm md:w-96 ${collapsed ? 'hidden md:flex' : ''} ${cssClasses}`}
>
	<Tabs
		tabStyle="none"
		role="tablist"
		activeClasses="bg-none border-b-2 border-brand-accent py-3 px-4"
		inactiveClasses="py-3 px-4"
		contentClass="pt-2 pb-4 rounded-lg dark:bg-surface-dark"
	>
		<TabItem
			open={activeTab === 'stops'}
			title={$t('tabs.stops-and-stations')}
			on:click={() => {
				handleTabSwitch();
				activeTab = 'stops';
			}}
		>
			<SearchField value={query} {handleSearchResults} />

			{#if !isSurveyAnswered && $surveyStore}
				<div class="mt-2">
					{@render childContent()}
				</div>
			{/if}

			{#if query}
				<p class="text-sm text-gray-700 dark:text-gray-400">
					{$t('search.results_for')} "{query}".
					<button type="button" onclick={clearResults} class="text-blue-600 hover:underline">
						{$t('search.clear_results')}
					</button>
				</p>
			{/if}

			<div class="max-h-96 overflow-y-auto">
				{#if location}
					<SearchResultItem
						on:click={() => handleLocationClick(location)}
						title={location.formatted_address}
						icon={faMapPin}
						subtitle={location?.types?.join(', ') || location.name}
					/>
				{/if}

				{#if routes?.length > 0}
					{#each routes as route}
						<SearchResultItem
							on:click={() => handleRouteClick(route)}
							icon={prioritizedRouteTypeForDisplay(route.type)}
							title={`${$t('route')} ${removeAgencyPrefix(route.nullSafeShortName || route.id)}`}
							subtitle={route.description}
						/>
					{/each}
				{/if}
				{#if stops?.length > 0}
					{#each stops as stop}
						<SearchResultItem
							on:click={() => handleStopClick(stop)}
							icon={faSignsPost}
							title={stop.name}
							subtitle={`${stop.direction ? $t(`direction.${stop.direction}`) : ''}; Code: ${stop.code}`}
						/>
					{/each}
				{/if}
			</div>

			<div class="mt-0 sm:mt-0">
				<button
					type="button"
					class="mt-3 text-sm font-medium text-brand-accent underline hover:text-brand focus:outline-none dark:text-brand dark:hover:text-white"
					onclick={handleViewAllRoutes}
				>
					{$t('search.click_here')}
				</button>
				<span class="text-sm font-medium text-black dark:text-white">
					{$t('search.for_a_list_of_available_routes')}</span
				>
			</div>
		</TabItem>

		{#if env.PUBLIC_OTP_SERVER_URL}
			<TabItem
				open={activeTab === 'plan'}
				title={$t('tabs.plan_trip')}
				on:click={() => {
					handlePlanTripTabClick();
					activeTab = 'plan';
				}}
				disabled={!mapLoaded}
			>
				<TripPlan {mapProvider} {handleTripPlan} {clearTripItineraries} />
			</TabItem>
		{/if}

		{#if onCollapse}
			<!-- Collapsing to the floating pill is a sub-md affordance; on wider
			     viewports the pane always stays open. -->
			<li role="presentation" class="ms-auto self-center md:hidden">
				<button type="button" onclick={onCollapse} class="close-button">
					<FontAwesomeIcon icon={faX} class="font-black text-black dark:text-white" />
					<span class="sr-only">{$t('search.collapse')}</span>
				</button>
			</li>
		{/if}
	</Tabs>
</div>
