<script>
	import { onMount, onDestroy } from 'svelte';
	import { trapFocus } from '../../../utils/focusTrap';
	import { applyAriaAttributes } from '../../../utils/ariaHelpers';

	export let isOpen = false;
	export let onClose;

	let modalElement;

	onMount(() => {
		// Ensure focus is trapped within the modal when it is open
		// and restore focus to the previously focused element when the modal is closed.
		if (isOpen && modalElement) {
			const releaseFocus = trapFocus(modalElement);

			// Apply ARIA attributes to enhance accessibility for screen readers.
			applyAriaAttributes(modalElement, {
				role: 'dialog',
				'aria-modal': 'true',
				'aria-label': 'Stop Information'
			});

			// Cleanup function to release focus trap when the component is destroyed.
			return () => releaseFocus();
		}
	});
</script>

{#if isOpen}
	<div class="modal-overlay" on:click={onClose}>
		<div class="modal-content" bind:this={modalElement} on:click|stopPropagation>
			<slot />
			<!-- Close button with ARIA label for accessibility -->
			<button on:click={onClose} aria-label="Close modal">Close</button>
		</div>
	</div>
{/if}
