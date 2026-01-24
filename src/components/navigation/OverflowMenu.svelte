<script>
	let { links = [], onClose } = $props();
	let menuRef = $state(null);

	$effect(() => {
		const handleClickOutside = (e) => {
			if (menuRef && !menuRef.contains(e.target)) {
				onClose();
			}
		};
		// Delay adding listener to avoid immediate close from the click that opened it
		const timeoutId = setTimeout(() => {
			document.addEventListener('click', handleClickOutside);
		}, 0);
		return () => {
			clearTimeout(timeoutId);
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div
	bind:this={menuRef}
	class="absolute end-0 top-full z-[9999] mt-1 min-w-[150px] rounded-md border border-gray-300 bg-surface shadow-lg dark:border-gray-600 dark:bg-surface-dark"
>
	<div class="flex flex-col py-1">
		{#each links as { key, value }}
			<a
				href={value}
				onclick={onClose}
				class="block px-4 py-2 text-sm font-semibold text-surface-foreground hover:bg-gray-100 dark:text-surface-foreground-dark dark:hover:bg-gray-700"
			>
				{key}
			</a>
		{/each}
	</div>
</div>
