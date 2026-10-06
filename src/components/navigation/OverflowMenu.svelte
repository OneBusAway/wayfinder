<script lang="ts">
	import { Popover } from 'flowbite-svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		links: { key: string; value: string }[];
	}

	const { links = [] }: Props = $props();

	let isOpen = $state(false);

	function closePopover() {
		isOpen = false;
	}
</script>

<button
	aria-expanded={isOpen}
	aria-haspopup="menu"
	aria-label="More navigation options"
	class="flex h-8 w-8 items-center justify-center rounded-md border bg-surface/80 dark:bg-surface-dark"
	id="more-navigation-options-trigger"
>
	<svg
		class="h-5 w-5 text-surface-foreground dark:text-surface-foreground-dark"
		fill="currentColor"
		viewBox="0 0 20 20"
		xmlns="http://www.w3.org/2000/svg"
		><path
			d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z"
		></path></svg
	>
</button>
<Popover
	arrow={false}
	class="left-0 min-w-[150px] rounded-md border border-gray-300 bg-surface shadow-lg dark:border-gray-600 dark:bg-surface-dark"
	defaultClass="flex flex-col py-1"
	offset={6}
	open={isOpen}
	on:show={(e: CustomEvent<boolean>) => (isOpen = e.detail)}
	params={{ duration: 100 }}
	placement="bottom-end"
	role="menu"
	transition={fade}
	trigger="click"
	triggeredBy="#more-navigation-options-trigger"
>
	{#each links as { key, value }}
		<a
			href={value}
			onclick={closePopover}
			class="block px-4 py-2 text-sm font-semibold text-surface-foreground hover:bg-gray-100 dark:text-surface-foreground-dark dark:hover:bg-gray-700"
		>
			{key}
		</a>
	{/each}
</Popover>
