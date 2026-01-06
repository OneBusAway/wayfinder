<script>
	import { fly } from 'svelte/transition';
	import ThemeSwitcher from '$lib/ThemeSwitch/ThemeSwitcher.svelte';

	let { headerLinks = {}, closeMenu } = $props();
</script>

<div
	class="fixed inset-0 z-50 flex flex-col items-center justify-center space-y-6 bg-surface p-4 dark:bg-surface-dark"
	transition:fly={{ x: 1000, duration: 300 }}
>
	<button onclick={closeMenu} aria-label="Close Menu">
		<svg
			class="close-icon h-6 w-6 cursor-pointer text-surface-foreground dark:text-surface-foreground-dark"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"
			></path>
		</svg>
	</button>

	<div class="flex flex-col items-center gap-4">
		{#each Object.entries(headerLinks) as [key, value]}
			<a
				href={value}
				class="block text-xl font-semibold text-surface-foreground dark:text-surface-foreground-dark"
				onclick={closeMenu}>{key}</a
			>
		{/each}
	</div>

	<div>
		<ThemeSwitcher />
	</div>
</div>

<style lang="postcss">
	.close-icon {
		cursor: pointer;
	}
</style>
