<!-- eslint-disable svelte/block-lang -->
<script>
	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { children } = $props();
</script>

<div class="tab-container">
	{@render children?.()}
</div>
