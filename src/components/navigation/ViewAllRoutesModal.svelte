<script>
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import RouteItem from '$components/RouteItem.svelte';
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { t } from 'svelte-i18n';

	let routes = [];
	let filteredRoutes = [];
	let query = '';
	let loading = false;
	const dispatch = createEventDispatcher();

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

	function handleRouteClick(event) {
		const { route } = event.detail;

		dispatch('routeSelected', { route });
	}

	function filterRoutes() {
		const lowerCaseQuery = query.toLowerCase();
		filteredRoutes = routes.filter((route) => {
			const shortName = route.shortName?.toLowerCase();
			const longNameOrDescription = (route.longName || route.description || '').toLowerCase();
			const agencyName = route.agencyInfo?.name?.toLowerCase();

			return (
				shortName?.includes(lowerCaseQuery) ||
				longNameOrDescription.includes(lowerCaseQuery) ||
				agencyName?.includes(lowerCaseQuery)
			);
		});
	}
</script>

<div>
	{#if loading}
		<LoadingSpinner />
	{/if}

	{#if routes.length > 0}
		<div class="h-25 rounded-lg bg-[#1C1C1E] bg-opacity-80 p-4">
			<h1 class="mb-6 text-center text-2xl font-bold text-white">{$t('search.all_routes')}</h1>
		</div>

		<div class="p-4">
			<div class="relative mb-4">
				<input
					type="text"
					placeholder={$t('search.search_for_routes')}
					class="w-full rounded-lg border border-gray-300 p-2 pl-10 text-gray-700 placeholder-gray-500 dark:border-gray-700 dark:text-gray-900 dark:placeholder-gray-900"
					bind:value={query}
					on:input={handleSearch}
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

			<div class="scrollbar-hidden fixed-height relative mt-4 max-h-96 overflow-y-auto">
				{#if filteredRoutes.length > 0}
					{#each filteredRoutes as route}
						<RouteItem {route} on:routeClick={handleRouteClick} />
					{/each}
				{:else}
					<div class="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
						{$t('search.no_routes_found')}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.scrollbar-hidden {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.scrollbar-hidden::-webkit-scrollbar {
		display: none;
	}
	.fixed-height {
		height: 500px;
	}
</style>
