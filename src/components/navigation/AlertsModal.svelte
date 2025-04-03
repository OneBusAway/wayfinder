<script>
	import { Modal, Button } from 'flowbite-svelte';
	import { getLocaleFromNavigator } from 'svelte-i18n';
	import { t } from 'svelte-i18n';
	import { onMount } from 'svelte'; // Removed unused onDestroy import
	import { trapFocus } from '../../../utils/focusTrap'; // Utility to trap focus within the modal for accessibility
	import { applyAriaAttributes } from '../../../utils/ariaHelpers'; // Utility to apply ARIA attributes for accessibility

	let showModal = true; // Fixed invalid $state(true) syntax
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
			// Trap focus within the modal element for better accessibility
			const releaseFocus = trapFocus(modalElement);

			// Apply ARIA attributes to the modal element for screen readers
			applyAriaAttributes(modalElement, {
				role: 'dialog', // Defines the modal as a dialog
				'aria-modal': 'true', // Indicates that the modal is modal and disables interaction with the background
				'aria-label': 'Alerts' // Provides an accessible name for the modal
			});

			// Cleanup function to release focus trapping
			return () => releaseFocus();
		}
	});

	function handleModalOpen() {
		// Save the currently focused element to restore focus later
		previouslyFocusedElement = document.activeElement;

		// Add focus trapping to the modal element
		const modalElement = document.querySelector('.modal-pane');
		modalElement.addEventListener('keydown', trapFocus);

		// Set focus to the modal element
		modalElement.focus();
	}

	function handleModalClose() {
		// Remove focus trapping from the modal element
		const modalElement = document.querySelector('.modal-pane');
		modalElement.removeEventListener('keydown', trapFocus);

		// Restore focus to the previously focused element
		if (previouslyFocusedElement) {
			previouslyFocusedElement.focus();
		}
	}
</script>

{#if showModal}
	<div class="modal-overlay" on:click={handleModalClose}>
		<div class="modal-content" bind:this={modalElement} on:click|stopPropagation>
			<Modal
				title={getHeaderTextTranslation()}
				bind:open={showModal}
				autoclose
				on:open={handleModalOpen}
				on:close={handleModalClose}
			>
				<p
					id="alert-modal-description"
					class="text-base leading-relaxed text-gray-500 dark:text-gray-200"
				>
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
