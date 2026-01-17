<script>
	import { debounce } from '$lib/utils';
	import { onMount, onDestroy } from 'svelte';
	import TripPlanSearchField from './TripPlanSearchField.svelte';
	import OptionsPill from './OptionsPill.svelte';
	import { browser } from '$app/environment';
	import { t } from 'svelte-i18n';
	import {
		tripOptions,
		showTripOptionsModal,
		formatWalkDistance,
		formatDepartureDisplay,
		effectiveDistanceUnit,
		DEFAULT_WALK_DISTANCE_METERS
	} from '$stores/tripOptionsStore';
	import { createRequestFromTripOptions, buildOTPParams, validateCoordinates } from '$lib/otp';

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
			throw new Error('Error fetching location results');
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
			throw new Error("Couldn't geocode location");
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
				fromMarker = mapProvider.addPinMarker(selectedFrom, $t('trip-planner.from'));
				fromPlace = suggestion.name;
				fromResults = [];
			} else {
				selectedTo = response.location.geometry.location;
				toMarker = mapProvider.addPinMarker(selectedTo, $t('trip-planner.to'));
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
			mapProvider.removePinMarker(fromMarker);
		} else {
			toPlace = '';
			toResults = [];
			selectedTo = null;
			mapProvider.removePinMarker(toMarker);
		}
	}

	async function fetchTripPlan(from, to) {
		// Validate coordinates before making API request
		const fromValidation = validateCoordinates(from);
		const toValidation = validateCoordinates(to);

		if (!fromValidation.valid || !toValidation.valid) {
			console.error('Invalid coordinates:', fromValidation.error || toValidation.error);
			return null;
		}

		try {
			const request = createRequestFromTripOptions(from, to, $tripOptions);
			const params = buildOTPParams(request);

			const url = `/api/otp/plan?${params}`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Error planning trip: ${response.statusText}`);
			}

			const data = await response.json();

			// Log the actual OTP server URL for debugging
			// if (data._otpUrl) {
			// 	console.log('OTP Server Request:', data._otpUrl);
			// }

			return data;
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
			if (fromMarker) {
				mapProvider.removePinMarker(fromMarker);
			}
			if (toMarker) {
				mapProvider.removePinMarker(toMarker);
			}

			fromMarker = mapProvider.addPinMarker(selectedFrom, $t('trip-planner.from'));
			toMarker = mapProvider.addPinMarker(selectedTo, $t('trip-planner.to'));

			const data = await fetchTripPlan(selectedFrom, selectedTo);

			if (data) {
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

	let tabSwitchedHandler;

	onMount(() => {
		if (browser) {
			tabSwitchedHandler = () => {
				clearInput(true);
				clearInput(false);
			};
			window.addEventListener('tabSwitched', tabSwitchedHandler);
		}
	});

	onDestroy(() => {
		if (browser && tabSwitchedHandler) {
			window.removeEventListener('tabSwitched', tabSwitchedHandler);
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

	<!-- Options Pills (only show non-default options) -->
	{#if $tripOptions.departureType !== 'now' || $tripOptions.wheelchair || $tripOptions.optimize === 'fewestTransfers' || $tripOptions.maxWalkDistance !== DEFAULT_WALK_DISTANCE_METERS}
		<div class="flex flex-wrap gap-1.5">
			{#if $tripOptions.departureType !== 'now'}
				<OptionsPill icon="🕐" label={formatDepartureDisplay($tripOptions, $t)} />
			{/if}
			{#if $tripOptions.wheelchair}
				<OptionsPill icon="♿" label={$t('trip-planner.wheelchair')} />
			{/if}
			{#if $tripOptions.optimize === 'fewestTransfers'}
				<OptionsPill icon="🔄" label={$t('trip-planner.fewest_transfers')} />
			{/if}
			{#if $tripOptions.maxWalkDistance !== DEFAULT_WALK_DISTANCE_METERS}
				<OptionsPill
					icon="🚶"
					label={formatWalkDistance($tripOptions.maxWalkDistance, $effectiveDistanceUnit)}
				/>
			{/if}
		</div>
	{/if}

	<!-- Button Row -->
	<div class="mt-4 flex items-center gap-2">
		<button
			type="button"
			onclick={() => showTripOptionsModal.set(true)}
			class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
		>
			{$t('trip-planner.options')}
		</button>
		<div class="flex-1"></div>
		<button
			onclick={planTrip}
			class="flex items-center justify-center rounded-md bg-brand px-4 py-2 text-brand-foreground shadow-md transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-green-800 dark:hover:bg-green-900 disabled:dark:bg-gray-700/50 disabled:dark:text-gray-400"
			disabled={!selectedFrom || !selectedTo}
		>
			{#if loading}
				<svg
					class="mr-2 h-5 w-5 animate-spin text-brand-foreground disabled:dark:text-gray-400"
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
</div>
