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
	 * @property {(value: string) => void} onInput
	 * @property {() => void} onClear
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

	const listboxId = `${inputId}-listbox`;
	const optionId = (index) => `${inputId}-option-${index}`;

	// Which option aria-activedescendant points at. -1 means the user is on the
	// input itself and Enter should submit whatever they typed.
	let activeIndex = $state(-1);
	// Escape hides the list without clearing the query. Typing brings it back.
	let dismissed = $state(false);

	let isOpen = $derived(!isLoading && !dismissed && results?.length > 0);
	// The parent owns `results`, so it can shrink underneath a stale activeIndex.
	let activeOption = $derived(isOpen && activeIndex < results.length ? activeIndex : -1);

	function handleInput(event) {
		activeIndex = -1;
		dismissed = false;
		onInput(event.target.value);
	}

	function handleClear() {
		activeIndex = -1;
		dismissed = false;
		onClear();
	}

	function handleSelect(result) {
		activeIndex = -1;
		dismissed = false;
		onSelect(result);
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') {
			if (isOpen) {
				event.preventDefault();
				dismissed = true;
				activeIndex = -1;
			}
			return;
		}

		if (!isOpen) return;

		const last = results.length - 1;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = activeOption >= last ? 0 : activeOption + 1;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = activeOption <= 0 ? last : activeOption - 1;
		} else if (event.key === 'Enter' && activeOption >= 0) {
			event.preventDefault();
			handleSelect(results[activeOption]);
		}
	}
</script>

<div class="relative">
	<input
		id={inputId}
		type="text"
		role="combobox"
		aria-expanded={isOpen}
		aria-controls={isOpen ? listboxId : undefined}
		aria-activedescendant={activeOption >= 0 ? optionId(activeOption) : undefined}
		aria-autocomplete="list"
		bind:value={place}
		oninput={handleInput}
		onkeydown={handleKeydown}
		placeholder="{$t('trip-planner.search_for_a_place')}..."
		class="block w-full rounded-md border-gray-300 pr-10 text-sm text-black shadow-sm focus:border-blue-500 focus:ring-blue-500"
	/>
	{#if place}
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex items-center pr-3"
			onclick={handleClear}
			aria-label={$t('search.clear')}
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
	{:else if isOpen}
		<ul
			id={listboxId}
			role="listbox"
			class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
		>
			{#each results as result, index}
				<!-- Options are deliberately not tab stops. In the combobox pattern focus
				     stays on the input and the selection moves via aria-activedescendant,
				     so the keyboard path lives in handleKeydown, not on each option. -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					id={optionId(index)}
					role="option"
					aria-selected={index === activeOption}
					class="flex w-full cursor-pointer items-center px-4 py-2 text-left dark:text-black"
					class:bg-gray-100={index === activeOption}
					onclick={() => handleSelect(result)}
					onmousemove={() => (activeIndex = index)}
				>
					<FontAwesomeIcon icon={faMapMarkerAlt} class="mr-2 text-gray-400" />
					{result.displayText}
				</li>
			{/each}
		</ul>
	{/if}
</div>
