<script>
	import SearchField from '$components/search/SearchField.svelte';
	import SearchResultItem from '$components/search/SearchResultItem.svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import { compassDirection } from '$lib/formatters';
	import { prioritizedRouteTypeForDisplay } from '$config/routeConfig';
	import { faMapPin, faSignsPost } from '@fortawesome/free-solid-svg-icons';
	import { t } from 'svelte-i18n';
	import { clearVehicleMarkersMap, fetchAndUpdateVehicles } from '$lib/vehicleUtils';
	import { calculateMidpoint } from '$lib/mathUtils';
	import { Tabs, TabItem } from 'flowbite-svelte';
	import { PUBLIC_OTP_SERVER_URL } from '$env/static/public';
	import TripPlan from '$components/trip-planner/TripPlan.svelte';
	import { isMapLoaded } from '$src/stores/mapStore';

	const dispatch = createEventDispatcher();

	export let cssClasses = '';
	export let mapProvider = null;

	let routes = null;
	let stops = null;
	let location = null;
	let query = null;
	let polylines = [];
	let currentIntervalId = null;
	let mapLoaded = false;

	function handleLocationClick(location) {
		clearResults();
		const lat = location.geometry.location.lat;
		const lng = location.geometry.location.lng;
		mapProvider.panTo(lat, lng);
		mapProvider.setZoom(20);
		dispatch('locationSelected', { location });
	}

	function handleStopClick(stop) {
		clearResults();
		mapProvider.panTo(stop.lat, stop.lon);
		mapProvider.setZoom(20);
		dispatch('stopSelected', { stop });
	}

	async function handleRouteClick(route) {
		clearResults();
		const response = await fetch(`/api/oba/stops-for-route/${route.id}`);
		const stopsForRoute = await response.json();
		const stops = stopsForRoute.data.references.stops;
		const polylinesData = stopsForRoute.data.entry.polylines;

		for (const polylineData of polylinesData) {
			const shape = polylineData.points;
			let polyline;
			polyline = mapProvider.createPolyline(shape);
			polylines.push(polyline);
		}

		await showStopsOnRoute(stops);
		currentIntervalId = await fetchAndUpdateVehicles(route.id, mapProvider);
		const midpoint = calculateMidpoint(stopsForRoute.data.references.stops);
		mapProvider.panTo(midpoint.lat, midpoint.lng);
		mapProvider.setZoom(12);
		dispatch('routeSelected', { route, stopsForRoute, stops, polylines, currentIntervalId });
	}

	async function showStopsOnRoute(stops) {
		for (const stop of stops) {
			mapProvider.addStopMarker(stop, null);
		}
	}

	function handleSearchResults(results) {
		routes = results.detail.routes;
		stops = results.detail.stops;
		location = results.detail.location;
		query = results.detail.query;
	}

	function handleViewAllRoutes() {
		dispatch('viewAllRoutes');
	}

	function clearResults() {
		if (polylines) {
			dispatch('clearResults', polylines);
		}
		routes = null;
		stops = null;
		location = null;
		query = null;

		clearVehicleMarkersMap();
		mapProvider.clearVehicleMarkers();
		clearInterval(currentIntervalId);
	}

	function handleTripPlan(event) {
		dispatch('tripPlanned', event.detail);
	}

	function handlePlanTripTabClick() {
		const event = new CustomEvent('planTripTabClicked');
		window.dispatchEvent(event);
	}

	function handleTabSwitch() {
		const event = new CustomEvent('tabSwitched');
		window.dispatchEvent(event);
	}

	onMount(() => {
		isMapLoaded.subscribe((value) => {
			mapLoaded = value;
		});

		window.addEventListener('routeSelectedFromModal', (event) => {
			handleRouteClick(event.detail.route);
		});
	});
</script>

<div class={`modal-pane flex flex-col justify-between md:w-96 ${cssClasses}`}>
	<Tabs tabStyle="underline" contentClass="pt-2 pb-4 bg-gray-50 rounded-lg dark:bg-black">
		<TabItem open title="Stops and Stations" on:click={handleTabSwitch}>
			<SearchField value={query} on:searchResults={handleSearchResults} />

			{#if query}
				<p class="text-sm text-gray-700 dark:text-gray-400">
					{$t('search.results_for')} "{query}".
					<button type="button" on:click={clearResults} class="text-blue-600 hover:underline">
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
						subtitle={location.types.join(', ')}
					/>
				{/if}

				{#if routes?.length > 0}
					{#each routes as route}
						<SearchResultItem
							on:click={() => handleRouteClick(route)}
							icon={prioritizedRouteTypeForDisplay(route.type)}
							title={`${$t('route')} ${route.nullSafeShortName || route.id}`}
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
							subtitle={`${compassDirection(stop.direction)}; Code: ${stop.code}`}
						/>
					{/each}
				{/if}
			</div>

			<div class="mt-0 sm:mt-0">
				<button
					type="button"
					class="hover:text -green-400 mt-3 text-sm font-medium text-green-600 underline focus:outline-none"
					on:click={handleViewAllRoutes}
				>
					{$t('search.click_here')}
				</button>
				<span class="text-sm font-medium text-black dark:text-white">
					{$t('search.for_a_list_of_available_routes')}</span
				>
			</div>
		</TabItem>

		{#if PUBLIC_OTP_SERVER_URL}
			<TabItem title="Plan a Trip" on:click={handlePlanTripTabClick} disabled={!mapLoaded}>
				<TripPlan {mapProvider} on:tripPlanned={handleTripPlan} />
			</TabItem>
		{/if}
	</Tabs>
</div>
