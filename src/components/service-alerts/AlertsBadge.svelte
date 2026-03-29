<script>
	import { alertsStore } from '$stores/alertsStore';

	let { id, type = 'stop' } = $props();

	let alertCount = $state(0);
	let unsubscribe = undefined;

	$effect(() => {
		// Only fetch for stops, not routes
		if (type === 'stop' && id) {
			alertsStore.fetchAlertsForStop(id);
		}

		// Subscribe to store updates
		unsubscribe = alertsStore.subscribe(() => {
			alertCount = alertsStore.getAlertCount(id, type);
		});

		// Cleanup subscription
		return () => {
			if (unsubscribe) unsubscribe();
		};
	});
</script>

<div role="status" aria-live="polite">
	{#if alertCount > 0}
		<div
			class="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
			aria-label={`${alertCount} alert${alertCount > 1 ? 's' : ''}`}
			title={`${alertCount} active alert${alertCount > 1 ? 's' : ''}`}
		>
			{alertCount > 9 ? '9+' : alertCount}
		</div>
	{/if}
</div>

<style>
	div {
		flex-shrink: 0;
	}
</style>
