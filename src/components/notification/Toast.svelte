<script>
	import { notifications } from '$stores/notificationStore';
	import { t } from 'svelte-i18n';

	let notification = $derived($notifications);

	function dismiss() {
		// Unscoped: the user asked for this one to go away, whoever raised it.
		notifications.dismiss();
	}

	function retry() {
		notification?.onRetry?.();
		notifications.dismiss();
	}

	function handleKeydown(event) {
		if (event.key === 'Escape' && notification) {
			dismiss();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if notification}
	<!-- The wrapper is inert so it can't swallow taps aimed at the bottom sheet
	     underneath; only the card itself is interactive. -->
	<div
		class="toast pointer-events-none fixed bottom-6 left-1/2 z-[9999] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2"
		role={notification.variant === 'error' ? 'alert' : 'status'}
		aria-live={notification.variant === 'error' ? 'assertive' : 'polite'}
	>
		<div
			class="pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm
				{notification.variant === 'error'
				? 'border-red-200 bg-red-50/95 text-red-900 dark:border-red-800 dark:bg-red-950/95 dark:text-red-100'
				: 'border-amber-200 bg-amber-50/95 text-amber-950 dark:border-amber-800 dark:bg-amber-950/95 dark:text-amber-100'}"
		>
			<p class="flex-1 text-sm leading-snug">
				{notification.message}
				{#if notification.onRetry}
					{' '}
					<button type="button" class="font-semibold underline hover:no-underline" onclick={retry}>
						{$t('notifications.tap_to_retry')}
					</button>
				{/if}
			</p>
			<button
				type="button"
				class="shrink-0 text-sm opacity-70 hover:opacity-100"
				onclick={dismiss}
				aria-label={$t('notifications.dismiss')}
			>
				{$t('notifications.dismiss')}
			</button>
		</div>
	</div>
{/if}
