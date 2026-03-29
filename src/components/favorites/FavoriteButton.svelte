<script>
	import { favorites } from '$stores/favoritesStore';

	let { id, type = 'stop', name = '', ariaLabel = '' } = $props();

	let isFavorited = $state(false);

	let unsubscribe = undefined;

	$effect(() => {
		// Re-subscribe whenever id or type changes
		if (unsubscribe) unsubscribe();
		
		unsubscribe = favorites.subscribe((favs) => {
			isFavorited = favs.some((fav) => fav.id === id && fav.type === type);
		});

		// Cleanup on destroy
		return () => {
			if (unsubscribe) unsubscribe();
		};
	});

	function handleToggle(e) {
		e.stopPropagation();
		favorites.toggleFavorite(id, type, name);
	}
</script>

<button
	type="button"
	onclick={handleToggle}
	aria-label={isFavorited ? 'Remove from favorites' : (ariaLabel || 'Add to favorites')}
	class="favorite-btn inline-flex items-center justify-center rounded p-2 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
	title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
>
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill={isFavorited ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		class={isFavorited ? 'text-yellow-500' : 'text-gray-600 dark:text-gray-400'}
	>
		<polygon points="12 2 15.09 10.26 24 10.5 18 16.16 20.16 24.5 12 20.13 3.84 24.5 6 16.16 0 10.5 8.91 10.26"></polygon>
	</svg>
</button>

<style>
	.favorite-btn {
		cursor: pointer;
	}
</style>
