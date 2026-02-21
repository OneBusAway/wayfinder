<script>
	import SearchField from '$components/search/SearchField.svelte';
	import SearchResultItem from '$components/search/SearchResultItem.svelte';
	import { onMount, onDestroy, tick } from 'svelte';
	import { prioritizedRouteTypeForDisplay } from '$config/routeConfig';
	import { faMapPin, faSignsPost } from '@fortawesome/free-solid-svg-icons';
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
		cssClasses = '',
		mapProvider = null,
		childContent
	} = $props();

	let routes = $state(null);
	let stops = $state(null);
	let location = $state(null);
	let query = $state(null);
	let polylines = [];
	let currentIntervalId = null;
	let mapLoaded = $state(false);
	let isSurveyAnswered = $state(false);
	let activeTab = $state('stops');

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
		mapProvider.clearAllPolylines();
		mapProvider.removeStopMarkers();
		mapProvider.clearVehicleMarkers();
		clearVehicleMarkersMap();
		clearResults();
		try {
			const response = await fetch(`/api/oba/stops-for-route/${route.id}`);
			const stopsForRoute = await response.json();
			const stopsMap = new Map(stopsForRoute.data.references.stops.map((stop) => [stop.id, stop]));
			const polylinesData = stopsForRoute.data.entry.polylines;

			const stopGroupings = stopsForRoute.data.entry.stopGroupings;
			let orderedStops = extractOrderedStops(stopGroupings, stopsMap);

			if (orderedStops.length === 0) {
				orderedStops = stopsForRoute.data.references.stops;
			}

			const midpoint = calculateMidpoint(orderedStops);
			mapProvider.flyTo(midpoint.lat, midpoint.lng, 12);

			for (const polylineData of polylinesData) {
				const shape = polylineData.points;
				let polyline;
				polyline = mapProvider.createPolyline(shape);
				polylines.push(polyline);
			}

			await showStopsOnRoute(orderedStops, route.type);
			// Clear any existing interval first to prevent memory leaks
			if (currentIntervalId) {
				clearInterval(currentIntervalId);
				currentIntervalId = null;
			}
			currentIntervalId = await fetchAndUpdateVehicles(route.id, mapProvider, route.type);

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
		activeTab = 'plan';
		handlePlanTripTabClick();
		await tick();
		window.dispatchEvent(new CustomEvent('setTripPlanLocation', { detail: e.detail }));
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

<div
	class={`modal-pane flex flex-col justify-between bg-white/80 backdrop-blur-sm md:w-96 ${cssClasses}`}
>
	<Tabs
		tabStyle="none"
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
					class="mt-3 text-sm font-medium text-brand-accent underline hover:text-brand focus:outline-none"
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
				<TripPlan {mapProvider} {handleTripPlan} />
			</TabItem>
		{/if}
	</Tabs>
</div>
