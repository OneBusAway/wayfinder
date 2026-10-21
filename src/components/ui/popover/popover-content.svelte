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
		...restProps
	}: PopoverPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof PopoverPortal>>;
	} = $props();

	// bits-ui defaults `dir` to "ltr" rather than inheriting it, so derive it from the app locale.
	const resolvedDir = $derived(dir ?? ($locale != null && isRTL($locale) ? 'rtl' : 'ltr'));
</script>

<PopoverPortal {...portalProps}>
	<PopoverPrimitive.Content
		bind:ref
		data-slot="popover-content"
		{sideOffset}
		{align}
		dir={resolvedDir}
		class={cn(
			'z-50 flex origin-(--bits-popover-content-transform-origin) flex-col gap-2.5 rounded-md bg-popover p-2.5 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
			className
		)}
		{...restProps}
	/>
</PopoverPortal>
