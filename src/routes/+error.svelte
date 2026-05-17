<script>
	import ErrorPage from '$components/errors/ErrorPage.svelte';
	import { getErrorTranslationKeys } from '$lib/errors.js';
	import { t } from 'svelte-i18n';

	/** @type {{ error: App.Error; status: number }} */
	let { error, status } = $props();

	const { titleKey } = $derived(getErrorTranslationKeys(status));
</script>

<svelte:head>
	<title>{status} – {$t(titleKey)}</title>
</svelte:head>

<ErrorPage {status} {error} />
