<script>
	import { tick } from 'svelte';
	import { t } from 'svelte-i18n';
	import { recentTrips } from '$stores/recentTripsStore';
	import { pinnedTrips, isMatch } from '$stores/pinnedTripsStore';
	import { openClearRecentSearchesDialog } from '$stores/clearRecentSearchesDialogStore';
	import { History, X, Pin } from '@lucide/svelte';

	let { onSelect } = $props();
	let clearAllButton = $state();
	let listContainer = $state();
	let pinLimitReached = $state(false);

	let unpinnedRecentTrips = $derived(
		$recentTrips.filter((tripItem) => !$pinnedTrips.some((pt) => isMatch(pt, tripItem)))
	);

	function openClearConfirmation() {
		openClearRecentSearchesDialog({
			onConfirm: () => recentTrips.clearAll(),
			returnFocusTo: clearAllButton
		});
	}

	function handleTripClick(trip) {
		onSelect?.(trip);
	}

	function handleDeleteRecent(e, tripId) {
		e.stopPropagation();
		recentTrips.removeTrip(tripId);
	}

	function handleDeletePinned(e, tripId) {
		e.stopPropagation();
		pinnedTrips.removeTrip(tripId);
		pinLimitReached = false;
	}

	async function handleTogglePin(e, trip) {
		e.stopPropagation();
		const result = pinnedTrips.togglePin(trip);
		if (result === 'invalid') {
			return;
		}
		if (result === 'limit') {
			pinLimitReached = true;
			return;
		}
		pinLimitReached = false;
		await tick();
		const target =
			listContainer?.querySelector(`[data-pinned-id="${trip.id}"]`) ??
			listContainer?.querySelector('[data-pinned-id]');
		target?.focus();
	}
</script>

{#if $pinnedTrips.length > 0 || unpinnedRecentTrips.length > 0}
	<div bind:this={listContainer} class="mt-4 flex flex-col gap-6">
		{#if $pinnedTrips.length > 0}
			<div>
				<h2
					class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300"
				>
					<Pin class="h-3.5 w-3.5 fill-current" />
					{$t('trip-planner.pinned_trips')}
				</h2>
				{#if pinLimitReached}
					<p role="alert" class="mb-2 text-xs text-red-600 dark:text-red-400">
						{$t('trip-planner.pin_limit_reached')}
					</p>
				{/if}
				<div class="space-y-2">
					{#each $pinnedTrips as trip (trip.id)}
						<div
							class="border-brand-primary/30 bg-brand-primary/5 shadow-xs dark:border-brand-primary/50 group relative rounded-lg border transition-all hover:shadow-md dark:bg-gray-800"
						>
							<button
								type="button"
								data-pinned-id={trip.id}
								aria-label={$t('trip-planner.pinned_trip', {
									values: { from: trip.fromPlace, to: trip.toPlace }
								})}
								class="flex w-full items-center rounded-lg p-2.5 text-left"
								onclick={() => handleTripClick(trip)}
							>
								<div class="text-brand-primary mr-3">
									<Pin class="h-3.5 w-3.5 fill-current" />
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
								aria-label={$t('trip-planner.remove_pinned_trip')}
								class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-gray-600"
								onclick={(e) => handleDeletePinned(e, trip.id)}
							>
								<X class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if unpinnedRecentTrips.length > 0}
			<div>
				<div class="mb-2 flex items-center justify-between">
					<h2
						class="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400"
					>
						<History class="h-3.5 w-3.5" />
						{$t('trip-planner.recent_searches')}
					</h2>
					<button
						bind:this={clearAllButton}
						type="button"
						class="text-xs text-gray-600 transition-colors hover:text-red-500 dark:text-gray-400"
						onclick={openClearConfirmation}
					>
						{$t('trip-planner.clear_all')}
					</button>
				</div>
				<div class="space-y-2">
					{#each unpinnedRecentTrips as trip (trip.id)}
						<div
							class="dark:hover:bg-gray-750 shadow-xs group relative rounded-lg border border-gray-200 bg-white transition-all hover:bg-gray-50 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
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
									<History class="h-3.5 w-3.5" />
								</div>
								<div class="min-w-0 flex-1 pr-16 text-left">
									<div class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
										{trip.fromPlace}
									</div>
									<div class="truncate text-xs text-gray-500 dark:text-gray-400">
										{trip.toPlace}
									</div>
								</div>
							</button>

							<div
								class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
							>
								<button
									type="button"
									aria-label={$t('trip-planner.pin_trip', {
										values: { from: trip.fromPlace, to: trip.toPlace }
									})}
									onclick={(e) => handleTogglePin(e, trip)}
									class="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-brand-accent dark:hover:bg-gray-600"
								>
									<Pin class="h-3.5 w-3.5" />
								</button>
								<button
									type="button"
									aria-label={$t('trip-planner.remove_recent_trip')}
									onclick={(e) => handleDeleteRecent(e, trip.id)}
									class="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-500 dark:hover:bg-gray-600"
								>
									<X class="h-3.5 w-3.5" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
