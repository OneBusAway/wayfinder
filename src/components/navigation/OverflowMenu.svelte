<script lang="ts">
	import * as Popover from '$components/ui/popover/index';

	interface Props {
		links: { key: string; value: string }[];
	}

	const { links = [] }: Props = $props();

	let isOpen = $state(false);

	function closePopover() {
		isOpen = false;
	}
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger
		aria-label="More navigation options"
		class="flex h-8 w-8 items-center justify-center rounded-md border bg-surface/80 dark:bg-surface-dark"
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
	</Popover.Trigger>
	<Popover.Content
		align="end"
		class="left-0 z-[20000] min-w-[150px] border border-gray-300 bg-surface shadow-lg dark:border-gray-600 dark:bg-surface-dark"
		sideOffset={6}
	>
		{#each links as { key, value }}
			<a
				class="block px-4 py-2 text-sm font-semibold text-surface-foreground hover:bg-gray-100 dark:text-surface-foreground-dark dark:hover:bg-gray-700"
				href={value}
				onclick={closePopover}
			>
				{key}
			</a>
		{/each}
	</Popover.Content>
</Popover.Root>
