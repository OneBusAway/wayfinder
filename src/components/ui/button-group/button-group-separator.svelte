<script lang="ts">
	import { Separator } from '$components/ui/separator/index.js';
	import { cn } from '$lib/utils/shadcn.js';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		orientation = 'vertical',
		...restProps
	}: ComponentProps<typeof Separator> = $props();
</script>

<Separator
	bind:ref
	data-slot="button-group-separator"
	{orientation}
	class={cn(
		'relative self-stretch bg-input data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto',
		className
	)}
	{...restProps}
/>
