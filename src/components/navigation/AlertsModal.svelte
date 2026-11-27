<script lang="ts">
	import * as Dialog from '$components/ui/dialog';
	import { Button } from '$components/ui/button';
	import type { transit_realtime } from 'gtfs-realtime-bindings';
	import { getLocaleFromNavigator, locale, t } from 'svelte-i18n';
	import { httpUrlOrNull } from '$lib/urls';

	interface Props {
		alert: transit_realtime.IAlert;
		open?: boolean;
	}

	let { alert, open = $bindable(false) }: Props = $props();

	let currentLanguage = $derived(
		String($locale || getLocaleFromNavigator() || 'en')
			.split('-')[0]
			.toLowerCase()
	);

	function getTranslation(translations: transit_realtime.TranslatedString.ITranslation[]): string {
		if (!translations || translations.length === 0) {
			return '';
		}
		return (
			translations.find((tr) => tr.language?.split('-')[0]?.toLowerCase() === currentLanguage)
				?.text ||
			translations.find((tr) => tr.language?.split('-')[0]?.toLowerCase() === 'en')?.text ||
			translations[0]?.text ||
			''
		);
	}

	function getHeaderTextTranslation() {
		return getTranslation(alert?.headerText?.translation || []);
	}

	function getBodyTextTranslation() {
		return getTranslation(alert?.descriptionText?.translation || []);
	}

	function getUrlTranslation() {
		return getTranslation(alert?.url?.translation || []).trim();
	}

	let alertUrl = $derived(httpUrlOrNull(getUrlTranslation()));
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
				<Button onclick={() => window.open(alertUrl, '_blank', 'noopener,noreferrer')}>
					{$t('alert.more_info')}
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
