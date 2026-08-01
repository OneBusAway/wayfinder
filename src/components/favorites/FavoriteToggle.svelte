<!--
	@component
	Star button that toggles a stop or route in the favorites store.
	Membership is derived from `favoriteKeys` — no local isFavorite state.

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
	@prop {string} [class] - Extra classes on the button
-->
<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';
	import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
	import { t } from 'svelte-i18n';
	import { favorites, favoriteKeys } from '$stores/favoritesStore';

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

	let key = $derived(`${type}:${id}`);
	let isFav = $derived($favoriteKeys.has(key));

	let label = $derived(isFav ? $t('favorites.remove') : $t('favorites.add'));

	function handleClick() {
		favorites.toggle({
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
	}
</script>

<button
	type="button"
	onclick={handleClick}
	aria-pressed={isFav}
	aria-label={label}
	title={label}
	class="flex h-10 w-12 flex-none items-center justify-center rounded-xl border border-gray-300 text-black hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700 {isFav
		? 'text-brand-accent dark:text-brand-accent'
		: ''} {className}"
>
	<FontAwesomeIcon icon={isFav ? faStarSolid : faStarRegular} />
</button>
