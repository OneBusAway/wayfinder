<!--
    @component
    Shows a stop's arrivals and departures in a draggable bottom sheet so the map
    stays visible behind it, at every viewport width. The tall hero card is
    replaced by a condensed header (stop name, stop number, routes) with circular
    View Details / View Schedule / Close actions inside the drag-handle row.

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
	import {
		faCircleInfo,
		faCalendarDays,
		faX,
		faArrowsRotate
	} from '@fortawesome/free-solid-svg-icons';
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

	let actions = $derived([
		{ href: `/stops/${stop.id}`, icon: faCircleInfo, labelKey: 'stop_details.view_details' },
		{
			href: `/stops/${stop.id}/schedule`,
			icon: faCalendarDays,
			labelKey: 'schedule_for_stop.view_schedule'
		}
	]);

	let routeShortNames = $derived(routeShortNamesForStop(arrivalsAndDeparturesResponse, stop));
	let subtitle = $derived(
		`${$isLoading ? '' : $t('stop')} #${removeAgencyPrefix(stop.id)}` +
			(routeShortNames?.length ? ` · ${routeShortNames.join(', ')}` : '')
	);
</script>

<BottomSheet bind:snap>
	{#snippet header()}
		<div class="flex items-center gap-2.5">
			<div class="min-w-0 flex-1">
				<p class="truncate text-base font-semibold text-black dark:text-white">{stop.name}</p>
				<p class="truncate text-xs text-gray-600 dark:text-gray-400">{subtitle}</p>
			</div>
			<div class="flex flex-none gap-1.5">
				<button
					type="button"
					onclick={() => stopPane?.refresh()}
					title={$isLoading ? '' : $t('refresh')}
					aria-label={$isLoading ? '' : $t('refresh')}
					aria-busy={stopPaneLoading}
					class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent text-sm text-white hover:bg-brand-accent-dark"
				>
					<span class="flex" class:animate-spin={stopPaneLoading}>
						<FontAwesomeIcon icon={faArrowsRotate} />
					</span>
				</button>
				{#each actions as action (action.href)}
					<a
						href={action.href}
						title={$isLoading ? '' : $t(action.labelKey)}
						aria-label={$isLoading ? '' : $t(action.labelKey)}
						class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent text-sm text-white hover:bg-brand-accent-dark"
					>
						<FontAwesomeIcon icon={action.icon} />
					</a>
				{/each}
				<button
					type="button"
					onclick={closePane}
					use:keybinding={{ code: 'Escape' }}
					class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm text-black hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
				>
					<FontAwesomeIcon icon={faX} />
					<span class="sr-only">{$isLoading ? '' : $t('sheet.close')}</span>
				</button>
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
