<script>
	import { createBubbler } from 'svelte/legacy';

	const bubble = createBubbler();
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	/**
	 * @typedef {Object} Props
	 * @property {any} [icon]
	 * @property {any} [title]
	 * @property {any} [subtitle]
	 */

	/** @type {Props} */
	let { icon = null, title = null, subtitle = null } = $props();
</script>

<button
	type="button"
	onclick={bubble('click')}
	class="flex w-full items-center gap-x-4 rounded-md px-2 py-1 text-left hover:bg-gray-200 hover:dark:bg-gray-700"
>
	<div class="flex items-center gap-x-4">
		<div
			class="flex h-12 w-12 min-w-12 max-w-12 items-center justify-center rounded-full bg-gray-200"
		>
			<FontAwesomeIcon {icon} class="text-2xl text-gray-800" />
		</div>

		<div>
			<h3 class="text-lg font-semibold text-gray-700 dark:text-white">{title}</h3>
			<p class="text-gray-700 dark:text-white">{subtitle}</p>
		</div>
	</div>
</button>
