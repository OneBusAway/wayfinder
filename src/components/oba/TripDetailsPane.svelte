<script>
	import { _ } from 'svelte-i18n';
	import { onMount, onDestroy } from 'svelte';
	import {
		faBus,
		faLocationDot,
		faCheck,
		faTowerBroadcast
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { formatSecondsFromMidnight } from '$lib/dateTimeFormat';
	import { resolveVehicleStopIndex, buildStopSegments } from '$lib/tripDetailsUtils';

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
	let busPosition = $state(-1);
	let abortController = null;

	// Rows to render for the segment from the vehicle's current position through
	// the rider's selected stop: stops already passed and stops beyond the rider's
	// stop are hidden, and a long run of stops in the middle is collapsed into a
	// single "N stops" marker (mirroring the iOS trip view).
	let stopSegments = $derived(
		buildStopSegments(tripDetails?.schedule?.stopTimes, busPosition, stop.id)
	);

	// Locate the vehicle along the trip using the stop IDs the server reports for
	// exactly this purpose. `closestStop` is the stop nearest the vehicle's
	// current position; fall back to `nextStop`. (The previous approach compared
	// raw lat/lon ranges, which assumed stops were ordered monotonically by
	// coordinate and so highlighted the wrong stop on most route directions.)
	function calculateBusPosition() {
		busPosition = resolveVehicleStopIndex(tripDetails?.status, tripDetails?.schedule?.stopTimes);
	}

	async function loadTripDetails() {
		// Cancel the previous request if it exists
		if (abortController) {
			abortController.abort();
		}
		abortController = new AbortController();

		try {
			let url = `/api/oba/trip-details/${tripId}?includeTrip=true&includeSchedule=true&includeStatus=true`;
			if (serviceDate) {
				url += `&serviceDate=${serviceDate}`;
			}
			const response = await fetch(url, {
				signal: abortController.signal
			});

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
			if (err.name !== 'AbortError') {
				console.error('Error fetching trip details:', err);
				error = 'Error fetching trip details';
			}
		}
	}

	onMount(() => {
		loadTripDetails();
		interval = setInterval(loadTripDetails, 30000);
	});

	onDestroy(() => {
		clearInterval(interval);
		interval = null;
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
	});
</script>

<div class="trip-details-pane">
	{#if error}
		<p>{error}</p>
	{:else if tripDetails}
		{#if tripDetails.status?.vehicleId}
			<h2 class="flex items-center gap-2 text-sm font-semibold">
				<FontAwesomeIcon icon={faTowerBroadcast} class="text-brand" />
				{$_('trip_details.live_vehicle', { values: { vehicleId: tripDetails.status.vehicleId } })}
			</h2>
		{:else if routeInfo}
			<h2 class="text-sm font-semibold">
				{$_('trip_details.route')}
				{routeInfo.shortName}
			</h2>
		{/if}
		{#if tripDetails.schedule?.stopTimes.length > 0}
			<div>
				{#each stopSegments as segment, i (segment.type === 'stop' ? `stop-${segment.index}` : 'collapsed')}
					{@const isFirst = i === 0}
					{@const isLast = i === stopSegments.length - 1}
					{#if segment.type === 'collapsed'}
						<div class="flex items-stretch">
							<div class="relative flex w-8 shrink-0 justify-center">
								<!-- Zig-zag connector standing in for the collapsed stops. It IS this
								     row's rail segment, so it joins the straight rail above and below
								     without needing an opaque mask. -->
								<svg
									class="text-neutral-400"
									width="16"
									height="56"
									viewBox="0 0 16 56"
									fill="none"
									aria-hidden="true"
								>
									<path
										d="M8 0 L8 8 L12 16 L4 24 L12 32 L4 40 L8 48 L8 56"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linejoin="round"
									/>
								</svg>
							</div>
							<div class="ml-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
								{$_('trip_details.collapsed_stops', { values: { count: segment.count } })}
							</div>
						</div>
					{:else}
						{@const index = segment.index}
						{@const tripStop = tripDetails.schedule.stopTimes[index]}
						<div class="flex items-stretch">
							<div class="relative flex w-8 shrink-0 justify-center">
								<!-- Per-row rail line, centered on the marker. Trimmed to a half at
								     the first and last rows so it never overshoots the endpoints. -->
								{#if !(isFirst && isLast)}
									<div
										class="absolute w-px bg-neutral-400 {isFirst
											? 'bottom-0 top-1/2'
											: isLast
												? 'top-0 h-1/2'
												: 'inset-y-0'}"
									></div>
								{/if}
								<div
									class="relative my-2 flex size-8 items-center justify-center {index ===
									busPosition
										? 'rounded-md bg-neutral-800 dark:bg-neutral-200'
										: ''}"
								>
									{#if index === busPosition}
										<FontAwesomeIcon
											icon={faBus}
											class="text-sm text-white dark:text-neutral-900"
										/>
										{#if tripStop.stopId === stop.id}
											<FontAwesomeIcon
												icon={faCheck}
												class="absolute -right-1 -top-1 rounded-full border border-white bg-brand p-1 text-xs text-white"
											/>
										{/if}
									{:else if tripStop.stopId === stop.id}
										<FontAwesomeIcon icon={faLocationDot} class="text-xl text-brand-accent" />
									{:else}
										<div
											class="size-4 rounded-full border-2 border-neutral-400 bg-white dark:bg-neutral-800"
										></div>
									{/if}
								</div>
							</div>
							<div class="ml-4 flex flex-1 items-center justify-between space-x-1">
								<div
									class="text-md dark:text-white {tripStop.stopId === stop.id
										? 'font-bold'
										: 'font-semibold'}"
								>
									{stopInfo[tripStop.stopId] ? stopInfo[tripStop.stopId].name : tripStop.stopId}
								</div>
								<div class="whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
									{formatSecondsFromMidnight(tripStop.arrivalTime)}
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<p class="text-black dark:text-white">{$_('trip_details.no_stops')}</p>
		{/if}
	{:else}
		<p class="text-black dark:text-white">{$_('trip_details.loading')}</p>
	{/if}
</div>
