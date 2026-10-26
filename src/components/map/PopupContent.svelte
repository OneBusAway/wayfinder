<script>
	import { t } from 'svelte-i18n';
	import RoutePill from '$components/map/RoutePill.svelte';
	import { formatSecondsFromMidnight } from '$lib/dateTimeFormat';
	import { stopSubtitle } from '$lib/utils';

	let { stop, arrivalTime, handleStopMarkerSelect } = $props();

	const MAX_ROUTES_TO_SHOW = 3;

	const subtitle = $derived(stop ? stopSubtitle(stop, $t) : '');

	// Stops opened from a route (RouteModal, addStopRouteMarker) are not augmented
	// with resolved route references, so the row is simply left out for them.
	const routes = $derived((stop?.routes ?? []).filter((route) => route?.shortName));
	const shownRoutes = $derived(routes.slice(0, MAX_ROUTES_TO_SHOW));
	const remainingRoutes = $derived(routes.length - shownRoutes.length);
</script>

<div
	class="map-popup-card w-72 max-w-full overflow-hidden rounded-xl bg-surface text-start text-surface-foreground dark:bg-surface-dark dark:text-surface-foreground-dark"
>
	<div class="flex flex-col gap-2.5 px-4 pt-3.5 pb-3">
		<div class="pe-7">
			<h3 class="text-lg leading-tight font-bold">{stop?.name}</h3>
			{#if subtitle}
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
			{/if}
		</div>

		{#if shownRoutes.length}
			<div class="flex flex-wrap items-center gap-1.5">
				{#each shownRoutes as route (route.id)}
					<RoutePill
						shortName={route.shortName}
						color={route.color}
						textColor={route.textColor}
						routeType={route.type}
					/>
				{/each}
				{#if remainingRoutes > 0}
					<span class="text-xs font-semibold text-gray-500 dark:text-gray-400">
						+{remainingRoutes}
					</span>
				{/if}
			</div>
		{/if}

		{#if arrivalTime != null}
			<p class="text-sm text-gray-500 dark:text-gray-400">
				{$t('arrives_at', { values: { time: formatSecondsFromMidnight(arrivalTime) } })}
			</p>
		{/if}
	</div>

	<div class="border-t border-gray-200 px-4 py-2.5 dark:border-gray-700">
		<button
			type="button"
			class="w-full rounded-lg bg-brand-accent px-3 py-2 text-sm font-semibold text-white transition duration-200 ease-in-out hover:bg-brand-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
			onclick={handleStopMarkerSelect}
		>
			{$t('view_stop_information')}
		</button>
	</div>
</div>
