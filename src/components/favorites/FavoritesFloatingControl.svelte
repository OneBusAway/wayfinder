<!--
	@component
	Favorites map control: opens a panel with FavoritesList. Placement is owned by
	the parent (in-flow below search on small screens; map top-right on desktop).
-->
<script lang="ts">
	import * as Popover from '$components/ui/popover/index';
	import type { RouteFavorite, StopFavorite } from '$lib/types';
	import FavoritesList from '$components/favorites/FavoritesList.svelte';
	import { Star } from '@lucide/svelte';
	import { favorites } from '$stores/favoritesStore';
	import { t } from 'svelte-i18n';

	interface Props {
		/**
		 * Called with a route favorite when selected
		 */
		onRouteClick?: (routeFavorite: RouteFavorite) => void;
		/**
		 * Called with a stop favorite when selected
		 */
		onStopClick?: (stopFavorite: StopFavorite) => void;
	}

	let { onStopClick, onRouteClick }: Props = $props();

	let contentRef = $state<HTMLElement | null>(null);
	let count = $derived($favorites.length);
	let isOpen = $state(false);
	let toggleLabel = $derived(isOpen ? $t('favorites.close_panel') : $t('favorites.open_panel'));

	function handleStopClick(item: StopFavorite) {
		isOpen = false;
		onStopClick?.(item);
	}

	function handleRouteClick(item: RouteFavorite) {
		isOpen = false;
		onRouteClick?.(item);
	}
</script>

<div class="pointer-events-auto relative">
	<Popover.Root bind:open={isOpen}>
		<Popover.Trigger
			aria-label={toggleLabel}
			class="relative flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 bg-white/95 text-black shadow-md hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/95 dark:text-white dark:hover:bg-gray-700"
			title={toggleLabel}
		>
			<Star class="h-4 w-4" fill="currentColor" />
			{#if count > 0}
				<span
					class="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold text-white"
				>
					{count > 99 ? '99+' : count}
				</span>
			{/if}
		</Popover.Trigger>
		<Popover.Content
			bind:ref={contentRef}
			align="end"
			aria-label={$t('favorites.title')}
			class="left-0 max-h-[min(24rem,70vh)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto border border-gray-300 shadow-lg outline-hidden dark:border-gray-600"
			trapFocus={false}
			onCloseAutoFocus={(event) => {
				const active = document.activeElement;
				if (active && active !== document.body && !contentRef?.contains(active)) {
					event.preventDefault();
				}
    		}}
		>
			<FavoritesList onStopClick={handleStopClick} onRouteClick={handleRouteClick} />
		</Popover.Content>
	</Popover.Root>
</div>
