<!--
    @component
    Names the colors on the map. Two routes in a shared corridor are only
    distinguishable if the rider can map a color back to a route, so this pane
    makes the badge -> line -> vehicle mapping explicit while a stop is selected.

    Desktop only: at phone width the bottom sheet already owns this space, and
    the arrival badges carry the same mapping.
-->
<script>
	import '$lib/i18n.js';
	import { isLoading, t } from 'svelte-i18n';

	let { routes = [], routeColors = new Map(), liveCounts = new Map() } = $props();
</script>

{#if routes.length > 0}
	<div
		class="route-legend pointer-events-auto absolute top-4 right-4 z-30 hidden min-w-44 rounded-lg border border-gray-300 bg-white/95 p-3 shadow-md backdrop-blur-sm md:block dark:border-gray-600 dark:bg-gray-800/95"
	>
		<h2
			class="mb-2 text-[10.5px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
		>
			{$isLoading ? '' : $t('map.routes_shown')}
		</h2>
		<ul class="flex flex-col gap-2">
			{#each routes as route (route.id)}
				<li class="flex items-center gap-2">
					<span
						aria-hidden="true"
						class="legend-swatch h-1.5 w-5 flex-none rounded-full"
						style="background-color: {routeColors.get(route.id)?.line};"
					></span>
					<span class="text-[13px] font-bold text-gray-900 dark:text-white">{route.shortName}</span>
					{#if liveCounts.has(route.id)}
						<span class="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
							{$isLoading
								? ''
								: $t('map.live_vehicle_count', { values: { count: liveCounts.get(route.id) } })}
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
