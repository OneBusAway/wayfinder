<script>
	import { onMount, onDestroy } from 'svelte';
	import { faBus, faLocationDot, faCheck } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { formatSecondsFromMidnight } from '$lib/formatters';

	/**
	 * @typedef {Object} Props
	 * @property {any} stop
	 * @property {any} tripId
	 * @property {any} [serviceDate]
	 */

	/** @type {Props} */
	let { stop, tripId, serviceDate = null } = $props();

	let tripDetails = $state(null);
	let routeInfo = $state(null);
	let stopInfo = $state({});
	let error = $state(null);
	let interval;
	let busPosition = $state(0);

	function calculateBusPosition() {
		if (tripDetails && tripDetails.status && tripDetails.status.position) {
			const { lat, lon } = tripDetails.status.position;

			busPosition = tripDetails.schedule.stopTimes.findIndex((stop, index, array) => {
				const nextStop = array[index + 1];
				if (!nextStop) return true;
				const stopLat = stopInfo[stop.stopId].lat;
				const stopLon = stopInfo[stop.stopId].lon;
				const nextStopLat = stopInfo[nextStop.stopId].lat;
				const nextStopLon = stopInfo[nextStop.stopId].lon;
				return (lat >= stopLat && lat < nextStopLat) || (lon >= stopLon && lon < nextStopLon);
			});
		}
	}

	async function loadTripDetails() {
		try {
			let url = `/api/oba/trip-details/${tripId}?includeTrip=true&includeSchedule=true&includeStatus=true`;
			if (serviceDate) {
				url += `&serviceDate=${serviceDate}`;
			}
			const response = await fetch(url);

			if (!response.ok) {
				error = 'Unable to fetch trip details';
				return;
			}

			const jsonBody = await response.json();
			const data = jsonBody.data;

			tripDetails = data.entry;

			if (data?.references?.routes) {
				routeInfo = data.references.routes.find((route) => route.id === tripDetails.routeId);
			}

			if (data?.references?.stops) {
				stopInfo = data.references.stops.reduce((acc, stop) => {
					acc[stop.id] = stop;
					return acc;
				}, {});
			}

			calculateBusPosition();
		} catch (err) {
			console.error('Error fetching trip details:', err);
			error = 'Error fetching trip details';
		}
	}

	onMount(() => {
		loadTripDetails();
		interval = setInterval(loadTripDetails, 30000);
	});

	onDestroy(() => {
		clearInterval(interval);
		interval = null;
	});
</script>

<div class="trip-details-pane">
	{#if error}
		<p>{error}</p>
	{:else if tripDetails}
		<h2 class="h2">
			{#if routeInfo}
				Route {routeInfo.shortName} -
			{/if}
		</h2>
		{#if tripDetails.schedule?.stopTimes.length > 0}
			<div class="relative">
				<div class="absolute bottom-0 left-3.5 top-0 w-[1px] bg-neutral-400"></div>

				{#each tripDetails.schedule.stopTimes as tripStop, index}
					<div class="mb-4 flex items-center">
						<div
							class="relative flex size-8 items-center justify-center rounded-md border border-neutral-400 bg-white dark:bg-neutral-800"
						>
							{#if index === busPosition && tripStop.stopId === stop.id}
								<FontAwesomeIcon
									icon={faBus}
									class="absolute bg-white text-xl text-brand dark:bg-black"
								/>
								<!-- Green checkmark to show "bus has arrived to the stop" -->
								<FontAwesomeIcon
									icon={faCheck}
									class="absolute -right-1 -top-1 rounded-full border border-white bg-brand p-1 text-xs text-white"
								/>
							{:else if index === busPosition}
								<FontAwesomeIcon
									icon={faBus}
									class="absolute bg-white text-xl text-brand dark:bg-black"
								/>
							{:else if tripStop.stopId === stop.id}
								<FontAwesomeIcon icon={faLocationDot} class="text-md text-green-500" />
							{/if}
						</div>
						<div class="ml-4 flex w-full items-center justify-between space-x-1">
							<div class="text-md font-semibold dark:text-white">
								{stopInfo[tripStop.stopId] ? stopInfo[tripStop.stopId].name : tripStop.stopId}
							</div>
							<div class="whitespace-nowrap text-sm text-gray-500">
								{formatSecondsFromMidnight(tripStop.arrivalTime)}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-black dark:text-white">No stop times available for this trip.</p>
		{/if}
	{:else}
		<p class="text-black dark:text-white">Loading trip details...</p>
	{/if}
</div>
