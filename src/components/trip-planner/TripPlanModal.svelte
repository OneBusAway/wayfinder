<script>
	import ModalPane from '$components/navigation/ModalPane.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import ItineraryDetails from './ItineraryDetails.svelte';
	import ItineraryTab from './ItineraryTab.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { trapFocus } from '../../../utils/focusTrap';
	import { applyAriaAttributes } from '../../../utils/ariaHelpers';

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
		loading = false,
		fromMarker = null,
		toMarker = null,
		closePane
	} = $props();

	let expandedSteps = $state({});
	let activeTab = $state(0);

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

		itineraries[activeTab].legs.forEach((leg) => {
			const shape = leg.legGeometry.points;
			const polyline = mapProvider.createPolyline(shape, polylineStyle, true);
			currPolylines.push(polyline);
		});
	}

	let previouslyFocusedElement = null;
	let modalElement;

	/**
	 * Trap focus within the modal element when it is mounted.
	 * This ensures keyboard navigation is restricted to the modal for accessibility.
	 */
	onMount(() => {
		drawRoute();
		if (modalElement) {
			/**
			 * Release focus trapping when the modal is destroyed.
			 * @returns {Function} A cleanup function to release focus trapping.
			 */
			const releaseFocus = trapFocus(modalElement);

			/**
			 * Apply ARIA attributes to the modal for screen reader support.
			 * - role: 'dialog' indicates the element is a dialog.
			 * - aria-modal: 'true' informs assistive technologies that the dialog is modal.
			 * - aria-label: Provides a label for the dialog.
			 */
			applyAriaAttributes(modalElement, {
				role: 'dialog',
				'aria-modal': 'true',
				'aria-label': 'Trip Planner',
			});

			return () => releaseFocus();
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
	});
</script>

<ModalPane
	{closePane}
	title={$t('trip-planner.trip_itineraries')}
	/**
	 * Focus the modal element when it is opened.
	 * This ensures the modal is immediately accessible to keyboard users.
	 */
	on:open={() => modalElement && modalElement.focus()}
	/**
	 * Restore focus to the previously focused element when the modal is closed.
	 * This helps maintain a logical focus order for accessibility.
	 */
	on:close={() => previouslyFocusedElement && previouslyFocusedElement.focus()}
	aria-labelledby="trip-plan-modal-title"
	aria-describedby="trip-plan-modal-description"
	bind:this={modalElement}
>
	{#if loading}
		<LoadingSpinner />
	{/if}

	{#if itineraries.length > 0}
		<div class="tab-container">
			<!-- eslint-disable no-unused-vars -->
			{#each itineraries as _, index}
				<ItineraryTab {index} {activeTab} {setActiveTab} />
			{/each}
		</div>

		<div class="p-4">
			{#if itineraries[activeTab]}
				<ItineraryDetails itinerary={itineraries[activeTab]} {expandedSteps} {toggleSteps} />
			{/if}
		</div>
	{:else}
		<div class="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
			{$t('trip-planner.no_itineraries_found')}
		</div>
	{/if}
</ModalPane>
