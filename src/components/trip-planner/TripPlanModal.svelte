<script>
	import BottomSheet from '$components/navigation/BottomSheet.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import ItineraryDetails from './ItineraryDetails.svelte';
	import ItineraryTab from './ItineraryTab.svelte';
	import TripPlan from './TripPlan.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faX } from '@fortawesome/free-solid-svg-icons';
	import { keybinding } from '$lib/keybinding';
	import { onDestroy, onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { notifyPartialRouteShape } from '$lib/routeNotifications';
	import { notifications } from '$stores/notificationStore';
	import { panelFitPadding } from '$lib/mapFitPadding.js';
	import { calculateMidpoint } from '$lib/mathUtils.js';

	/**
	 * @typedef {Object} Props
	 * @property {any} mapProvider
	 * @property {any} [itineraries]
	 * @property {any} [error]
	 * @property {boolean} [loading]
	 * @property {Function} closePane
	 * @property {('peek'|'half'|'full')} [snap]
	 * @property {boolean} [showForm] - When true (mobile plan sheet), embed From/To form in this sheet
	 * @property {Function} [handleTripPlan] - Required when showForm is true
	 * @property {Function} [clearTripItineraries] - Required when showForm is true
	 */

	/** @type {Props} */
	let {
		mapProvider,
		itineraries = [],
		error = null,
		loading = false,
		closePane,
		snap = $bindable('half'),
		showForm = false,
		handleTripPlan = null,
		clearTripItineraries = null
	} = $props();

	let expandedSteps = $state({});
	let activeTab = $state(0);
	let itineraryTabsContainer = $state(null);
	let prevItinerariesRef = $state(null);
	// Id of the toast this modal raised, so closing it clears only its own.
	let notificationId = null;
	let sheetElement = $state(null);

	function toggleSteps(index) {
		expandedSteps[index] = !expandedSteps[index];
		expandedSteps = { ...expandedSteps };
	}

	function setActiveTab(index) {
		activeTab = index;
		drawRoute();
	}

	let currPolylines = [];
	let drawToken = 0;

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
		const token = ++drawToken;

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
		const drawn = [];

		for (const leg of itineraries[activeTab].legs) {
			// Counted before the geometry check: a leg with no geometry at all is
			// just as invisible on the map as one that fails to decode, so it has
			// to stay in the denominator or the gap goes unreported.
			legCount++;
			const shape = leg.legGeometry?.points;
			if (!shape) continue;
			const style = getLegPolylineStyle(leg);
			// Await: the Google provider's createPolyline is async and returns
			// null on decode failure — skip nulls instead of tracking a Promise.
			// A provider that throws instead of returning null must not reject
			// this fire-and-forget draw: that would skip the fit *and* the
			// midpoint fallback, stranding the camera with no route and no toast.
			let polyline = null;
			try {
				polyline = await mapProvider.createPolyline(shape, style);
			} catch (error) {
				console.error('Error creating itinerary leg polyline:', error);
			}
			// A newer draw (tab switch / new results) took over while we were
			// awaiting — remove the orphan so it can't strand on the map, then bail.
			if (token !== drawToken) {
				if (polyline) mapProvider.removePolyline(polyline);
				for (const prior of drawn) mapProvider.removePolyline(prior);
				return;
			}
			if (polyline) {
				drawn.push(polyline);
				drawnCount++;
			}
		}
		currPolylines = drawn;

		if (legCount > 0 && drawnCount < legCount) {
			notificationId = notifyPartialRouteShape();
		}

		const padding = panelFitPadding(sheetElement?.getBoundingClientRect(), {
			width: window.innerWidth,
			height: window.innerHeight
		});

		let fitted = false;
		try {
			fitted = await mapProvider.fitToPolylines?.({ padding });
		} catch (error) {
			console.error('Error fitting trip itinerary to view:', error);
		}
		if (token !== drawToken) return;

		if (!fitted) {
			// No drawable geometry (e.g. a leg missing legGeometry) — frame the
			// itinerary endpoints instead of leaving the camera where it was.
			// Endpoints are filtered rather than trusted: an empty legs array or a
			// leg missing from/to coordinates would otherwise throw here, or hand
			// calculateMidpoint a NaN it happily averages into a NaN flyTo.
			const legs = itineraries[activeTab].legs;
			const endpoints = [legs[0]?.from, legs.at(-1)?.to].filter(
				(point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lon)
			);
			const midpoint = calculateMidpoint(endpoints);
			if (midpoint) {
				mapProvider.flyTo(midpoint.lat, midpoint.lon, 13);
			}
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
		drawToken++;
		// Partial-shape warnings auto-dismiss, but clear ours immediately on close
		// so it doesn't linger over the next view.
		notifications.dismiss(notificationId);
		// currPolylines only ever holds polylines already awaited in drawRoute.
		currPolylines.forEach((polyline) => mapProvider.removePolyline(polyline));

		if (browser && itineraryTabsContainer) {
			itineraryTabsContainer.removeEventListener('wheel', handleWheel);
		}
	});

	let headerTitle = $derived(showForm ? $t('tabs.plan_trip') : $t('trip-planner.trip_itineraries'));
	let hasResults = $derived(itineraries.length > 0);
	// "No itineraries" empty state only after a plan attempt, not while editing.
	let showEmptyState = $derived(!loading && !hasResults && (!showForm || error));
</script>

<BottomSheet bind:snap bind:element={sheetElement}>
	{#snippet header()}
		<div class="flex items-center gap-2.5">
			<p class="min-w-0 flex-1 truncate text-base font-semibold text-black dark:text-white">
				{headerTitle}
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

	{#if showForm && handleTripPlan && clearTripItineraries}
		<div
			class={hasResults || loading || error
				? 'border-b border-gray-200 pb-4 dark:border-gray-700'
				: ''}
		>
			<TripPlan {mapProvider} {handleTripPlan} {clearTripItineraries} />
		</div>
	{/if}

	{#if loading}
		<LoadingSpinner />
	{/if}

	{#if hasResults}
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
	{:else if showEmptyState}
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
