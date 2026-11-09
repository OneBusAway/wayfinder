<script lang="ts">
	import AppIcon from '$components/icons/AppIcon.svelte';
	import type { Component } from 'svelte';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

	interface Props {
		icon: Component | IconDefinition;
		onclick: (event: MouseEvent) => void;
		subtitle?: string;
		title: string;
	}

	const { icon, onclick, subtitle, title }: Props = $props();
</script>

<button
	class="flex w-full items-center gap-x-4 rounded-md px-2 py-1 text-left hover:bg-gray-200 hover:dark:bg-gray-700"
	type="button"
	{onclick}
>
	<span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-gray-200">
		<AppIcon {icon} class="h-6 w-6 text-gray-800" />
	</span>
	<span class="min-w-0">
		<span class="block text-base font-semibold text-gray-700 dark:text-white">{title}</span>
		{#if subtitle}
			<span class="block text-gray-700 dark:text-white">{subtitle}</span>
		{/if}
	</span>
</button>
