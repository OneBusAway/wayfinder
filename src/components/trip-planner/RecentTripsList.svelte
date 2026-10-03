<script>
	import { tick } from 'svelte';
	import { t } from 'svelte-i18n';
	import { recentTrips } from '$stores/recentTripsStore';
	import { History, X } from '@lucide/svelte';

	let { onSelect } = $props();
	let showClearConfirmation = $state(false);
	let clearAllButton = $state();
	let confirmationDialog = $state();
	let cancelButton = $state();

	function handleTripClick(trip) {
		onSelect?.(trip);
	}

	async function openClearConfirmation() {
		showClearConfirmation = true;
		await tick();
		cancelButton?.focus();
	}

	async function closeClearConfirmation() {
		showClearConfirmation = false;
		await tick();
		if (clearAllButton?.isConnected) {
			clearAllButton.focus();
		}
	}

	async function confirmClearAll() {
		await closeClearConfirmation();
		recentTrips.clearAll();
		await tick();
		document.getElementById('from-location-input')?.focus();
	}

	function handleDialogKeydown(event) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeClearConfirmation();
			return;
		}

		if (event.key !== 'Tab') {
			return;
		}

		const buttons = confirmationDialog?.querySelectorAll('button:not([disabled])');
		if (!buttons?.length) {
			return;
		}

		const firstButton = buttons[0];
		const lastButton = buttons[buttons.length - 1];
		if (
			(event.shiftKey &&
				(document.activeElement === firstButton ||
					document.activeElement === confirmationDialog)) ||
			(!event.shiftKey && document.activeElement === lastButton)
		) {
			event.preventDefault();
			(event.shiftKey ? lastButton : firstButton).focus();
		}
	}

	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			closeClearConfirmation();
		}
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
							<History class="h-3.5 w-3.5" />
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

{#if showClearConfirmation}
	<div
		bind:this={confirmationDialog}
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-labelledby="clear-recent-searches-title"
		aria-describedby="clear-recent-searches-description"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleDialogKeydown}
	>
		<div
			class="w-full max-w-sm rounded-t-2xl bg-white p-5 dark:bg-gray-900 sm:rounded-2xl"
			role="document"
		>
			<h2
				id="clear-recent-searches-title"
				class="text-lg font-semibold text-gray-900 dark:text-white"
			>
				{$t('trip-planner.clear_recent_searches')}
			</h2>
			<p
				id="clear-recent-searches-description"
				class="mt-2 text-sm text-gray-600 dark:text-gray-300"
			>
				{$t('trip-planner.clear_recent_searches_confirmation')}
			</p>
			<div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<button
					bind:this={cancelButton}
					type="button"
					class="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-accent dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
					onclick={closeClearConfirmation}
				>
					{$t('trip-planner.cancel')}
				</button>
				<button
					type="button"
					class="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
					onclick={confirmClearAll}
				>
					{$t('search.clear')}
				</button>
			</div>
		</div>
	</div>
{/if}
