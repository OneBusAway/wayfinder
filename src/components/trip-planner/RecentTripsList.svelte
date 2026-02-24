<script>
	import { t } from 'svelte-i18n';
	import { recentTrips } from '$stores/recentTripsStore';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTimes, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';

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
	<div class="mt-4 space-y-2">
		{#each $recentTrips as trip (trip.id)}
			<button
				type="button"
				class="dark:hover:bg-gray-750 group relative flex w-full items-center rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				onclick={() => handleTripClick(trip)}
			>
				<div class="mr-3 text-gray-400">
					<FontAwesomeIcon icon={faClockRotateLeft} class="h-3.5 w-3.5" />
				</div>

				<div class="flex-1 text-left">
					<div class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
						<span class="max-w-[120px] truncate">{trip.fromPlace}</span>
						<span class="text-gray-400">→</span>
						<span class="max-w-[120px] truncate">{trip.toPlace}</span>
					</div>
				</div>

				<div
					role="button"
					tabindex="0"
					class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 transition-opacity hover:bg-gray-200 hover:text-red-500 dark:hover:bg-gray-600"
					onclick={(e) => handleDelete(e, trip.id)}
					onkeydown={(e) => e.key === 'Enter' && handleDelete(e, trip.id)}
					aria-label={$t('trip-planner.remove_recent_trip') || 'Remove'}
				>
					<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
				</div>
			</button>
		{/each}
	</div>
{/if}
