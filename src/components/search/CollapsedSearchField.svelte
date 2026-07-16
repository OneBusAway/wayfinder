<!--
    @component
    The collapsed, single-line stand-in for the full SearchPane shown on phones
    while a stop's bottom sheet is open. Tapping it re-opens the full search pane.

    @prop {Function} onclick - Called when the field is tapped
-->

<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faMagnifyingGlass, faArrowRight } from '@fortawesome/free-solid-svg-icons';
	import '$lib/i18n.js';
	import { t } from 'svelte-i18n';

	let { onclick } = $props();
</script>

<button
	type="button"
	{onclick}
	class="pointer-events-auto flex w-full items-center gap-2.5 rounded-lg border border-gray-300 bg-white/95 px-3.5 py-2.5 text-sm text-gray-500 shadow-md backdrop-blur-sm dark:border-gray-600 dark:bg-surface-dark/95 dark:text-gray-400"
>
	<FontAwesomeIcon icon={faMagnifyingGlass} class="text-[13px]" />
	<span class="flex-1 truncate text-left">{$t('search.placeholder')}</span>
	<FontAwesomeIcon icon={faArrowRight} class="rotate-rtl text-black dark:text-white" />
</button>
