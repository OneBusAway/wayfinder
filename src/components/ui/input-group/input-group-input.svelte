<script lang="ts">
	import { Input } from '$components/ui/input/index.js';
	import { cn } from '$lib/utils/shadcn.js';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		...props
	}: ComponentProps<typeof Input> = $props();

	const controlClass = $derived(
		cn(
			'flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent',
			className
		)
	);
</script>

{#if type === 'file'}
	<Input
		bind:ref
		data-slot="input-group-control"
		class={controlClass}
		type="file"
		bind:files
		bind:value
		{...props}
	/>
{:else}
	<Input
		bind:ref
		data-slot="input-group-control"
		class={controlClass}
		{type}
		bind:value
		{...props}
	/>
{/if}
