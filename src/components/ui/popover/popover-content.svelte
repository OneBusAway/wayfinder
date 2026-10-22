<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils/shadcn.js';
	import PopoverPortal from './popover-portal.svelte';
	import type { ComponentProps } from 'svelte';
	import { isRTL } from '$lib/i18n';
	import { locale } from 'svelte-i18n';

	let {
		ref = $bindable(null),
		class: className,
		align = 'center',
		dir,
		portalProps,
		sideOffset = 4,
		trapFocus = false,
		onCloseAutoFocus,
		...restProps
	}: PopoverPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof PopoverPortal>>;
	} = $props();

	// bits-ui defaults `dir` to "ltr" rather than inheriting it, so derive it from the app locale.
	const resolvedDir = $derived(dir ?? ($locale != null && isRTL($locale) ? 'rtl' : 'ltr'));

	// Without a focus trap, focus may already have moved elsewhere (e.g. an outside click on
	// another control) by the time the popover closes; returning it to the trigger would steal it.
	function handleCloseAutoFocus(event: Event) {
		onCloseAutoFocus?.(event);
		if (event.defaultPrevented) return;
		const active = document.activeElement;
		if (active && active !== document.body && !ref?.contains(active)) {
			event.preventDefault();
		}
	}
</script>

<PopoverPortal {...portalProps}>
	<PopoverPrimitive.Content
		bind:ref
		{align}
		class={cn(
			'z-50 flex origin-(--bits-popover-content-transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
			className
		)}
		data-slot="popover-content"
		dir={resolvedDir}
		{sideOffset}
		{trapFocus}
		onCloseAutoFocus={handleCloseAutoFocus}
		{...restProps}
	/>
</PopoverPortal>
