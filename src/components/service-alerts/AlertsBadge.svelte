<script>
	import { alertsStore } from '$stores/alertsStore';
	import { onMount } from 'svelte';

	let { id, type = 'stop' } = $props();

	let alertCount = $state(0);

	onMount(() => {
		// Fetch alerts when component mounts
		if (type === 'stop' && id) {
			alertsStore.fetchAlertsForStop(id);
		}

		// Subscribe to store updates
		const unsubscribe = alertsStore.subscribe(() => {
			alertCount = alertsStore.getAlertCount(id, type);
		});

		return unsubscribe;
	});
</script>

{#if alertCount > 0}
	<div
		class="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
		aria-label={`${alertCount} alert${alertCount > 1 ? 's' : ''}`}
		title={`${alertCount} active alert${alertCount > 1 ? 's' : ''}`}
	>
		{alertCount > 9 ? '9+' : alertCount}
	</div>
{/if}

<style>
	div {
		flex-shrink: 0;
	}
</style>
