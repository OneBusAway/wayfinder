<script lang="ts">
	import { Button } from '$components/ui/button';
	import * as ButtonGroup from '$components/ui/button-group';
	import * as InputGroup from '$components/ui/input-group';
	import { ArrowRight, Search } from '@lucide/svelte';
	import type { SearchResults } from '$lib/types';
	import analytics from '$lib/Insights';
	import { t } from 'svelte-i18n';
	import { onDestroy } from 'svelte';
	import { notifications } from '$stores/notificationStore';

	interface Props {
		handleSearchResults: (results: SearchResults) => void;
		value?: string | null;
	}

	let { handleSearchResults, value = $bindable('') }: Props = $props();

	// Id of the toast this field raised, so it only ever clears its own.
	let notificationId: number | null = null;

	async function handleSearch() {
		const trimmedValue = (value || '').trim();
		notifications.dismiss(notificationId);
		notificationId = null;

		try {
			const response = await fetch(`/api/oba/search?query=${encodeURIComponent(trimmedValue)}`);
			// A failed search answers with an error body, not results.
			if (!response.ok) {
				throw new Error(`Search request failed with status ${response.status}`);
			}
			const results = await response.json();

			handleSearchResults(results);
			analytics.reportSearchQuery(trimmedValue);
		} catch (error) {
			console.error('Error fetching search results:', error);
			notificationId = notifications.show({
				message: $t('notifications.search_failed'),
				variant: 'error',
				onRetry: handleSearch
			});
		}
	}

	onDestroy(() => {
		notifications.dismiss(notificationId);
	});

	function onHandleSearch(event: SubmitEvent) {
		event.preventDefault();
		const trimmedValue = (value || '').trim();
		if (!trimmedValue) return;
		handleSearch();
	}
</script>

<form class="pt-1" onsubmit={onHandleSearch}>
	<label for="query" class="sr-only">{$t('search.search')}</label>
	<ButtonGroup.Root class="w-full">
		<InputGroup.Root class="bg-background">
			<InputGroup.Input id="query" name="query" placeholder={$t('search.placeholder')} bind:value />
			<InputGroup.Addon>
				<Search />
			</InputGroup.Addon>
		</InputGroup.Root>
		<Button disabled={!(value || '').trim()} type="submit" variant="outline">
			<ArrowRight class="rotate-rtl" />
			<span class="sr-only">{$t('search.search')}</span>
		</Button>
	</ButtonGroup.Root>
</form>
