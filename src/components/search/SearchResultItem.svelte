<script lang="ts">
	import AppIcon from '$components/icons/AppIcon.svelte';
	import type { Component } from 'svelte';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

	interface Props {
		icon: Component | IconDefinition;
		subtitle?: string | null;
		title: string;
		onclick: ((event: MouseEvent) => void) | null;
	}

	const { icon, onclick = null, subtitle = null, title }: Props = $props();
</script>

<button
	class="flex w-full items-center gap-x-4 rounded-md px-2 py-1 text-left hover:bg-gray-200 hover:dark:bg-gray-700"
	type="button"
	{onclick}
>
	<div class="flex items-center gap-x-4">
		<div
			class="flex h-12 w-12 max-w-12 min-w-12 items-center justify-center rounded-full bg-gray-200"
		>
			<AppIcon {icon} class="h-6 w-6 text-gray-800" />
		</div>
		<div>
			<h3 class="text-md font-semibold text-gray-700 dark:text-white">{title}</h3>
			<p class="text-gray-700 dark:text-white">{subtitle}</p>
		</div>
	</div>
</button>
