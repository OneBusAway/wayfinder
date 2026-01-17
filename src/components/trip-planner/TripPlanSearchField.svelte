<script>
	import { faMapMarkerAlt, faX } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { t } from 'svelte-i18n';
	/**
	 * @typedef {Object} Props
	 * @property {string} [inputId]
	 * @property {string} [place]
	 * @property {any} [results]
	 * @property {boolean} [isLoading]
	 * @property {any} onInput
	 * @property {any} onClear
	 * @property {any} onSelect
	 */

	/** @type {Props} */
	let {
		inputId = 'location-input',
		place = $bindable(''),
		results = [],
		isLoading = false,
		onInput,
		onClear,
		onSelect
	} = $props();

	function handleInput(event) {
		onInput(event.target.value);
	}

	function handleClear() {
		onClear();
	}

	function handleSelect(result) {
		onSelect(result);
	}
</script>

<div class="relative">
	<input
		id={inputId}
		type="text"
		bind:value={place}
		oninput={handleInput}
		placeholder="{$t('trip-planner.search_for_a_place')}..."
		class="block w-full rounded-md border-gray-300 pr-10 text-sm text-black shadow-sm focus:border-blue-500 focus:ring-blue-500"
	/>
	{#if place}
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex items-center pr-3"
			onclick={handleClear}
			aria-label="Clear"
		>
			<FontAwesomeIcon icon={faX} class="size-5 text-gray-400" />
		</button>
	{/if}
	{#if isLoading}
		<p
			class="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-500 shadow-lg"
		>
			{$t('trip-planner.loading')}...
		</p>
	{:else if results && results.length > 0}
		<ul
			class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
		>
			{#each results as result}
				<button
					class="flex w-full cursor-pointer items-center px-4 py-2 text-left hover:bg-gray-100 dark:text-black"
					onclick={() => handleSelect(result)}
				>
					<FontAwesomeIcon icon={faMapMarkerAlt} class="mr-2 text-gray-400  " />
					{result.displayText}
				</button>
			{/each}
		</ul>
	{/if}
</div>
