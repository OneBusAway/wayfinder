<script>
	import { t } from 'svelte-i18n';
	import { recentTrips } from '$stores/recentTripsStore';
	import { RotateCcwClock, X } from '@lucide/svelte';

	let { onSelect } = $props();

	function handleTripClick(trip) {
		onSelect?.(trip);
	}

	function handleDelete(e, tripId) {
		e.stopPropagation();
		recentTrips.removeTrip(tripId);
	}
</script>

{#if $recentTrips.length > 0}
	<div class="mt-4">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
				<RotateCcwClock class="h-3.5 w-3.5" />
				{$t('trip-planner.recent_searches')}
			</h2>
			<button
				type="button"
				class="text-xs text-gray-600 transition-colors hover:text-red-500 dark:text-gray-400"
				onclick={() => recentTrips.clearAll()}
			>
				{$t('trip-planner.clear_all')}
			</button>
		</div>

		<div class="space-y-2">
			{#each $recentTrips as trip (trip.id)}
				<div
					class="dark:hover:bg-gray-750 group relative rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:bg-gray-50 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				>
					<button
						type="button"
						aria-label={$t('trip-planner.recent_trip', {
							values: { from: trip.fromPlace, to: trip.toPlace }
						})}
						class="flex w-full items-center rounded-lg p-2.5 text-left"
						onclick={() => handleTripClick(trip)}
					>
						<div class="mr-3 text-gray-400">
							<RotateCcwClock class="h-3.5 w-3.5" />
						</div>

						<div class="min-w-0 flex-1 text-left">
							<div class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
								{trip.fromPlace}
							</div>
							<div class="truncate text-xs text-gray-500 dark:text-gray-400">
								{trip.toPlace}
							</div>
						</div>
					</button>

					<button
						type="button"
						class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-gray-600"
						onclick={(e) => handleDelete(e, trip.id)}
						aria-label={$t('trip-planner.remove_recent_trip')}
					>
						<X class="h-3 w-3" />
					</button>
				</div>
			{/each}
		</div>
	</div>
{/if}
