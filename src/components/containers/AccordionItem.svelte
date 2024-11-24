<script>
	import { getContext } from 'svelte';
	import { slide } from 'svelte/transition';

	const id = crypto.randomUUID();
	const { registerItem } = getContext('accordion');
	const { isActive, activate } = registerItem(id);

	function toggle() {
		activate();
	}
</script>

<div class="relative">
	<!-- Added sticky positioning to the button wrapper -->
	<div class="sticky top-0 z-10 bg-white dark:bg-gray-800">
		<button
			type="button"
			class="flex w-full items-center justify-between py-3 text-left text-base font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
			class:text-gray-900={$isActive}
			class:dark:text-white={$isActive}
			on:click={toggle}
			aria-expanded={$isActive}
		>
			<slot name="header" />
			<svg
				class="h-6 w-6 shrink-0 transition-transform"
				class:rotate-180={$isActive}
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>
	</div>

	{#if $isActive}
		<div transition:slide|local>
			<div class="py-3">
				<slot />
			</div>
		</div>
	{/if}
</div>
