<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils/shadcn.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-header"
	class={cn('-mx-4 flex flex-col gap-2 border-b px-4 pb-4', className)}
	{...restProps}
>
	{@render children?.()}
</div>
