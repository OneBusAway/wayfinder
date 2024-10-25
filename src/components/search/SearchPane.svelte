<script>
	import SearchField from '$components/search/SearchField.svelte';
	import SearchResultItem from '$components/search/SearchResultItem.svelte';
	import { createEventDispatcher } from 'svelte';
	import { compassDirection } from '$lib/formatters';
	import { prioritizedRouteTypeForDisplay } from '$config/routeConfig';
	import { faMapPin, faSignsPost } from '@fortawesome/free-solid-svg-icons';
	import { t } from 'svelte-i18n';

	const dispatch = createEventDispatcher();

	let routes = null;
	let stops = null;
	let location = null;
	let query = null;
	let polylines = [];

	export let mapProvider = null;

	const activeTripMap = new Map();

	/**
	 * @type {Map<string, marker>}
	 * using activeTripId as key instead of vehicleId
	 * see https://developer.onebusaway.org/api/where/elements/trip-status
	 *
	 */
	const vehicleMarkersMap = new Map();

	function handleLocationClick(location) {
		if (polylines) {
			dispatch('clearResults', polylines);
		}

		clearResults();

		const lat = location.geometry.location.lat;
		const lng = location.geometry.location.lng;

		mapProvider.panTo(lat, lng);
		mapProvider.setZoom(20);

		dispatch('locationSelected', { location });
	}

	function handleStopClick(stop) {
		if (polylines) {
			dispatch('clearResults', polylines);
		}

		clearResults();

		mapProvider.panTo(stop.lat, stop.lon);
		mapProvider.setZoom(20);

		dispatch('stopSelected', { stop });
	}

	async function handleRouteClick(route) {
		if (polylines) {
			dispatch('clearResults', polylines);
		}

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

		let routeLat = stopsForRoute.data.references.stops[0].lat;
		let routeLon = stopsForRoute.data.references.stops[0].lon;

		await showStopsOnRoute(stops);
		await fetchAndUpdateVehicles(route.id);
		mapProvider.setZoom(11);

		mapProvider.panTo(routeLat, routeLon);

		dispatch('routeSelected', { route, stopsForRoute, stops, polylines });
	}

	async function showStopsOnRoute(stops) {
		for (const stop of stops) {
			mapProvider.addStopMarker(stop, null);
		}
	}

	async function fetchVehicles(routeId) {
		const response = await fetch(`/api/oba/trips-for-route/${routeId}`);
		const responseBody = await response.json();
		return responseBody.data || {};
	}

	async function updateVehicleMarkers(routeId) {
		const data = await fetchVehicles(routeId);

		const activeTripIds = new Set();

		for (const trip of data.references.trips) {
			if (!activeTripMap.has(trip.id)) {
				activeTripMap.set(trip.id, trip);
			}
		}

		for (const tripStatus of data.list) {
			const activeTripId = tripStatus.status.activeTripId;
			const activeTripRoute = activeTripMap.get(activeTripId);

			if (
				activeTripRoute &&
				activeTripRoute.routeId === routeId &&
				tripStatus.status !== 'CANCELED'
			) {
				const vehicleStatus = tripStatus.status;

				activeTripIds.add(activeTripId);

				if (vehicleMarkersMap.has(activeTripId)) {
					const marker = vehicleMarkersMap.get(activeTripId);
					mapProvider.updateVehicleMarker(marker, vehicleStatus);
				} else {
					const marker = mapProvider.addVehicleMarker(vehicleStatus);
					vehicleMarkersMap.set(activeTripId, marker);
				}
			}
		}

		removeInactiveMarkers(activeTripIds);
	}

	function removeInactiveMarkers(activeTripIds) {
		for (const [activeTripId, marker] of vehicleMarkersMap) {
			if (!activeTripIds.has(activeTripId)) {
				mapProvider.removeVehicleMarker(marker);
				vehicleMarkersMap.delete(activeTripId);
			}
		}
	}

	async function fetchAndUpdateVehicles(routeId) {
		await updateVehicleMarkers(routeId);

		setInterval(() => updateVehicleMarkers(routeId), 30000);
	}

	function handleSearchResults(results) {
		routes = results.detail.routes;
		stops = results.detail.stops;
		location = results.detail.location;
		query = results.detail.query;
	}

	function clearResults() {
		routes = null;
		stops = null;
		location = null;
		query = null;
		vehicleMarkersMap.clear();
		activeTripMap.clear();
	}
</script>

<div
	class="bg-blur-sm flex w-96 justify-between rounded-lg border-gray-500 bg-white/90 px-4 shadow-lg dark:bg-black dark:text-white dark:shadow-lg dark:shadow-gray-200/10"
>
	<div class="flex w-full flex-col gap-y-4 py-4">
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
	</div>
</div>
