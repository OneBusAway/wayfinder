<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';
	import { faStar as faStarOutline } from '@fortawesome/free-regular-svg-icons';
	import { favorites } from '$stores/favoritesStore';
	import { t } from 'svelte-i18n';

	let { type, entityId, name, direction = null, coords = null } = $props();

	let isFav = $derived($favorites.some((f) => f.type === type && f.entityId === entityId));

	function toggle() {
		if (isFav) {
			const entry = $favorites.find((f) => f.type === type && f.entityId === entityId);
			if (entry) {
				favorites.removeFavorite(entry.id);
			}
		} else {
			favorites.addFavorite({ type, entityId, name, direction, coords });
		}
	}
</script>

<button
	type="button"
	onclick={toggle}
	aria-label={isFav ? $t('favorites.remove') : $t('favorites.add')}
	class="inline-flex items-center justify-center rounded-md p-1 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-accent dark:hover:bg-gray-700"
>
	{#if isFav}
		<FontAwesomeIcon icon={faStarSolid} class="text-xl text-yellow-400" />
	{:else}
		<FontAwesomeIcon icon={faStarOutline} class="text-xl text-gray-400" />
	{/if}
</button>
