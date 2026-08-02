<!--
	@component
	Favorites map control: opens a panel with FavoritesList. Placement is owned by
	the parent (in-flow below search on small screens; map top-right on desktop).

	@prop {Function} [onStopClick] - Called with a stop favorite when selected
	@prop {Function} [onRouteClick] - Called with a route favorite when selected
-->
<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faStar } from '@fortawesome/free-solid-svg-icons';
	import { t } from 'svelte-i18n';
	import { favorites } from '$stores/favoritesStore';
	import FavoritesList from '$components/favorites/FavoritesList.svelte';

	let { onStopClick = null, onRouteClick = null } = $props();

	let open = $state(false);
	let rootEl = $state(null);

	let count = $derived($favorites.length);
	let toggleLabel = $derived(open ? $t('favorites.close_panel') : $t('favorites.open_panel'));

	function toggle(event) {
		event.stopPropagation();
		open = !open;
	}

	function close() {
		open = false;
	}

	function handleStopClick(item) {
		close();
		onStopClick?.(item);
	}

	function handleRouteClick(item) {
		close();
		onRouteClick?.(item);
	}

	function handleWindowClick(event) {
		if (!open || !rootEl) return;
		if (!rootEl.contains(event.target)) {
			close();
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Escape' && open) {
			close();
		}
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

<div bind:this={rootEl} class="relative">
	<button
		type="button"
		onclick={toggle}
		aria-expanded={open}
		aria-controls="favorites-floating-panel"
		aria-label={toggleLabel}
		title={toggleLabel}
		class="relative flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 bg-white/95 text-black shadow-md backdrop-blur-sm hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/95 dark:text-white dark:hover:bg-gray-700"
	>
		<FontAwesomeIcon icon={faStar} />
		{#if count > 0}
			<span
				class="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold text-white"
			>
				{count > 99 ? '99+' : count}
			</span>
		{/if}
	</button>

	{#if open}
		<div
			id="favorites-floating-panel"
			role="dialog"
			aria-label={$t('favorites.title')}
			class="absolute right-0 top-full z-40 mt-2 max-h-[min(24rem,70vh)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-gray-300 bg-white/95 p-3 shadow-lg backdrop-blur-sm dark:border-gray-600 dark:bg-gray-800/95"
		>
			<FavoritesList onStopClick={handleStopClick} onRouteClick={handleRouteClick} />
		</div>
	{/if}
</div>
