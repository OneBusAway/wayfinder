<script>
	import { fly } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faX } from '@fortawesome/free-solid-svg-icons';
	import { keybinding } from '$lib/keybinding';
	import { createEventDispatcher } from 'svelte';
	import { pushState } from '$app/navigation';

	const dispatch = createEventDispatcher();

	function closePane() {
		pushState('/');
		dispatch('close');
	}
</script>

<div
	class="modal-pane pointer-events-auto h-full rounded-b-none px-4"
	in:fly={{ y: 200, duration: 500 }}
	out:fly={{ y: 200, duration: 500 }}
>
	<div class="py-1 text-right">
		<button
			type="button"
			on:click={closePane}
			use:keybinding={{ code: 'Escape' }}
			class="close-button"
		>
			<FontAwesomeIcon icon={faX} class="font-black text-black dark:text-white" />
			<span class="sr-only">Close</span>
		</button>
	</div>

	<div class="modal-content">
		<slot></slot>
	</div>
</div>

<style lang="postcss">
	.close-button {
		@apply rounded px-4 py-2;
		@apply transition duration-300 ease-in-out hover:bg-neutral-200 dark:hover:bg-neutral-200/50;
	}
</style>
