<script>
	import BottomSheet from '$components/navigation/BottomSheet.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import ItineraryDetails from './ItineraryDetails.svelte';
	import ItineraryTab from './ItineraryTab.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faX } from '@fortawesome/free-solid-svg-icons';
	import { keybinding } from '$lib/keybinding';
	import { onDestroy, onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { notifyPartialRouteShape } from '$lib/routeNotifications';
	import { notifications } from '$stores/notificationStore';

	/**
	 * @typedef {Object} Props
	 * @property {any} mapProvider
	 * @property {any} [itineraries]
	 * @property {any} [error]
	 * @property {boolean} [loading]
	 * @property {Function} closePane
	 * @property {('peek'|'half'|'full')} [snap]
	 */

	/** @type {Props} */
	let {
		mapProvider,
		itineraries = [],
		error = null,
		loading = false,
		closePane,
		snap = $bindable('half')
	} = $props();

	let expandedSteps = $state({});
	let activeTab = $state(0);
	let itineraryTabsContainer = $state(null);
	let prevItinerariesRef = $state(null);

	function toggleSteps(index) {
		expandedSteps[index] = !expandedSteps[index];
		expandedSteps = { ...expandedSteps };
	}

	function setActiveTab(index) {
		activeTab = index;
		drawRoute();
	}

	let currPolylines = [];

	// Build per-leg polyline style based on mode and route color
	function getLegPolylineStyle(leg) {
		if (leg.mode === 'WALK') {
			return {
				color: '#888888',
				weight: 4,
				opacity: 0.7,
				dashArray: '8, 12',
				withArrow: false
			};
		}
		return {
			color: leg.routeColor ? `#${leg.routeColor}` : undefined,
			weight: 8,
			opacity: 0.8,
			withArrow: false
		};
	}

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

		let drawnCount = 0;
		let legCount = 0;

		for (const leg of itineraries[activeTab].legs) {
			const shape = leg.legGeometry?.points;
			if (!shape) continue;
			legCount++;
			const style = getLegPolylineStyle(leg);
			// Await: the Google provider's createPolyline is async and returns
			// null on decode failure — skip nulls instead of tracking a Promise.
			const polyline = await mapProvider.createPolyline(shape, style);
			if (polyline) {
				currPolylines.push(polyline);
				drawnCount++;
			}
		}

		if (legCount > 0 && drawnCount < legCount) {
			notifyPartialRouteShape();
		}
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
		if (browser && itineraryTabsContainer) {
			itineraryTabsContainer.addEventListener('wheel', handleWheel, { passive: false });
		}
	});

	$effect(() => {
		// Reset choice when itinerary results change
		if (itineraries !== prevItinerariesRef && itineraries?.length > 0) {
			prevItinerariesRef = itineraries;
			activeTab = 0;
			drawRoute();
		}
	});

	onDestroy(() => {
		// Partial-shape warnings auto-dismiss, but clear immediately on close so
		// they don't linger over the next view.
		notifications.dismiss();
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

<BottomSheet bind:snap>
	{#snippet header()}
		<div class="flex items-center gap-2.5">
			<p class="min-w-0 flex-1 truncate text-base font-semibold text-black dark:text-white">
				{$t('trip-planner.trip_itineraries')}
			</p>
			<button
				type="button"
				onclick={closePane}
				use:keybinding={{ code: 'Escape' }}
				class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-200 text-sm text-black hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
			>
				<FontAwesomeIcon icon={faX} />
				<span class="sr-only">{$t('sheet.close')}</span>
			</button>
		</div>
	{/snippet}

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
</BottomSheet>

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
