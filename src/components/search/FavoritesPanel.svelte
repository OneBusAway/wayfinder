<script>
	import { favorites as favoritesStore } from '$stores/favoritesStore';
	import { t } from 'svelte-i18n';
	import { faSignsPost, faBus, faXmark } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { onDestroy } from 'svelte';

	let {
		handleStopMarkerSelect,
		handleRouteSelected,
		mapProvider = null
	} = $props();

	let favorites = $state([]);

	let unsubscribe = favoritesStore.subscribe((value) => {
		favorites = value;
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	async function handleFavoriteClick(favorite) {
		const { id, type } = favorite;

		try {
			if (type === 'stop') {
				const response = await fetch(`/api/oba/stop/${id}`);
				const data = await response.json();

				// OBA API returns the stop in data.data.entry
				const stop = data?.data?.entry;

				if (stop?.lat && stop?.lon) {
					const markerOptions = {
						stop: stop,
						position: { lat: stop.lat, lng: stop.lon },
						onClick: () => handleStopMarkerSelect(stop)
					};
					mapProvider.addMarker(markerOptions);
					mapProvider.flyTo(stop.lat, stop.lon, 20);

					// ADDED THE TIMEOUT HERE to match SearchPane.svelte
					setTimeout(() => {
						handleStopMarkerSelect(stop);
					}, 100);
				} else {
					console.error('Invalid stop data received - missing lat/lon:', stop);
				}
			} else if (type === 'route') {
				handleRouteSelected({ id });
			}
		} catch (error) {
			console.error('Failed to load favorite details:', error);
		}
	}

	function handleRemoveFavorite(favorite) {
		favoritesStore.removeFavorite(favorite.id, favorite.type);
	}

	function getIconForType(type) {
		return type === 'route' ? faBus : faSignsPost;
	}

	function getFavoriteName(favorite) {
		return favorite.name || `${favorite.type === 'route' ? $t('route') : $t('stop')} ${favorite.id}`;
	}
</script>

<div class="flex flex-col h-full">
	{#if favorites.length === 0}
		<div class="flex flex-col items-center justify-center h-full p-6 text-center">
			<div class="text-4xl mb-4">⭐</div>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				{$t('favorites.empty_state', { default: 'No favorites yet. Click the ⭐ on any stop to save it here!' })}
			</p>
		</div>
	{:else}
		<div class="max-h-full overflow-y-auto">
			<div class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each favorites as favorite (favorite.id + favorite.type)}
					<div
						class="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between gap-3"
					>
						<button
							type="button"
							class="flex-1 flex items-center gap-3 text-left hover:opacity-75"
							onclick={() => handleFavoriteClick(favorite)}
						>
							<div class="flex-shrink-0 text-brand-accent">
								<FontAwesomeIcon icon={getIconForType(favorite.type)} class="text-lg" />
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white truncate">
									{getFavoriteName(favorite)}
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400 capitalize">
									{favorite.type}
								</p>
							</div>
						</button>

						<button
							type="button"
							aria-label={$t('favorites.remove', { default: 'Remove from favorites' })}
							class="flex-shrink-0 text-yellow-400 hover:text-yellow-500 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
							onclick={() => handleRemoveFavorite(favorite)}
						>
							<FontAwesomeIcon icon={faXmark} class="text-base" />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
