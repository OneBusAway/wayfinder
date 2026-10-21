<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils/shadcn.js";
	import type { HTMLAttributes } from "svelte/elements";

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
	class={cn("gap-2 border-b -mx-4 px-4 pb-4 flex flex-col", className)}
	{...restProps}
>
	{@render children?.()}
</div>
