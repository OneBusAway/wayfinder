<script>
	import { tick } from 'svelte';
	import { get } from 'svelte/store';
	import { t } from 'svelte-i18n';
	import {
		clearRecentSearchesDialog,
		closeClearRecentSearchesDialog
	} from '$stores/clearRecentSearchesDialogStore';

	let confirmationDialog = $state();
	let cancelButton = $state();

	$effect(() => {
		if ($clearRecentSearchesDialog.open) {
			tick().then(() => cancelButton?.focus());
		}
	});

	async function closeDialog() {
		const returnFocusTo = closeClearRecentSearchesDialog();
		await tick();
		if (returnFocusTo?.isConnected) {
			returnFocusTo.focus();
		}
		return returnFocusTo;
	}

	async function confirmClearAll() {
		const { onConfirm } = get(clearRecentSearchesDialog);
		const returnFocusTo = await closeDialog();
		onConfirm?.();
		await tick();
		if (!returnFocusTo?.isConnected) {
			document.getElementById('from-location-input')?.focus();
		}
	}

	function handleDialogKeydown(event) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeDialog();
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
			closeDialog();
		}
	}
</script>

{#if $clearRecentSearchesDialog.open}
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
					onclick={closeDialog}
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
