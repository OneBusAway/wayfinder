<script>
	import { favorites } from '$stores/favoritesStore';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faSignsPost, faRoute, faTrash } from '@fortawesome/free-solid-svg-icons';
	import { t } from 'svelte-i18n';

	let { onStopClick = () => {}, onRouteClick = () => {} } = $props();

	let items = $derived($favorites);

	function handleItemClick(item) {
		if (item.type === 'stop') {
			onStopClick(item);
		} else {
			onRouteClick(item);
		}
	}

	function handleRemove(e, id) {
		e.stopPropagation();
		favorites.removeFavorite(id);
	}

	function handleItemKeydown(e, item) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleItemClick(item);
		}
	}
</script>

{#if items.length === 0}
	<p class="px-2 py-4 text-sm text-gray-500 dark:text-gray-400">
		{$t('favorites.empty')}
	</p>
{:else}
	<div class="max-h-96 overflow-y-auto">
		{#each items as item (item.id)}
			<div
				role="button"
				tabindex="0"
				onclick={() => handleItemClick(item)}
				onkeydown={(e) => handleItemKeydown(e, item)}
				class="flex w-full items-center gap-x-4 rounded-md px-2 py-1 text-left hover:bg-gray-200 dark:hover:bg-gray-700"
			>
				<div
					class="flex h-12 w-12 min-w-12 max-w-12 items-center justify-center rounded-full bg-gray-200"
				>
					<FontAwesomeIcon
						icon={item.type === 'stop' ? faSignsPost : faRoute}
						class="text-2xl text-gray-800"
					/>
				</div>

				<div class="flex-1">
					<h3 class="text-lg font-semibold text-gray-700 dark:text-white">{item.name}</h3>
					{#if item.direction}
						<p class="text-gray-700 dark:text-white">
							{$t(`direction.${item.direction}`)}
						</p>
					{/if}
				</div>

				<button
					type="button"
					onclick={(e) => handleRemove(e, item.id)}
					aria-label={$t('favorites.remove')}
					class="rounded-md p-2 text-gray-400 transition-colors hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-brand-accent"
				>
					<FontAwesomeIcon icon={faTrash} class="text-sm" />
				</button>
			</div>
		{/each}
	</div>

	<button
		type="button"
		onclick={() => favorites.clearAll()}
		class="mt-2 text-sm text-gray-500 underline hover:text-red-500"
	>
		{$t('favorites.clear_all')}
	</button>
{/if}
