<script>
	import FavoriteButton from '$components/favorites/FavoriteButton.svelte';
	import AlertsBadge from '$components/service-alerts/AlertsBadge.svelte';

	let { stop, handleStopItemClick } = $props();
</script>

<div class="flex items-center gap-2">
	<div
		role="button"
		tabindex="0"
		class="stop-item dark:bg[#000000] flex w-full items-center justify-between border-b border-gray-200 bg-[#f9f9f9] p-4 text-left hover:bg-[#e9e9e9] focus:outline-none dark:border-[#313135] dark:bg-[#1c1c1c] dark:hover:bg-[#363636]"
		onclick={() => handleStopItemClick(stop)}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStopItemClick(stop); }}
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
		<FavoriteButton id={stop.id} type="stop" ariaLabel={`Add ${stop.name} to favorites`} />
	</div>
	<AlertsBadge id={stop.id} type="stop" />
</div>
