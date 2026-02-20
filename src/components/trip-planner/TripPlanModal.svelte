<script>
	import ModalPane from '$components/navigation/ModalPane.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import ItineraryDetails from './ItineraryDetails.svelte';
	import ItineraryTab from './ItineraryTab.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { browser } from '$app/environment';

	/**
	 * @typedef {Object} Props
	 * @property {any} mapProvider
	 * @property {any} [itineraries]
	 * @property {boolean} [loading]
	 * @property {any} [fromMarker]
	 * @property {any} [toMarker]
	 */

	/** @type {Props} */
	let {
		mapProvider,
		itineraries = [],
		error = null,
		loading = false,
		fromMarker = null,
		toMarker = null,
		closePane
	} = $props();

	let expandedSteps = $state({});
	let activeTab = $state(0);
	let itineraryTabsContainer = $state(null);

	function toggleSteps(index) {
		expandedSteps[index] = !expandedSteps[index];
		expandedSteps = { ...expandedSteps };
	}

	function setActiveTab(index) {
		activeTab = index;
		drawRoute();
	}

	let currPolylines = [];
	let polylineStyle = {
		weight: 8,
		opacity: 0.8,
		withArrow: false
	};

	// draw the current itinerary route based on the active itinerary tab
	async function drawRoute() {
		if (currPolylines.length > 0) {
			currPolylines.forEach((polyline) => {
				mapProvider.removePolyline(polyline);
			});
			currPolylines = [];
		}

		if (!itineraries?.length || !itineraries[activeTab]?.legs) {
			return;
		}

		itineraries[activeTab].legs.forEach((leg) => {
			const shape = leg.legGeometry.points;
			const polyline = mapProvider.createPolyline(shape, polylineStyle, true);
			currPolylines.push(polyline);
		});
	}

	/**
	 * Converts vertical wheel input into horizontal scrolling for the itinerary tabs.
	 * Only active on screens at or above the md breakpoint (768px).
	 * @param {WheelEvent} e
	 */
	function handleWheel(e) {
		if (!browser || !itineraryTabsContainer) return;

		// Only apply on large screens (md breakpoint and above)
		const isLargeScreen = window.innerWidth >= 768;
		if (!isLargeScreen) return;

		// Prevent default vertical scroll
		e.preventDefault();

		// Scroll horizontally based on vertical wheel delta
		itineraryTabsContainer.scrollLeft += e.deltaY;
	}

	onMount(() => {
		if (itineraries?.length > 0) {
			drawRoute();
		}

		if (browser && itineraryTabsContainer) {
			itineraryTabsContainer.addEventListener('wheel', handleWheel, { passive: false });
		}
	});
	onDestroy(() => {
		mapProvider.removePinMarker(fromMarker);
		mapProvider.removePinMarker(toMarker);

		if (currPolylines.length > 0) {
			currPolylines.forEach(async (polyline) => {
				mapProvider.removePolyline(await polyline);
			});
		}

		if (browser && itineraryTabsContainer) {
			itineraryTabsContainer.removeEventListener('wheel', handleWheel);
		}
	});
</script>

<ModalPane {closePane} title={$t('trip-planner.trip_itineraries')}>
	{#if loading}
		<LoadingSpinner />
	{/if}

	{#if itineraries.length > 0}
		<div class="itinerary-tabs" bind:this={itineraryTabsContainer}>
			{#each itineraries as itinerary, index}
				<ItineraryTab {index} {activeTab} {setActiveTab} {itinerary} />
			{/each}
		</div>

		<div class="py-4">
			{#if itineraries[activeTab]}
				{#key activeTab}
					<div class="animate-fade-in">
						<ItineraryDetails itinerary={itineraries[activeTab]} {expandedSteps} {toggleSteps} />
					</div>
				{/key}
			{/if}
		</div>
	{:else if !loading}
		<div class="flex h-full flex-col items-center justify-center gap-3 py-12">
			<p class="text-gray-400 dark:text-gray-500">
				{$t('trip-planner.no_itineraries_found')}
			</p>
			{#if error}
				<div
					class="mx-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20"
				>
					<p class="text-sm text-red-700 dark:text-red-400">{error.msg}</p>
					<p class="mt-1 text-xs text-red-500/70 dark:text-red-500/50">
						{$t('trip-planner.error_code')}: {error.id}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</ModalPane>

<style>
	.animate-fade-in {
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
