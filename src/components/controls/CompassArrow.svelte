<!--

    This Svelte component renders a FontAwesome arrow icon that rotates based on the provided `stopDirection` prop.

    Props:
    - `heading` (number, optional): Degrees for `transform: rotate(Ndeg)` (takes precedence over stopDirection).
    - `stopDirection` (string): The direction in which the arrow should point when `heading` is not set.
      Possible values are 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'.
      If the value is not one of these, the arrow will be hidden.
-->

<script>
	import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	/**
	 * @typedef {Object} Props
	 * @property {string} [stopDirection]
	 * @property {number} [heading]
	 */

	/** @type {Props} */
	let { stopDirection = '', heading } = $props();

	function rotationAngleClass() {
		switch (stopDirection) {
			case 'N':
				return '-rotate-90';
			case 'NE':
				return '-rotate-45';
			case 'E':
				return 'rotate-0';
			case 'SE':
				return 'rotate-45';
			case 'S':
				return 'rotate-90';
			case 'SW':
				return 'rotate-135';
			case 'W':
				return 'rotate-180';
			case 'NW':
				return 'rotate-225';
			default:
				return 'hidden';
		}
	}
</script>

{#if typeof heading === 'number'}
	<span class="inline-block" style="transform: rotate({heading}deg);">
		<FontAwesomeIcon icon={faArrowRight} class="" />
	</span>
{:else}
	<FontAwesomeIcon icon={faArrowRight} class={rotationAngleClass()} />
{/if}
