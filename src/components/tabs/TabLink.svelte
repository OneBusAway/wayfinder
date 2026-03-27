<script>
	/**
	 * @typedef {Object} Props
	 * @property {boolean} [current]
	 * @property {any} href
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { current = false, href, children } = $props();
</script>

<div class="tab-container__item" class:tab-container__item--active={current}>
	<a {href} class="block">
		{@render children?.()}
	</a>
</div>
