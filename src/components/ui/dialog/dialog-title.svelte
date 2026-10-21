<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { cn } from "$lib/utils/shadcn.js";
	import { getDialogContentContext } from "./context";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.TitleProps = $props();

	const contentContext = getDialogContentContext();
</script>

<DialogPrimitive.Title
	bind:ref
	data-slot="dialog-title"
	class={cn(
		"text-lg/6 font-medium text-secondary-foreground",
		// Keep text clear of the absolutely-positioned close button in the top right.
		contentContext?.showCloseButton && "pr-8",
		className
	)}
	{...restProps}
/>
