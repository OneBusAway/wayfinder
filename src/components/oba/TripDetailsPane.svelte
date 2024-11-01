<script>
	import { onMount, onDestroy } from 'svelte';
	import { faBus, faPersonWalking } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	export let stop;
	export let tripId;
	export let serviceDate = null;

	let tripDetails = null;
	let routeInfo = null;
	let stopInfo = {};
	let error = null;
	let interval;
	let busPosition = 0;

	function formatTime(seconds) {
		if (!seconds) return '';
		const date = new Date(seconds * 1000);
		const utcDate = new Date(date.toUTCString().slice(0, -4));
		return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

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
					<div class="relative mb-4 flex items-center">
						<div
							class="relative z-10 flex size-8 items-center justify-center rounded-md border border-neutral-400 bg-white dark:bg-neutral-800"
						>
							{#if index === busPosition}
								<FontAwesomeIcon
									icon={faBus}
									class="absolute bg-white text-xl text-green-500 dark:bg-black"
								/>
							{/if}
							{#if tripStop.stopId === stop.id}
								<FontAwesomeIcon
									icon={faPersonWalking}
									class="absolute bottom-0 right-0 size-2 rounded-br-md rounded-tl-md border-l border-t bg-neutral-50/80 px-1 py-0.5 text-sm text-blue-500 dark:bg-black"
								/>
							{/if}
						</div>
						<div class="ml-4 flex w-full items-center justify-between">
							<div class="text-md font-semibold text-[#000000] dark:text-white">
								{stopInfo[tripStop.stopId] ? stopInfo[tripStop.stopId].name : tripStop.stopId}
							</div>
							<div class="text-sm text-[#86858B]">{formatTime(tripStop.arrivalTime)}</div>
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
