<!--
	@component
	Lists favorited stops and routes. Item select and delete are sibling buttons
	(no nested interactive controls). Renders an empty state when there are none.

	@prop {Function} [onStopClick] - Called with the stop favorite entry
	@prop {Function} [onRouteClick] - Called with the route favorite entry
-->
<script>
	import { t } from 'svelte-i18n';
	import { favorites } from '$stores/favoritesStore';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faStar, faSignsPost, faTimes } from '@fortawesome/free-solid-svg-icons';
	import { prioritizedRouteTypeForDisplay } from '$config/routeConfig';
	import { removeAgencyPrefix } from '$lib/utils';

	let { onStopClick = null, onRouteClick = null } = $props();

	let items = $derived($favorites);

	function handleItemClick(item) {
		if (item.type === 'stop') {
			onStopClick?.(item);
		} else if (item.type === 'route') {
			onRouteClick?.(item);
		}
	}

	function handleRemove(item) {
		favorites.remove(item.type, item.id);
	}

	function itemTitle(item) {
		if (item.type === 'stop') return item.name;
		return `${$t('route')} ${item.shortName}`;
	}

	function itemSubtitle(item) {
		if (item.type === 'stop') {
			const parts = [];
			if (item.direction) {
				parts.push($t(`direction.${item.direction}`));
			}
			if (item.code) {
				parts.push(`${$t('favorites.stop_code')}: ${item.code}`);
			} else {
				parts.push(`${$t('favorites.stop_code')}: ${removeAgencyPrefix(item.id)}`);
			}
			return parts.join(' · ');
		}
		return item.description ?? '';
	}

	function itemIcon(item) {
		if (item.type === 'stop') return faSignsPost;
		return prioritizedRouteTypeForDisplay(item.routeType);
	}

	function itemAriaLabel(item) {
		return $t('favorites.open_item', { values: { name: itemTitle(item) } });
	}
</script>

<div class="mt-4">
	<div class="mb-2 flex items-center justify-between">
		<h2 class="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
			<FontAwesomeIcon icon={faStar} class="h-3.5 w-3.5" />
			{$t('favorites.title')}
		</h2>
		{#if items.length > 0}
			<button
				type="button"
				class="text-xs text-gray-600 transition-colors hover:text-red-500 dark:text-gray-400"
				onclick={() => favorites.clearAll()}
			>
				{$t('favorites.clear_all')}
			</button>
		{/if}
	</div>

	{#if items.length === 0}
		<p class="text-sm text-gray-500 dark:text-gray-400">{$t('favorites.empty')}</p>
	{:else}
		<div class="space-y-2">
			{#each items as item (`${item.type}:${item.id}`)}
				<div
					class="dark:hover:bg-gray-750 group relative flex items-stretch rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:bg-gray-50 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				>
					<button
						type="button"
						aria-label={itemAriaLabel(item)}
						class="flex min-w-0 flex-1 items-center rounded-lg p-2.5 pr-10 text-left"
						onclick={() => handleItemClick(item)}
					>
						<div class="mr-3 text-gray-400">
							<FontAwesomeIcon icon={itemIcon(item)} class="h-3.5 w-3.5" />
						</div>
						<div class="min-w-0 flex-1 text-left">
							<div class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
								{itemTitle(item)}
							</div>
							{#if itemSubtitle(item)}
								<div class="truncate text-xs text-gray-500 dark:text-gray-400">
									{itemSubtitle(item)}
								</div>
							{/if}
						</div>
					</button>

					<button
						type="button"
						class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-gray-600"
						onclick={() => handleRemove(item)}
						aria-label={$t('favorites.remove_item', { values: { name: itemTitle(item) } })}
					>
						<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
