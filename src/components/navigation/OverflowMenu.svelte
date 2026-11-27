<script lang="ts">
	import { Button } from '$components/ui/button/';
	import { Ellipsis } from '@lucide/svelte';
	import * as Popover from '$components/ui/popover/index';
	import { t } from 'svelte-i18n';

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
	<Popover.Trigger aria-label="More navigation options">
		{#snippet child({ props })}
			<Button {...props} size="sm" variant="outline">
				<Ellipsis />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		align="end"
		aria-label="Navigation options"
		class="w-auto min-w-[150px] gap-0 border border-gray-300 bg-surface p-0 py-1 dark:border-gray-600 dark:bg-surface-dark"
		portalProps={{ disabled: true }}
		role="dialog"
		sideOffset={6}
	>
		{#each links as { key, value } (key)}
			<!-- external URL -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				class="block px-4 py-2 text-sm font-semibold text-surface-foreground hover:bg-gray-100 dark:text-surface-foreground-dark dark:hover:bg-gray-700"
				href={value}
				onclick={closePopover}
			>
				{$t(key, { default: key })}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</Popover.Content>
</Popover.Root>
