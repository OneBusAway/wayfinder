<script>
	import ModalPane from '$components/navigation/ModalPane.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import RouteItem from '$components/RouteItem.svelte';
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { filterAndSortRoutes } from '$lib/routeUtils';

	let { handleModalRouteClick, closePane } = $props();

	let routes = $state([]);
	let filteredRoutes = $state([]);
	let query = $state('');
	let loading = $state(false);

	onMount(async () => {
		await fetchRoutes();
	});

	async function fetchRoutes() {
		try {
			loading = true;
			const response = await fetch('/api/oba/routes');
			const data = await response.json();

			if (response.ok) {
				routes = data.routes;
				filterRoutes();
			} else {
				console.error('Failed to fetch routes:', data.error);
				routes = [];
				filteredRoutes = [];
			}
		} catch (error) {
			console.error('Error fetching routes:', error);
			routes = [];
			filteredRoutes = [];
		} finally {
			loading = false;
		}
	}

	async function handleSearch(event) {
		query = event.target.value;
		filterRoutes();
	}

	function filterRoutes() {
		filteredRoutes = filterAndSortRoutes(routes, query);
	}
</script>

<ModalPane {closePane} title={$t('search.all_routes')}>
	{#if loading}
		<LoadingSpinner />
	{/if}

	{#if routes.length > 0}
		<div>
			<div class="sticky top-0">
				<input
					type="text"
					placeholder={$t('search.search_for_routes')}
					class="w-full rounded-lg border border-gray-300 p-2 pl-10 text-gray-700 placeholder-gray-500 dark:border-gray-700 dark:text-gray-900 dark:placeholder-gray-900"
					bind:value={query}
					oninput={handleSearch}
				/>
				<svg
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-500 dark:text-gray-400"
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

			<div>
				{#if filteredRoutes.length > 0}
					{#each filteredRoutes as route}
						<RouteItem {route} {handleModalRouteClick} />
					{/each}
				{:else}
					<div class="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
						{$t('search.no_routes_found')}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</ModalPane>
