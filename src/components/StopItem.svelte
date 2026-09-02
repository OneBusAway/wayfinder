<script>
	let { stop, handleStopItemClick } = $props();
</script>

<button
	type="button"
	class="stop-item flex w-full items-center justify-between border-b border-gray-200 bg-[#f9f9f9] p-4 text-left hover:bg-[#e9e9e9] focus:outline-none dark:border-[#313135] dark:bg-[#1c1c1c] dark:hover:bg-[#363636]"
	onclick={() => handleStopItemClick(stop)}
>
	<div class="text-surface-foreground text-lg font-semibold dark:text-white">
		{stop.name}
	</div>
	<div class="text-md text-[#86858B]">
		{stop.code}
	</div>
</button>
