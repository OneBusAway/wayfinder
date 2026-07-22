<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} shortName - Route short name (e.g. "C Line", "21")
	 * @property {string} [color] - Route color as a hex string without "#" (from references.routes)
	 * @property {string} [textColor] - Route text color as a hex string without "#"
	 */

	/** @type {Props} */
	let { shortName, color = null, textColor = null } = $props();

	let bg = $derived(color ? `#${color}` : '#374151');
	let fg = $derived(textColor ? `#${textColor}` : '#ffffff');
</script>

<div
	class="flex h-14 w-16 shrink-0 items-center justify-center break-words rounded-lg px-1 text-center text-sm font-bold leading-tight"
	style="background-color: {bg}; color: {fg};"
>
	{shortName}
</div>
