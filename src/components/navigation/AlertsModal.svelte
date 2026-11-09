<script lang="ts">
	import * as Dialog from '$components/ui/dialog';
	import { Button } from '$components/ui/button';
	import type { transit_realtime } from 'gtfs-realtime-bindings';
	import { getLocaleFromNavigator } from 'svelte-i18n';
	import { t } from 'svelte-i18n';

	interface Props {
		alert: transit_realtime.IAlert;
		open?: boolean;
	}

	let { alert, open = $bindable(false) }: Props = $props();

	const currentLanguage = String(getLocaleFromNavigator()).split('-')[0];

	function getTranslation(translations: transit_realtime.TranslatedString.ITranslation[]): string {
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
		return getTranslation(alert.url?.translation || []).trim();
	}

	let alertUrl = $derived(getUrlTranslation());
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="flex max-h-[min(640px,85vh)] flex-col">
		<Dialog.Header>
			<Dialog.Title>
				{getHeaderTextTranslation()}
			</Dialog.Title>
		</Dialog.Header>
		<Dialog.Description class="-mx-4 overflow-y-auto px-4">
			{getBodyTextTranslation()}
		</Dialog.Description>
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => {
					open = false;
				}}
			>
				{$t('alert.close')}
			</Button>
			{#if alertUrl}
				<Button onclick={() => window.open(alertUrl, '_blank')}>
					{$t('alert.more_info')}
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
