<script>
	import { t } from 'svelte-i18n';
	import { getCustomErrorDetail, getErrorTranslationKeys } from '$lib/errors.js';

	/**
	 * @typedef {Object} Props
	 * @property {number} status
	 * @property {App.Error | null | undefined} [error]
	 */

	/** @type {Props} */
	let { status, error = null } = $props();

	const { titleKey, messageKey } = $derived(getErrorTranslationKeys(status));
	const customDetail = $derived(getCustomErrorDetail(error, status));
</script>

<section
	class="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto px-4 py-12 text-center sm:px-6"
	aria-labelledby="error-title"
>
	<p
		class="text-7xl font-bold tabular-nums tracking-tight text-brand-accent dark:text-brand sm:text-8xl"
		aria-hidden="true"
	>
		{status}
	</p>
	<p class="sr-only">{$t('errors.status_label', { values: { status } })}</p>

	<h1 id="error-title" class="h1 mt-6 max-w-lg">
		{$t(titleKey)}
	</h1>

	<p class="mt-3 max-w-md text-base text-gray-600 dark:text-gray-400">
		{#if customDetail}
			{customDetail}
		{:else}
			{$t(messageKey)}
		{/if}
	</p>

	<a href="/" class="button--primary mt-8 inline-flex min-h-11 items-center justify-center px-6">
		{$t('errors.go_home')}
	</a>
</section>
