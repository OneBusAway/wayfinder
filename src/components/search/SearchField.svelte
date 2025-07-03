<script>
	import { t } from 'svelte-i18n';
	import analytics from '$lib/Analytics/PlausibleAnalytics';

	/**
	 * @typedef {Object} Props
	 * @property {string} [value]
	 */

	/** @type {Props} */
	let { value = $bindable(''), handleSearchResults } = $props();

	async function handleSearch() {
		try {
			const trimmedValue = value.trim();
			const response = await fetch(`/api/oba/search?query=${encodeURIComponent(trimmedValue)}`);
			const results = await response.json();

			handleSearchResults(results);
			analytics.reportSearchQuery(trimmedValue);
		} catch (error) {
			console.error('Error fetching search results:', error);
		}
	}

	const onHandleSearch = (event) => {
		const trimmedValue = value.trim();
		if (!trimmedValue) {
			return;
		}
		if (event.key === 'Enter' || typeof event.key === 'undefined') {
			handleSearch();
		}
	};
</script>

<div>
	<label for="search" class="sr-only">{$t('search.search')}</label>
	<div class="mt-2 flex rounded-md shadow-sm">
		<div class="relative flex flex-grow items-stretch focus-within:z-10">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<svg
					class="h-4 w-4 text-gray-500 dark:text-gray-400"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 20 20"
				>
					<path
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
					/>
				</svg>
			</div>
			<input
				type="text"
				name="search"
				id="search"
				class="block w-full rounded-none rounded-l-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
				placeholder={$t('search.placeholder')}
				bind:value
				onkeydown={onHandleSearch}
			/>
		</div>
		<button
			type="button"
			onclick={onHandleSearch}
			disabled={!value.trim()}
			class="rotate-rtl relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed dark:text-gray-300 dark:hover:text-gray-900"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="size-5"
			>
				<path
					fill-rule="evenodd"
					d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
					clip-rule="evenodd"
				/>
			</svg>
			<span class="sr-only"> {$t('search.search')} </span>
		</button>
	</div>
</div>
