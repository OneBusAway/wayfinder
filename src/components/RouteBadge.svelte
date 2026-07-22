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

	// Auto-shrink the label so long names (e.g. "Waterfront Shuttle") fit the
	// fixed badge box. The text wraps on spaces, so the constraint is the longest
	// word; short codes ("10", "C Line") stay at the base 14px size.
	let longestWord = $derived(
		String(shortName ?? '')
			.split(/\s+/)
			.reduce((max, word) => Math.max(max, word.length), 1)
	);
	let fontSize = $derived(Math.max(8, Math.min(14, Math.round(90 / longestWord))));
</script>

<div
	class="flex h-14 w-16 shrink-0 items-center justify-center break-words rounded-lg px-1 text-center font-bold leading-tight"
	style="background-color: {bg}; color: {fg}; font-size: {fontSize}px;"
>
	{shortName}
</div>
