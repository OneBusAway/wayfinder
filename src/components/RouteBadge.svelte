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

	// Auto-size the label to fill the fixed badge box. Two constraints compete,
	// and the smaller wins:
	//   width  — the text wraps on spaces, so the longest unbreakable word caps
	//            the type size (e.g. "First Hill Streetcar" is held to 10px by
	//            "Streetcar").
	//   height — each word roughly costs a line, so multi-word names shrink to
	//            avoid overflowing vertically (e.g. two-line "C Line" -> 21px).
	// Short codes ("60", "8") hit neither limit and grow to the 24px ceiling.
	let words = $derived(
		String(shortName ?? '')
			.trim()
			.split(/\s+/)
			.filter(Boolean)
	);
	let longestWord = $derived(words.reduce((max, word) => Math.max(max, word.length), 1));
	let lineCount = $derived(Math.max(1, words.length));
	let fontSize = $derived(
		Math.max(8, Math.min(24, Math.round(90 / longestWord), Math.round(42 / lineCount)))
	);
</script>

<!-- The iOS-style gloss (top highlight -> transparent -> faint shade) and the
	inset edge shadows are the same for every route, so they live in CSS; only the
	route color and the fitted font size vary per badge. -->
<div
	class="route-badge flex h-14 w-16 shrink-0 items-center justify-center rounded-lg px-1 text-center leading-tight font-bold wrap-break-word"
	style="background-color: {bg}; color: {fg}; font-size: {fontSize}px;"
>
	{shortName}
</div>

<style>
	.route-badge {
		background-image: linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0.28) 0%,
			rgba(255, 255, 255, 0.08) 42%,
			rgba(255, 255, 255, 0) 55%,
			rgba(0, 0, 0, 0.12) 100%
		);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.3),
			inset 0 -1px 1px rgba(0, 0, 0, 0.12);
	}
</style>
