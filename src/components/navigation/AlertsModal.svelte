<script>
	import { Modal, Button } from 'flowbite-svelte';
	import { getLocaleFromNavigator } from 'svelte-i18n';
	import { t } from 'svelte-i18n';
	import { onMount, onDestroy } from 'svelte';
	import { trapFocus } from '../../../utils/focusTrap';
	import { applyAriaAttributes } from '../../../utils/ariaHelpers';

	let showModal = $state(true);
	let previouslyFocusedElement = null;

	let { alert } = $props();

	const currentLanguage = String(getLocaleFromNavigator()).split('-')[0];

	function getTranslation(translations) {
		return (
			translations.find((t) => t.language === currentLanguage)?.text ||
			translations.find((t) => t.language === 'en')?.text ||
			translations[0].text
		);
	}
	function getHeaderTextTranslation() {
		return getTranslation(alert.headerText.translation);
	}

	function getBodyTextTranslation() {
		return getTranslation(alert.descriptionText.translation);
	}

	function getUrlTranslation() {
		return getTranslation(alert.url.translation);
	}

	let modalElement;

	onMount(() => {
		if (showModal && modalElement) {
			const releaseFocus = trapFocus(modalElement);
			applyAriaAttributes(modalElement, {
				role: 'dialog',
				'aria-modal': 'true',
				'aria-label': 'Alerts',
			});

			return () => releaseFocus();
		}
	});

	function handleModalOpen() {
		previouslyFocusedElement = document.activeElement;
		const modalElement = document.querySelector('.modal-pane');
		modalElement.addEventListener('keydown', trapFocus);
		modalElement.focus();
	}

	function handleModalClose() {
		const modalElement = document.querySelector('.modal-pane');
		modalElement.removeEventListener('keydown', trapFocus);
		if (previouslyFocusedElement) {
			previouslyFocusedElement.focus();
		}
	}
</script>

{#if showModal}
	<div class="modal-overlay" on:click={handleModalClose}>
		<div
			class="modal-content"
			bind:this={modalElement}
			on:click|stopPropagation
		>
			<Modal
				title={getHeaderTextTranslation()}
				bind:open={showModal}
				autoclose
				on:open={handleModalOpen}
				on:close={handleModalClose}
				aria-labelledby="alert-modal-title"
				aria-describedby="alert-modal-description"
			>
				<p id="alert-modal-description" class="text-base leading-relaxed text-gray-500 dark:text-gray-200">
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
							class="bg-brand-secondary text-white hover:bg-brand-secondary dark:bg-brand dark:hover:bg-brand-secondary"
							on:click={() => window.open(getUrlTranslation(), '_blank')}
						>
							{$t('alert.more_info')}
						</Button>
					</div>
				{/snippet}
			</Modal>
			<button on:click={handleModalClose} aria-label="Close modal">Close</button>
		</div>
	</div>
{/if}
