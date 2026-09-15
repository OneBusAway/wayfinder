<!--
    This Svelte component renders a FontAwesome arrow icon that rotates based on the provided `stopDirection` prop.

    Props:
    - `stopDirection` (string): The direction in which the arrow should point.
      Possible values are 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'.
      If the value is not one of these, the arrow will be hidden.
-->

<script>
	import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	/**
	 * @typedef {Object} Props
	 * @property {string} [stopDirection]
	 */

	/** @type {Props} */
	let { stopDirection = '' } = $props();

	// Rotation classes keyed by compass direction. `rotate-135` and `rotate-225`
	// are registered via `theme.extend.rotate` in tailwind.config.js.
	const ROTATION_CLASS_BY_DIRECTION = {
		N: '-rotate-90',
		NE: '-rotate-45',
		E: 'rotate-0',
		SE: 'rotate-45',
		S: 'rotate-90',
		SW: 'rotate-135',
		W: 'rotate-180',
		NW: 'rotate-225'
	};

	// Wrap the icon in a span we control so the rotation class updates
	// reactively when `stopDirection` changes. The FontAwesome component
	// only reads its `class` prop during initialization, so later changes
	// aren't reflected on the rendered SVG.
	let rotationClass = $derived(ROTATION_CLASS_BY_DIRECTION[stopDirection] ?? 'hidden');
</script>

<span class="inline-block {rotationClass}" data-testid="compass-arrow">
	<FontAwesomeIcon icon={faArrowRight} />
</span>
