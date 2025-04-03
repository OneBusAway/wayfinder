<script>
	import { onMount, onDestroy } from 'svelte';
	import { trapFocus } from '../../../utils/focusTrap';
	import { applyAriaAttributes } from '../../../utils/ariaHelpers';

	export let isOpen = false;
	export let ariaLabel = 'Modal Pane';
	export let onClose;

	let modalElement;

	onMount(() => {
		if (isOpen && modalElement) {
			const releaseFocus = trapFocus(modalElement);
			applyAriaAttributes(modalElement, {
				role: 'dialog',
				'aria-modal': 'true',
				'aria-label': ariaLabel,
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

<style lang="postcss">
	.close-button {
		@apply rounded px-4 py-2;
		@apply transition duration-300 ease-in-out hover:bg-neutral-200 dark:hover:bg-neutral-200/50;
	}
</style>
