<!--
    @component
    Shows a selected route's description and its list of stops inside a draggable
    bottom sheet so the map stays visible behind it, at every viewport width. The
    condensed header (route title + close action) lives in the drag-handle row;
    the route hero and stop list scroll in the sheet body.

    @prop {Object} selectedRoute - The currently selected route
    @prop {Array} stops - Stops served by the route
    @prop {Object} mapProvider - Map provider used to reposition on stop taps
    @prop {Function} closePane - Called when the close button is tapped (or Escape is pressed)
    @prop {('peek'|'half'|'full')} snap - Bindable current snap point of the sheet
-->

<script>
	import StopItem from '$components/StopItem.svelte';
	import BottomSheet from '$components/navigation/BottomSheet.svelte';
	import FavoriteToggle from '$components/favorites/FavoriteToggle.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faX } from '@fortawesome/free-solid-svg-icons';
	import { keybinding } from '$lib/keybinding';
	import { t } from 'svelte-i18n';

	let { selectedRoute, stops, mapProvider, closePane, snap = $bindable('half') } = $props();

	let showFullDescription = $state(false);

	// Check if description is long enough to need truncation (roughly 3 lines)
	const isDescriptionLong = $derived(
		selectedRoute?.description ? selectedRoute.description.length > 120 : false
	);

	// Reset expanded state when route changes
	$effect(() => {
		if (selectedRoute) {
			showFullDescription = false;
		}
	});

	function handleStopItemClick(stop) {
		// Reposition without a zoom animation so the displayed route stays glued
		// to the basemap instead of flickering during the move (OSM/MapLibre GL).
		mapProvider.flyTo(stop.lat, stop.lon, 18, { animate: false });
		mapProvider.openStopMarker(stop);
	}

	function title() {
		if (!selectedRoute) {
			return '';
		}

		return $t('route_modal_title', { values: { name: selectedRoute.shortName } });
	}

	function toggleDescription() {
		showFullDescription = !showFullDescription;
	}
</script>

<BottomSheet bind:snap>
	{#snippet header()}
		<div class="flex items-center gap-2.5">
			<p class="min-w-0 flex-1 truncate text-base font-semibold text-black dark:text-white">
				{title()}
			</p>
			{#if selectedRoute}
				<FavoriteToggle
					type="route"
					id={selectedRoute.id}
					shortName={selectedRoute.shortName}
					description={selectedRoute.description}
					routeType={selectedRoute.type}
					class="h-8 w-8"
				/>
			{/if}
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

	{#if stops && selectedRoute}
		<div class="space-y-4">
			<div>
				<div class="min-h-36 rounded-lg bg-brand-accent bg-opacity-80 p-4">
					<h1 class="mb-4 text-center text-2xl font-bold text-white">
						Route: {selectedRoute.shortName}
					</h1>
					<div class="relative">
						<h2
							class="text-center text-xl text-white transition-all duration-200 {showFullDescription
								? ''
								: 'line-clamp-3 max-h-24 overflow-hidden'}"
						>
							{selectedRoute.description}
						</h2>
						{#if isDescriptionLong || showFullDescription}
							<button
								type="button"
								onclick={toggleDescription}
								aria-expanded={showFullDescription}
								class="mt-2 w-full rounded text-center text-sm font-semibold text-white underline hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-accent"
							>
								{showFullDescription ? $t('show_less') : $t('show_more')}
							</button>
						{/if}
					</div>
				</div>
			</div>

			<div class="space-y-2 rounded-lg">
				<div>
					{#each stops as stop}
						<StopItem {stop} {handleStopItemClick} />
					{/each}
				</div>
			</div>
		</div>
	{/if}
</BottomSheet>
