<!--
	@component
	Star button that toggles a stop or route in the favorites store.
	Membership is derived from `$favorites` — no local isFavorite state.

	@prop {'stop'|'route'} type
	@prop {string} id - Full agency-prefixed OBA id
	@prop {string} [name] - Stop name (required for type=stop)
	@prop {string|null} [code]
	@prop {string|null} [direction]
	@prop {number} [lat] - Required for type=stop
	@prop {number} [lon] - Required for type=stop
	@prop {string} [shortName] - Required for type=route
	@prop {string|null} [description]
	@prop {number|null} [routeType]
	@prop {string} [class] - Extra classes on the button (include h-/w- to override default size)
-->
<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';
	import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
	import { t } from 'svelte-i18n';
	import { favorites } from '$stores/favoritesStore';
	import { notifyFavoriteSaved, notifyFavoriteRemoved } from '$lib/favoriteNotifications';

	let {
		type,
		id,
		name = null,
		code = null,
		direction = null,
		lat = null,
		lon = null,
		shortName = null,
		description = null,
		routeType = null,
		class: className = ''
	} = $props();

	// Read membership from the writable array (not a Set derived store) so the
	// auto-subscription always invalidates when favorites.toggle() writes.
	let isFav = $derived($favorites.some((f) => f.type === type && f.id === id));

	let label = $derived(isFav ? $t('favorites.remove') : $t('favorites.add'));
	let icon = $derived(isFav ? faStarSolid : faStarRegular);
	// Omit default size when the caller passes size classes — Tailwind cannot
	// override conflicting utilities by HTML class order.
	let sizeClass = $derived(className ? '' : 'h-10 w-12');

	function handleClick() {
		const result = favorites.toggle({
			type,
			id,
			name,
			code,
			direction,
			lat,
			lon,
			shortName,
			description,
			routeType
		});

		if (result === 'added') {
			notifyFavoriteSaved();
		} else if (result === 'removed') {
			notifyFavoriteRemoved();
		}
	}
</script>

<button
	type="button"
	onclick={handleClick}
	aria-pressed={isFav}
	aria-label={label}
	title={label}
	class="flex {sizeClass} flex-none items-center justify-center rounded-xl border border-gray-300 text-black hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700 {className}"
>
	<!-- {#key} remounts FontAwesome when the glyph swaps; the SVG component
	     does not always update in place when only the icon prop changes. -->
	{#key isFav}
		<FontAwesomeIcon {icon} class={isFav ? 'text-black dark:text-white' : ''} />
	{/key}
</button>
