<script>
	import ModalPane from '$components/navigation/ModalPane.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import ItineraryDetails from './ItineraryDetails.svelte';
	import ItineraryTab from './ItineraryTab.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { t } from 'svelte-i18n';

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

	function trapFocus(event) {
		const focusableElements = event.target.querySelectorAll(
			'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
		);
		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		if (event.shiftKey) {
			if (document.activeElement === firstElement) {
				lastElement.focus();
				event.preventDefault();
			}
		} else {
			if (document.activeElement === lastElement) {
				firstElement.focus();
				event.preventDefault();
			}
		}
	}

	function handleModalOpen() {
		previouslyFocusedElement = document.activeElement;
		const modalElement = document.querySelector('.modal-pane');
		modalElement.addEventListener('keydown', trapFocus);
		modalElement.focus();
	}

	function handleModalClose() {
		const modalElement = document.querySelector('.modal-pane');
		modalElement.removeEventListener('keydown', trapFocus);
		if (previouslyFocusedElement) {
			previouslyFocusedElement.focus();
		}
	}

	onMount(() => {
		drawRoute();
		handleModalOpen();
	});
	onDestroy(() => {
		mapProvider.removePinMarker(fromMarker);
		mapProvider.removePinMarker(toMarker);

		if (currPolylines.length > 0) {
			currPolylines.forEach(async (polyline) => {
				mapProvider.removePolyline(await polyline);
			});
		}
		handleModalClose();
	});
</script>

<ModalPane
	{closePane}
	title={$t('trip-planner.trip_itineraries')}
	on:open={handleModalOpen}
	on:close={handleModalClose}
	aria-labelledby="trip-plan-modal-title"
	aria-describedby="trip-plan-modal-description"
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
