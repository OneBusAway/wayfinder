<script>
	import { fly } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faX, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
	import { keybinding } from '$lib/keybinding';
	import { createEventDispatcher } from 'svelte';
	import { pushState } from '$app/navigation';

	const dispatch = createEventDispatcher();
	let collapsed = false;

	function closePane() {
		pushState('/');
		dispatch('close');
	}

	function toggleCollapse() {
		collapsed = !collapsed;
	}
</script>

<div
	class="modal-pane transition-height px-4 rounded-b-none pointer-events-auto"
	class:collapsed
	in:fly={{ y: 200, duration: 500 }}
	out:fly={{ y: 200, duration: 500 }}
>
	<div class="flex items-center justify-end py-3">
		{#key collapsed}
			<button
				type="button"
				on:click={toggleCollapse}
				class="collapse-button dark:text-white text-lg font-black text-black"
			>
				<FontAwesomeIcon icon={collapsed ? faChevronDown : faChevronUp} />
				<span class="sr-only">{collapsed ? 'Expand' : 'Collapse'}</span>
			</button>
		{/key}
		<button
			type="button"
			on:click={closePane}
			use:keybinding={{ code: 'Escape' }}
			class="close-button"
		>
			<FontAwesomeIcon icon={faX} class="dark:text-white font-black text-black" />
			<span class="sr-only">Close</span>
		</button>
	</div>

	<div class="modal-content">
		<slot></slot>
	</div>
</div>

<style lang="postcss">
	.modal-pane {
		@apply h-full rounded-b-none;
	}
	.modal-pane.collapsed {
		@apply h-16 rounded-b-lg;
		overflow: hidden;
	}
	.close-button, .collapse-button {
		@apply rounded px-4 py-2;
		@apply transition duration-300 ease-in-out hover:bg-neutral-200 dark:hover:bg-neutral-200/50;
	}
</style>
