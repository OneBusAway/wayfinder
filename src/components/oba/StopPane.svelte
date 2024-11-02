<script>
	import ArrivalDeparture from '../ArrivalDeparture.svelte';
	import TripDetailsModal from '../navigation/TripDetailsModal.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import { onDestroy } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	import '$lib/i18n.js';
	import { t } from 'svelte-i18n';
	import ModalHeader from '$components/modals/ModalHeader.svelte';

	export let stop;
	export let arrivalsAndDeparturesResponse = null;
	export let showAllStops = true;

	let arrivalsAndDepartures;
	let loading = false;
	let error;

	let showTripDetails = false;
	let selectedTripDetails = null;
	let interval = null;

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

	function resetDataFetchInterval(stopID) {
		if (interval) clearInterval(interval);

		loadData(stopID);

		interval = setInterval(() => {
			loadData(stopID);
		}, 30000);
	}

	$: if (showAllStops) {
		showTripDetails = false;
		selectedTripDetails = null;
	}

	$: if (stop?.id) {
		resetDataFetchInterval(stop.id);
	}

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	let _routeShortNames = null;
	function routeShortNames() {
		if (!_routeShortNames && arrivalsAndDeparturesResponse?.data?.references?.routes) {
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
		<div class="space-y-4">
			<ModalHeader
				title={stop.name}
				subtitle="{$t('stop')} #{stop.id}"
				caption="{$t('routes')}: {routeShortNames()?.join(', ')}"
			/>

			{#if arrivalsAndDepartures.arrivalsAndDepartures.length === 0}
				<div class="flex h-96 items-center justify-center">
					<p>{$t('no_arrivals_or_departures_in_next_30_minutes')}</p>
				</div>
			{:else}
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
			{/if}
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
