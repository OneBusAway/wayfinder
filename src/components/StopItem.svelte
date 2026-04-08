<script>
	import FavoriteButton from '$components/favorites/FavoriteButton.svelte';

	let { stop, handleStopItemClick } = $props();
</script>

<div class="stop-item flex w-full items-center justify-between border-b border-gray-200 bg-[#f9f9f9] hover:bg-[#e9e9e9] dark:border-[#313135] dark:bg-[#1c1c1c] dark:hover:bg-[#363636]">
	<button
		type="button"
		class="flex flex-1 items-center gap-3 p-4 text-left focus:outline-none"
		onclick={() => handleStopItemClick(stop)}
	>
		<div class="flex-1">
			<div class="text-lg font-semibold text-[#000000] dark:text-white">
				{stop.name}
			</div>
			<div class="text-md text-[#86858B]">
				{stop.code}
			</div>
		</div>
	</button>
	<div class="pr-4">
		<FavoriteButton id={stop.id} type="stop" ariaLabel={`Add ${stop.name} to favorites`} />
	</div>
</div>
