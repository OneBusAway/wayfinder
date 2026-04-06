<script>
	let { alerts = [], id, type = 'stop' } = $props();

	let alertCount = $derived.by(() => {
		if (type === 'stop') {
			return alerts.length;
		} else if (type === 'route') {
			return alerts.filter((alert) => {
				if (!alert.affectedEntity) return false;
				return alert.affectedEntity.some(
					(entity) => entity.routeId === id || entity.route?.id === id
				);
			}).length;
		}
		return 0;
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
