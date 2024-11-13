<script>
	import { faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	export let label = '';
	export let place = '';
	export let results = [];
	export let isLoading = false;
	export let onInput;
	export let onClear;
	export let onSelect;

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
	<label for="location-input" class="block text-sm font-medium text-gray-700 dark:text-white"
		>{label}</label
	>
	<div class="relative">
		<input
			id="location-input"
			type="text"
			bind:value={place}
			on:input={handleInput}
			placeholder="Enter location"
			class="dark: mt-1 block w-full rounded-md border-gray-300 pr-10 text-black shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
		/>
		{#if place}
			<button
				type="button"
				class="absolute inset-y-0 right-0 flex items-center pr-3"
				on:click={handleClear}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 text-gray-400"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		{/if}
	</div>
	{#if isLoading}
		<p
			class="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-500 shadow-lg"
		>
			Loading...
		</p>
	{:else if results.length > 0}
		<ul
			class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
		>
			{#each results as result}
				<button
					class="flex w-full cursor-pointer items-center px-4 py-2 text-left hover:bg-gray-100 dark:text-black"
					on:click={() => handleSelect(result)}
				>
					<FontAwesomeIcon icon={faMapMarkerAlt} class="mr-2 text-gray-400  " />
					{result.text}
				</button>
			{/each}
		</ul>
	{/if}
</div>
