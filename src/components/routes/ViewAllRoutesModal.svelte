<!-- eslint-disable svelte/block-lang -->
<!--
    @component
    Lists every route in the region inside a draggable bottom sheet so the map
    stays visible behind it, at every viewport width. The condensed header (title
    + close action) lives in the drag-handle row; the search field and route list
    scroll in the sheet body.

    @prop {Function} handleModalRouteClick - Called when a route row is tapped
    @prop {Function} closePane - Called when the close button is tapped (or Escape is pressed)
    @prop {('peek'|'half'|'full')} snap - Bindable current snap point of the sheet
-->

<script>
	import BottomSheet from '$components/navigation/BottomSheet.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import RouteItem from '$components/RouteItem.svelte';
	import { X } from '@lucide/svelte';
	import { keybinding } from '$lib/keybinding';
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { filterAndSortRoutes } from '$lib/routeUtils';

	let { handleModalRouteClick, closePane, snap = $bindable('half') } = $props();

	let routes = $state([]);
	let filteredRoutes = $state([]);
	let query = $state('');
	let loading = $state(false);
	let loadError = $state(false);

	onMount(async () => {
		await fetchRoutes();
	});

	async function fetchRoutes() {
		try {
			loading = true;
			loadError = false;
			const response = await fetch('/api/oba/routes');
			const data = await response.json().catch(() => ({}));

			if (response.ok) {
				routes = data.routes ?? [];
				filterRoutes();
			} else {
				console.error('Failed to fetch routes:', data.error ?? response.statusText);
				loadError = true;
				routes = [];
				filteredRoutes = [];
			}
		} catch (error) {
			console.error('Error fetching routes:', error);
			loadError = true;
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

<BottomSheet bind:snap>
	{#snippet header()}
		<div class="flex items-center gap-2.5">
			<p class="min-w-0 flex-1 truncate text-base font-semibold text-black dark:text-white">
				{$t('search.all_routes')}
			</p>
			<button
				type="button"
				onclick={closePane}
				use:keybinding={{ code: 'Escape' }}
				class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-200 text-sm text-black hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
			>
				<X class="h-4 w-4" />
				<span class="sr-only">{$t('sheet.close')}</span>
			</button>
		</div>
	{/snippet}

	{#if loading}
		<LoadingSpinner />
	{:else if loadError}
		<div
			role="alert"
			class="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/30"
		>
			<p class="text-sm font-medium text-red-800 dark:text-red-200">
				{$t('search.routes_load_failed')}
			</p>
			<button
				type="button"
				onclick={fetchRoutes}
				class="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
			>
				{$t('search.retry')}
			</button>
		</div>
	{:else if routes.length > 0}
		<div>
			<div class="sticky top-0 z-10 bg-surface pb-2 dark:bg-surface-dark">
				<div class="relative">
					<input
						type="text"
						aria-label={$t('search.search_for_routes')}
						placeholder={$t('search.search_for_routes')}
						class="w-full rounded-lg border border-gray-300 bg-white p-2 pl-10 text-gray-700 placeholder-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
						bind:value={query}
						oninput={handleSearch}
					/>
					<svg
						class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-500 dark:text-gray-400"
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
			</div>

			<div>
				{#if filteredRoutes.length > 0}
					{#each filteredRoutes as route (route.id)}
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
</BottomSheet>
