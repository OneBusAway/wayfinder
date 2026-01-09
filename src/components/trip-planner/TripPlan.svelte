<script>
	import { debounce } from '$lib/utils';
	import { onMount } from 'svelte';
	import TripPlanSearchField from './TripPlanSearchField.svelte';
	import { error } from '@sveltejs/kit';
	import { browser } from '$app/environment';
	import { t } from 'svelte-i18n';
	let { handleTripPlan, mapProvider } = $props();

	let fromPlace = $state('');
	let toPlace = $state('');
	let fromResults = $state([]);
	let toResults = $state([]);
	let selectedFrom = $state(null);
	let selectedTo = $state(null);
	let isLoadingFrom = $state(false);
	let isLoadingTo = $state(false);
	let fromMarker;
	let toMarker;
	let loading = $state(false);
	let lockSelectLocation = false;

	async function fetchAutocompleteResults(query) {
		const response = await fetch(`/api/oba/place-suggestions?query=${encodeURIComponent(query)}`);

		if (!response.ok) {
			throw error('Error fetching location results', 500);
		}
		const data = await response.json();

		return data.suggestions;
	}

	const fetchLocationResults = debounce(async (query, isFrom) => {
		isLoadingFrom = isFrom;
		isLoadingTo = !isFrom;

		try {
			const results = await fetchAutocompleteResults(query);

			isFrom ? (fromResults = results) : (toResults = results);
		} catch (error) {
			console.error('Error fetching location results:', error);
		} finally {
			isLoadingFrom = false;
			isLoadingTo = false;
		}
	}, 500);

	async function geocodeLocation(locationName) {
		const response = await fetch(
			`/api/oba/geocode-location?query=${encodeURIComponent(locationName)}`
		);

		if (!response.ok) {
			throw error("Couldn't geocode location", 500);
		}

		const geocodeLocationData = await response.json();

		return geocodeLocationData;
	}

	async function handleSearchInput(query, isFrom) {
		if (query.trim() === '') {
			if (isFrom) fromResults = [];
			else toResults = [];
			return;
		}
		await fetchLocationResults(query, isFrom);
	}

	async function selectLocation(suggestion, isFrom) {
		if (lockSelectLocation) return;
		lockSelectLocation = true;
		try {
			const response = await geocodeLocation(suggestion.name);
			if (isFrom) {
				selectedFrom = response.location.geometry.location;
				fromPlace = suggestion.name;
				fromResults = [];
			} else {
				selectedTo = response.location.geometry.location;
				toPlace = suggestion.name;
				toResults = [];
			}
		} catch (error) {
			console.error('Error selecting location:', error);
		} finally {
			lockSelectLocation = false;
		}
	}

	function clearInput(isFrom) {
		if (isFrom) {
			fromPlace = '';
			fromResults = [];
			selectedFrom = null;
		} else {
			toPlace = '';
			toResults = [];
			selectedTo = null;
		}
	}

	async function fetchTripPlan(from, to) {
		try {
			const response = await fetch(
				`/api/otp/plan?fromPlace=${from.lat},${from.lng}&toPlace=${to.lat},${to.lng}`
			);

			if (!response.ok) {
				throw new Error(`Error planning trip: ${response.statusText}`);
			}

			return await response.json();
		} catch (error) {
			console.error(error.message);
			return null;
		}
	}

	async function planTrip() {
		if (!selectedFrom || !selectedTo) {
			return;
		}

		loading = true;
		try {
			const data = await fetchTripPlan(selectedFrom, selectedTo);

			if (data) {
				if (fromMarker) {
					mapProvider.removePinMarker(fromMarker);
				}
				if (toMarker) {
					mapProvider.removePinMarker(toMarker);
				}

				fromMarker = mapProvider.addPinMarker(selectedFrom, $t('trip-planner.from'));
				toMarker = mapProvider.addPinMarker(selectedTo, $t('trip-planner.to'));

				const tripPlanData = {
					data,
					fromMarker,
					toMarker
				};
				handleTripPlan(tripPlanData);
			}
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (browser) {
			window.addEventListener('tabSwitched', () => {
				clearInput(true);
				clearInput(false);
			});
		}
	});
</script>

<div class="space-y-4">
	<TripPlanSearchField
		label="{$t('trip-planner.from')}:"
		place={fromPlace}
		results={fromResults}
		isLoading={isLoadingFrom}
		onInput={(query) => handleSearchInput(query, true)}
		onClear={() => clearInput(true)}
		onSelect={(location) => selectLocation(location, true)}
	/>

	<TripPlanSearchField
		label="{$t('trip-planner.to')}:"
		place={toPlace}
		results={toResults}
		isLoading={isLoadingTo}
		onInput={(query) => handleSearchInput(query, false)}
		onClear={() => clearInput(false)}
		onSelect={(location) => selectLocation(location, false)}
	/>

	<button
		onclick={planTrip}
		class="mt-4 flex w-full items-center justify-center rounded-md bg-brand py-2 text-white shadow-md transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-green-800 dark:hover:bg-green-900 disabled:dark:bg-gray-700/50 disabled:dark:text-gray-400"
		disabled={!selectedFrom || !selectedTo}
	>
		{#if loading}
			<svg
				class="mr-2 h-5 w-5 animate-spin text-white disabled:dark:text-gray-400"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
			</svg>
			{$t('trip-planner.planning')}...
		{:else}
			{$t('trip-planner.plan_your_trip')}
		{/if}
	</button>
</div>
