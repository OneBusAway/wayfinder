<script>
	import { bookmarks } from '$src/stores/bookmarksStore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	let loaded = false;

	onMount(() => {
		loaded = true;
	});
</script>

<div class="mb-8 h-full w-full p-4 lg:w-4/5 lg:mx-auto">
	<h1 class="my-4 text-center text-2xl font-bold">Bookmarks</h1>
	<div
		class="h-[calc(100%-2rem)] overflow-y-auto p-4 lg:flex lg:flex-wrap lg:justify-between lg:content-start lg:gap-4"
	>
		{#if !loaded}
			<p>Loading bookmarks...</p>
		{:else if Object.keys($bookmarks).length === 0}
			<p>No bookmarks saved yet.</p>
		{:else}
			{#each Object.entries($bookmarks) as [, item]}
				<div class="mx-auto h-max mb-4 w-full rounded-lg bg-gray-100 p-4 sm:w-2/3 md:w-3/5 lg:w-[45%] lg:mx-0">
					<div class="flex gap-8 py-4">
						<p class="font-bold">{item.name}</p>
						<p class="font-semibold">{item.description}</p>
					</div>
					<div class = "flex gap-4">
						<button
							type="button"
							class="mt-2 block w-1/2 lg:w-1/3 rounded bg-black py-2 text-sm font-semibold text-white hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-accent"
							onclick={() => {
                                bookmarks.remove(item.name)
							}}
						>
							Delete Route
						</button>
						<button
							type="button"
							class="mt-2 block w-1/2 lg:w-1/3 rounded bg-blue-500 py-2 text-sm font-semibold text-white hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-accent"
							onclick={() => {
								goto("/", {
									state: {
										previousPage: "bookmarks",
										name: item.name
									}
								});
							}}
						>
                            View Route
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
