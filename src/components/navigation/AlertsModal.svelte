<script>
	import { Modal, Button } from 'flowbite-svelte';
	import { getLocaleFromNavigator } from 'svelte-i18n';
	import { t } from 'svelte-i18n';

	let showModal = $state(true);

	let { alert } = $props();

	const currentLanguage = String(getLocaleFromNavigator()).split('-')[0];

	function getTranslation(translations) {
		if (!translations || translations.length === 0) {
			return '';
		}
		return (
			translations.find((t) => t.language === currentLanguage)?.text ||
			translations.find((t) => t.language === 'en')?.text ||
			translations[0]?.text ||
			''
		);
	}
	function getHeaderTextTranslation() {
		return getTranslation(alert.headerText?.translation || []);
	}

	function getBodyTextTranslation() {
		return getTranslation(alert.descriptionText?.translation || []);
	}

	function getUrlTranslation() {
		return getTranslation(alert.url?.translation || []);
	}
</script>

<Modal title={getHeaderTextTranslation()} bind:open={showModal} autoclose>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-200">
		{getBodyTextTranslation()}
	</p>
	{#snippet footer()}
		<div class="flex-1 text-right">
			<Button
				class="bg-gray-300 text-black hover:bg-gray-400 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
				on:click={() => (showModal = false)}
			>
				{$t('alert.close')}
			</Button>
			<Button
				class="bg-brand-accent text-white hover:bg-brand-accent dark:bg-brand dark:hover:bg-brand-accent"
				on:click={() => window.open(getUrlTranslation(), '_blank')}
			>
				{$t('alert.more_info')}
			</Button>
		</div>
	{/snippet}
</Modal>
