<!--
    @component
    Shows a stop's arrivals and departures in a draggable bottom sheet so the map
    stays visible behind it, at every viewport width. The tall hero card is
    replaced by a condensed header (stop name; stop number, direction and routes)
    with a Close button, plus a Refresh / Stop Info action row, inside the
    drag-handle row.

    @prop {Object} stop - Stop object containing stop details
    @prop {('peek'|'half'|'full')} snap - Bindable current snap point of the sheet
    @prop {Function} closePane - Called when the close button is tapped (or Escape is pressed)
    @prop {Function} tripSelected - Forwarded to StopPane; called when a trip is selected
    @prop {Function} handleUpdateRouteMap - Forwarded to StopPane; called when the route map needs updating
-->

<script>
	import BottomSheet from '$components/navigation/BottomSheet.svelte';
	import StopPane from '$components/stops/StopPane.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCircleInfo, faX, faArrowsRotate } from '@fortawesome/free-solid-svg-icons';
	import { keybinding } from '$lib/keybinding';
	import '$lib/i18n.js';
	import { isLoading, t } from 'svelte-i18n';
	import { removeAgencyPrefix, routeShortNamesForStop } from '$lib/utils';

	let { stop, closePane, tripSelected, handleUpdateRouteMap, snap = $bindable('half') } = $props();

	let arrivalsAndDeparturesResponse = $state(null);
	// Bound from StopPane so the toolbar refresh button can spin while any fetch
	// (initial, manual, or the 30s poll) is in flight, and trigger a manual one.
	let stopPane = $state(null);
	let stopPaneLoading = $state(false);

	let routeShortNames = $derived(routeShortNamesForStop(arrivalsAndDeparturesResponse, stop));
	// "Stop #20170 · SW bound · C, 21, 116, 125" — direction and routes are both
	// optional, so build the parts list and join only what's present.
	let subtitle = $derived(
		[
			`${$isLoading ? '' : $t('stop')} #${removeAgencyPrefix(stop.id)}`,
			stop.direction && !$isLoading
				? $t('direction_bound', { values: { direction: stop.direction } })
				: null,
			routeShortNames?.length ? routeShortNames.join(', ') : null
		]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<BottomSheet bind:snap>
	{#snippet header()}
		<!-- Bled out to the sheet's edges (-mx-3.5 undoes the drag row's padding) so
		     the rule under the header spans its full width, as in the design. -->
		<div class="-mx-3.5 border-b border-gray-200 px-3.5 pb-3 dark:border-gray-700">
			<div class="flex items-start gap-2.5">
				<div class="min-w-0 flex-1">
					<p class="truncate text-xl font-bold text-black dark:text-white">{stop.name}</p>
					<p class="truncate text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
				</div>
				<button
					type="button"
					onclick={closePane}
					use:keybinding={{ code: 'Escape' }}
					class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-200 text-sm text-black hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
				>
					<FontAwesomeIcon icon={faX} />
					<span class="sr-only">{$isLoading ? '' : $t('sheet.close')}</span>
				</button>
			</div>

			<div class="mt-3 flex items-center gap-2">
				<button
					type="button"
					onclick={() => stopPane?.refresh()}
					disabled={stopPaneLoading}
					title={$isLoading ? '' : $t('refresh')}
					aria-label={$isLoading ? '' : $t('refresh')}
					aria-busy={stopPaneLoading}
					class="flex h-10 w-12 items-center justify-center rounded-xl border border-gray-300 text-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
				>
					<span class="flex" class:animate-spin={stopPaneLoading}>
						<FontAwesomeIcon icon={faArrowsRotate} />
					</span>
				</button>
				<a
					href={`/stops/${stop.id}`}
					class="flex h-10 items-center gap-2 rounded-xl border border-gray-300 px-4 text-base font-semibold text-black hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
				>
					<FontAwesomeIcon icon={faCircleInfo} />
					{$isLoading ? '' : $t('stop_details.stop_info')}
				</a>
			</div>
		</div>
	{/snippet}

	<StopPane
		bind:this={stopPane}
		{tripSelected}
		{handleUpdateRouteMap}
		{stop}
		showHeroCard={false}
		bind:arrivalsAndDeparturesResponse
		bind:loading={stopPaneLoading}
	/>
</BottomSheet>
