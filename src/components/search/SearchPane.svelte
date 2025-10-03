<script>
	import SearchField from '$components/search/SearchField.svelte';
	import SearchResultItem from '$components/search/SearchResultItem.svelte';
	import { onMount } from 'svelte';
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

	async function handleRouteClick(route) {
		mapProvider.clearAllPolylines();
		mapProvider.removeStopMarkers();
		mapProvider.clearVehicleMarkers();
		clearVehicleMarkersMap(mapProvider);
		clearResults();
		try {
			const response = await fetch(`/api/oba/stops-for-route/${route.id}`);
			const stopsForRoute = await response.json();
			const stops = stopsForRoute.data.references.stops;
			const polylinesData = stopsForRoute.data.entry.polylines;

			const midpoint = calculateMidpoint(stopsForRoute.data.references.stops);
			mapProvider.flyTo(midpoint.lat, midpoint.lng, 12);

			for (const polylineData of polylinesData) {
				const shape = polylineData.points;
				let polyline;
				polyline = mapProvider.createPolyline(shape);
				polylines.push(polyline);
			}

			await showStopsOnRoute(stops);
			currentIntervalId = await fetchAndUpdateVehicles(route.id, mapProvider);

			const routeData = {
				route,
				stops,
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
		<TabItem open title={$t('tabs.stops-and-stations')} on:click={handleTabSwitch}>
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
					class="mt-3 text-sm font-medium text-brand-secondary underline hover:text-brand focus:outline-none"
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
			<TabItem title={$t('tabs.plan_trip')} on:click={handlePlanTripTabClick} disabled={!mapLoaded}>
				<TripPlan {mapProvider} {handleTripPlan} />
			</TabItem>
		{/if}
	</Tabs>
</div>
