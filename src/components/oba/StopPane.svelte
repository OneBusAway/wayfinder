<script>
	import ArrivalDeparture from '../ArrivalDeparture.svelte';
	import TripDetailsModal from '../navigation/TripDetailsModal.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	import '$lib/i18n.js';
	import { t } from 'svelte-i18n';

	export let stop;
	export let arrivalsAndDeparturesResponse = null;
	export let showAllStops = true;

	let arrivalsAndDepartures;
	let loading = false;
	let error;

	let showTripDetails = false;
	let selectedTripDetails = null;
	let interval;

	const dispatch = createEventDispatcher();

	async function loadData(stopID) {
		loading = true;

		const response = await fetch(`/api/oba/arrivals-and-departures-for-stop/${stopID}`);

		if (response.ok) {
			arrivalsAndDeparturesResponse = await response.json();
			arrivalsAndDepartures = arrivalsAndDeparturesResponse.data.entry;
		} else {
			error = 'Unable to fetch arrival/departure data';
		}

		loading = false;
	}

	$: if (showAllStops) {
		showTripDetails = false;
		selectedTripDetails = null;
	}

	$: (async (s, arrDep) => {
		// if the arrivalsAndDeparturesResponse is passed in, use that
		// instead of loading fresh data.
		if (arrDep) {
			arrivalsAndDepartures = arrDep.data.entry;
		} else {
			await loadData(s.id);
		}
	})(stop, arrivalsAndDeparturesResponse);

	onMount(() => {
		interval = setInterval(() => {
			loadData(stop.id);
		}, 30000);

		return () => clearInterval(interval);
	});

	let _routeShortNames = null;
	function routeShortNames() {
		if (!_routeShortNames) {
			_routeShortNames = arrivalsAndDeparturesResponse.data.references.routes
				.filter((r) => stop.routeIds.includes(r.id))
				.map((r) => r.nullSafeShortName)
				.sort();
		}
		return _routeShortNames;
	}
	function handleShowTripDetails(event) {
		selectedTripDetails = {
			...event.detail,
			routeShortName: event.detail.routeShortName,
			tripHeadsign: event.detail.tripHeadsign,
			scheduledArrivalTime: event.detail.scheduledArrivalTime
		};
		showTripDetails = true;
		dispatch('tripSelected', selectedTripDetails);
		dispatch('updateRouteMap', { show: true });
	}

	function handleCloseTripDetailModal() {
		showTripDetails = false;
		dispatch('tripSelected', null);
		dispatch('updateRouteMap', { show: false });
		dispatch('showAllStops');
	}
</script>

<div>
	{#if loading}
		<LoadingSpinner />
	{/if}

	{#if error}
		<p>{error}</p>
	{/if}

	{#if arrivalsAndDepartures}
		<div>
			<div>
				<div class="flex flex-col gap-y-1 rounded-lg bg-[#1C1C1E] bg-opacity-80 p-4">
					<h1 class="h1 mb-0 text-white">{stop.name}</h1>
					<h2 class="h2 mb-0 text-white">{$t('stop')} #{stop.id}</h2>
					{#if routeShortNames()}
						<h2 class="h2 mb-0 text-white">{$t('routes')}: {routeShortNames().join(', ')}</h2>
					{/if}
				</div>
			</div>
			<div>
				<h2 class="h2 ml-4 mt-4">{$t('arrivals_and_departures')}</h2>
			</div>
			<div class="scrollbar-hidden h-96 space-y-2 overflow-y-scroll rounded-lg">
				<div>
					{#each arrivalsAndDepartures.arrivalsAndDepartures as arrival}
						<ArrivalDeparture
							routeShortName={arrival.routeShortName}
							tripHeadsign={arrival.tripHeadsign}
							scheduledArrivalTime={arrival.scheduledArrivalTime}
							predictedArrivalTime={arrival.predictedArrivalTime}
							tripId={arrival.tripId}
							vehicleId={arrival.vehicleId}
							serviceDate={arrival.serviceDate}
							on:showTripDetails={handleShowTripDetails}
						/>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if showTripDetails}
		<TripDetailsModal {stop} {selectedTripDetails} onClose={handleCloseTripDetailModal} />
	{/if}
</div>

<style lang="postcss">
	.scrollbar-hidden {
		scrollbar-width: none;
		-ms-overflow-style: none;
		overflow: -moz-scrollbars-none;
		-webkit-scrollbar: none;
	}
</style>
