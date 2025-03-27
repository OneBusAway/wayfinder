<script>
	import { fly } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faX } from '@fortawesome/free-solid-svg-icons';
	import { keybinding } from '$lib/keybinding';
	import { onMount, onDestroy } from 'svelte';
	/**
	 * @typedef {Object} Props
	 * @property {string} [title]
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { title = '', children, closePane } = $props();

	let previouslyFocusedElement = null;

	function trapFocus(event) {
		const focusableElements = event.target.querySelectorAll(
			'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
		);
		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		if (event.shiftKey) {
			if (document.activeElement === firstElement) {
				lastElement.focus();
				event.preventDefault();
			}
		} else {
			if (document.activeElement === lastElement) {
				firstElement.focus();
				event.preventDefault();
			}
		}
	}

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

	onMount(() => {
		handleModalOpen();
	});

	onDestroy(() => {
		handleModalClose();
	});
</script>

<div
	class="modal-pane pointer-events-auto h-full rounded-b-none px-4"
	in:fly={{ y: 200, duration: 500 }}
	out:fly={{ y: 200, duration: 500 }}
	aria-labelledby="modal-title"
	aria-describedby="modal-description"
>
	<div class="flex h-full flex-col">
		<div class="flex py-1">
			<div class="text-normal flex-1 self-center font-semibold" id="modal-title">{title}</div>
			<div>
				<button
					type="button"
					onclick={closePane}
					use:keybinding={{ code: 'Escape' }}
					class="close-button"
				>
					<FontAwesomeIcon icon={faX} class="font-black text-black dark:text-white" />
					<span class="sr-only">Close</span>
				</button>
			</div>
		</div>

		<div class="relative flex-1" id="modal-description">
			<div class="absolute inset-0 overflow-y-auto">
				{@render children?.()}
				<div class="mb-4">
					<!-- this empty footer shows a user that the content in the pane hasn't been cut off. -->
					&nbsp;
				</div>
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	.close-button {
		@apply rounded px-4 py-2;
		@apply transition duration-300 ease-in-out hover:bg-neutral-200 dark:hover:bg-neutral-200/50;
	}
</style>
