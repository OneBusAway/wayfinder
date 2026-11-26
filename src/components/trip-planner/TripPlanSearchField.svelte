<script lang="ts">
	import * as InputGroup from '$components/ui/input-group';
	import { MapPin, X } from '@lucide/svelte';
	import type { FormEventHandler } from 'svelte/elements';
	import type { PlaceSuggestion } from '$lib/types';
	import { t } from 'svelte-i18n';

	interface Props {
		inputId?: string;
		isLoading?: boolean;
		results?: PlaceSuggestion[];
		value?: string;
		onInput: (value: string) => void;
		onClear: () => void;
		onSelect: (suggestion: PlaceSuggestion) => void;
		onDismiss?: () => void;
	}

	let {
		inputId = 'location-input',
		isLoading = false,
		results = [],
		value = $bindable(''),
		onInput,
		onClear,
		onSelect,
		onDismiss = () => {}
	}: Props = $props();

	let activeIndex = $state(-1);
	let listboxId = $derived(`${inputId}-listbox`);
	let hasResults = $derived(!isLoading && Array.isArray(results) && results.length > 0);

	const handleInput: FormEventHandler<HTMLInputElement> = function handleInput(event) {
		activeIndex = -1;
		onInput(event.currentTarget.value);
	};

	function handleClear() {
		onClear();
	}

	function handleSelect(result: PlaceSuggestion) {
		activeIndex = -1;
		onSelect(result);
	}

	function optionId(index: number) {
		return `${listboxId}-option-${index}`;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (!hasResults && !isLoading) return;

			event.preventDefault();
			activeIndex = -1;
			onDismiss();
			return;
		}

		if (!hasResults) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				activeIndex = activeIndex < results.length - 1 ? activeIndex + 1 : 0;
				break;
			case 'ArrowUp':
				event.preventDefault();
				activeIndex = activeIndex > 0 ? activeIndex - 1 : results.length - 1;
				break;
			case 'Enter':
				if (activeIndex < 0) return;
				event.preventDefault();
				handleSelect(results[activeIndex]);
				break;
		}
	}
</script>

<div class="relative">
	<InputGroup.Root class="bg-background">
		<InputGroup.Input
			aria-autocomplete="list"
			aria-expanded={hasResults}
			aria-haspopup="listbox"
			aria-controls={hasResults ? listboxId : undefined}
			aria-activedescendant={hasResults && activeIndex >= 0 ? optionId(activeIndex) : undefined}
			autocomplete="off"
			id={inputId}
			bind:value
			oninput={handleInput}
			onkeydown={handleKeydown}
			role="combobox"
			placeholder="{$t('trip-planner.search_for_a_place')}..."
		/>
		{#if value}
			<InputGroup.Addon align="inline-end">
				<InputGroup.Button aria-label={$t('search.clear')} onclick={handleClear} size="icon-sm">
					<X />
				</InputGroup.Button>
			</InputGroup.Addon>
		{/if}
	</InputGroup.Root>
	{#if isLoading}
		<p
			role="status"
			class="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-500 shadow-lg"
		>
			{$t('trip-planner.loading')}...
		</p>
	{:else if results && results.length > 0}
		<ul
			id={listboxId}
			role="listbox"
			class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
		>
			<!-- Geocoders do not provide unique identifiers so `index` is the only possible key. -->
			{#each results as result, index (index)}
				<li role="presentation">
					<button
						id={optionId(index)}
						type="button"
						role="option"
						tabindex="-1"
						aria-selected={activeIndex === index}
						aria-posinset={index + 1}
						aria-setsize={results.length}
						class="flex w-full cursor-pointer items-center px-4 py-2 text-left hover:bg-gray-100 dark:text-black {activeIndex ===
						index
							? 'bg-gray-100'
							: ''}"
						onclick={() => handleSelect(result)}
					>
						<MapPin class="mr-2 h-4 w-4 text-gray-400" />
						{result.displayText}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
