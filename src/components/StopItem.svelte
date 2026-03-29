<script>
	import FavoriteButton from '$components/favorites/FavoriteButton.svelte';
	import AlertsBadge from '$components/service-alerts/AlertsBadge.svelte';
	import { filterActiveAlerts } from '$components/service-alerts/serviceAlertsHelper';

	let { stop, handleStopItemClick } = $props();

	let alerts = $state([]);

	$effect(() => {
		if (!stop?.id) return;
		fetch(`/api/oba/arrivals-and-departures-for-stop/${stop.id}`)
			.then(r => r.json())
			.then(data => {
				alerts = filterActiveAlerts(data.data?.references?.situations || []);
			})
			.catch(() => {});
	});
</script>

<div class="flex items-center gap-2">
	<div
		role="button"
		tabindex="0"
		class="stop-item dark:bg[#000000] flex w-full items-center justify-between border-b border-gray-200 bg-[#f9f9f9] p-4 text-left hover:bg-[#e9e9e9] focus:outline-none dark:border-[#313135] dark:bg-[#1c1c1c] dark:hover:bg-[#363636]"
		onclick={() => handleStopItemClick(stop)}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); handleStopItemClick(stop); } }}
	>
		<div class="flex items-center gap-3 flex-1">
			<div class="flex-1">
				<div class="text-lg font-semibold text-[#000000] dark:text-white">
					{stop.name}
				</div>
				<div class="text-md text-[#86858B]">
					{stop.code}
				</div>
			</div>
		</div>
		<FavoriteButton id={stop.id} type="stop" name={stop.name} ariaLabel={`Add ${stop.name} to favorites`} />
	</div>
	<AlertsBadge {alerts} id={stop.id} type="stop" />
</div>
