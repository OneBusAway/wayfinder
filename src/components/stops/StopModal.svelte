<script>
	import { onMount, onDestroy } from 'svelte';
	import { trapFocus } from '../../../utils/focusTrap';
	import { applyAriaAttributes } from '../../../utils/ariaHelpers';

	export let isOpen = false;
	export let onClose;

	let modalElement;

	onMount(() => {
		if (isOpen && modalElement) {
			const releaseFocus = trapFocus(modalElement);
			applyAriaAttributes(modalElement, {
				role: 'dialog',
				'aria-modal': 'true',
				'aria-label': 'Stop Information',
			});

			return () => releaseFocus();
		}
	});
</script>

{#if isOpen}
	<div class="modal-overlay" on:click={onClose}>
		<div
			class="modal-content"
			bind:this={modalElement}
			on:click|stopPropagation
		>
			<slot />
			<button on:click={onClose} aria-label="Close modal">Close</button>
		</div>
	</div>
{/if}
