<script>
	import { fly } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faX } from '@fortawesome/free-solid-svg-icons';
	import { keybinding } from '$lib/keybinding';
	/**
	 * @typedef {Object} Props
	 * @property {string} [title]
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { title = '', children, closePane } = $props();
</script>

<div
	class="modal-pane pointer-events-auto h-full rounded-b-none"
	in:fly={{ y: 200, duration: 500 }}
	out:fly={{ y: 200, duration: 500 }}
>
	<div class="flex h-full flex-col">
		<div class="flex py-1">
			<div class="text-normal flex-1 self-center font-semibold">{title}</div>
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

		<div class="relative flex-1">
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
