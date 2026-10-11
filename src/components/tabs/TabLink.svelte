<script>
	// @ts-check
	import { navigating } from '$app/stores';

	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 * @property {boolean} [current]
	 * @property {string} href
	 */

	/** @type {Props} */
	const { children, current = false, href } = $props();

	// SvelteKit keeps showing the current page until the destination's load
	// finishes, so mark this tab while its page is on the way.
	const pending = $derived.by(() => {
		const destination = $navigating?.to?.url;
		return destination ? new URL(href, destination).pathname === destination.pathname : false;
	});
</script>

<div
	class="tab-container__item"
	class:tab-container__item--active={current}
	class:tab-container__item--pending={pending}
>
	<a {href} class="block" aria-busy={pending ? true : undefined}>
		{@render children?.()}
	</a>
</div>
