<script>
	import { debounce } from '$lib/utils';
	import { createEventDispatcher, onMount } from 'svelte';
	import TripPlanSearchField from './TripPlanSearchField.svelte';
	import { error } from '@sveltejs/kit';
	import { browser } from '$app/environment';
	export let mapProvider;

	let fromPlace = '';
	let toPlace = '';
	let fromResults = [];
	let toResults = [];
	let selectedFrom = null;
	let selectedTo = null;
	let isLoadingFrom = false;
	let isLoadingTo = false;
	let fromMarker;
	let toMarker;
	let loading = false;

	const dispatch = createEventDispatcher();

	const fetchLocationResults = debounce(async (query, isFrom) => {
		if (isFrom) {
			isLoadingFrom = true;
		} else {
			isLoadingTo = true;
		}
		try {
			const response = await fetch(
				`/api/oba/google-place-autocomplete?query=${encodeURIComponent(query)}`
			);
			const data = await response.json();

			const results = data.suggestions
				? data.suggestions.map((suggestion) => ({
						placeId: suggestion.placePrediction.placeId,
						text: suggestion.placePrediction.text.text
					}))
				: [];

			if (isFrom) {
				fromResults = results;
			} else {
				toResults = results;
			}
		} catch (error) {
			console.error('Error fetching location results:', error);
		} finally {
			if (isFrom) {
				isLoadingFrom = false;
			} else {
				isLoadingTo = false;
			}
		}
	}, 500);

	async function geocodeLocation(location) {
		const response = await fetch(
			`/api/oba/google-geocode-location?query=${encodeURIComponent(location)}`
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
		if (isFrom) {
			const response = await geocodeLocation(suggestion.text);
			selectedFrom = response.location.geometry.location;
			fromMarker = mapProvider.addPinMarker(selectedFrom, 'From');
			fromPlace = suggestion.text;
			fromResults = [];
		} else {
			const response = await geocodeLocation(suggestion.text);
			selectedTo = response.location.geometry.location;
			toMarker = mapProvider.addPinMarker(selectedTo, 'To');
			toPlace = suggestion.text;
			toResults = [];
		}
	}

	function clearInput(isFrom) {
		if (isFrom) {
			fromPlace = '';
			fromResults = [];
			selectedFrom = null;
			mapProvider.removePinMarker(fromMarker);
		} else {
			toPlace = '';
			toResults = [];
			selectedTo = null;
			mapProvider.removePinMarker(toMarker);
		}
	}

	async function planTrip() {
		if (!selectedFrom || !selectedTo) {
			return;
		}

		loading = true;
		try {
			if (fromMarker) {
				mapProvider.removePinMarker(fromMarker);
			}
			if (toMarker) {
				mapProvider.removePinMarker(toMarker);
			}

			fromMarker = mapProvider.addPinMarker(selectedFrom, 'From');
			toMarker = mapProvider.addPinMarker(selectedTo, 'To');

			await geocodeLocation(selectedFrom);

			const response = await fetch(
				`/api/otp/plan?fromPlace=${selectedFrom.lat},${selectedFrom.lng}&toPlace=${selectedTo.lat},${selectedTo.lng}`
			);

			if (!response.ok) {
				console.error('Error planning trip:', response.statusText);
				return;
			}
			const data = await response.json();

			dispatch('tripPlanned', { data, fromMarker, toMarker });
		} finally {
			loading = false;
		}
	}

	// clear input fields when the tab is switched
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
		label="From:"
		place={fromPlace}
		results={fromResults}
		isLoading={isLoadingFrom}
		onInput={(query) => handleSearchInput(query, true)}
		onClear={() => clearInput(true)}
		onSelect={(location) => selectLocation(location, true)}
	/>

	<TripPlanSearchField
		label="To:"
		place={toPlace}
		results={toResults}
		isLoading={isLoadingTo}
		onInput={(query) => handleSearchInput(query, false)}
		onClear={() => clearInput(false)}
		onSelect={(location) => selectLocation(location, false)}
	/>

	<button
		on:click={planTrip}
		class="mt-4 flex w-full items-center justify-center rounded-md bg-green-500 py-2 text-white shadow-md
           transition-colors
           hover:bg-green-600
           disabled:cursor-not-allowed
           disabled:bg-gray-300
           dark:bg-green-800
           dark:hover:bg-green-900
           disabled:dark:bg-gray-700/50
           disabled:dark:text-gray-400"
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
			Planning...
		{:else}
			Plan Your Trip
		{/if}
	</button>
</div>
