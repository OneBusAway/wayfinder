<!--
	@component
	Favorites map control: opens a panel with FavoritesList. Placement is owned by
	the parent (in-flow below search on small screens; map top-right on desktop).

	@prop {Function} [onStopClick] - Called with a stop favorite when selected
	@prop {Function} [onRouteClick] - Called with a route favorite when selected
-->
<script>
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Popover } from 'flowbite-svelte';
	import { Star } from '@lucide/svelte';
	import { t } from 'svelte-i18n';
	import { favorites } from '$stores/favoritesStore';
	import FavoritesList from '$components/favorites/FavoritesList.svelte';

	let { onStopClick = null, onRouteClick = null } = $props();

	let isOpen = $state(false);
	let toggleBtn = $state(null);

	const uid = $props.id();
	const panelId = `favorites-floating-panel-${uid}`;
	const toggleId = `favorites-floating-toggle-${uid}`;

	let count = $derived($favorites.length);
	let toggleLabel = $derived(isOpen ? $t('favorites.close_panel') : $t('favorites.open_panel'));

	async function close({ restoreFocus = true } = {}) {
		if (!isOpen) return;
		isOpen = false;
		if (restoreFocus) {
			await tick();
			toggleBtn?.focus();
		}
	}

	// Popover reports every open/close here, including the echo of a close() above;
	// only react to the ones it initiated itself (a toggle or outside click).
	async function handleShow(event) {
		if (event.detail === isOpen) return;
		isOpen = event.detail;

		if (isOpen) {
			await tick();
			document.getElementById(panelId)?.focus();
			return;
		}

		const active = document.activeElement;
		if (!active || active === document.body || document.getElementById(panelId)?.contains(active)) {
			await tick();
			toggleBtn?.focus();
		}
	}

	function handleStopClick(item) {
		close({ restoreFocus: false });
		onStopClick?.(item);
	}

	function handleRouteClick(item) {
		close({ restoreFocus: false });
		onRouteClick?.(item);
	}

	function handleKeydown(event) {
		if (event.key === 'Escape' && isOpen) {
			event.preventDefault();
			close();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="pointer-events-auto relative">
	<button
		bind:this={toggleBtn}
		id={toggleId}
		type="button"
		aria-controls={isOpen ? panelId : undefined}
		aria-expanded={isOpen ? true : undefined}
		aria-haspopup="dialog"
		aria-label={toggleLabel}
		title={toggleLabel}
		class="relative flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 bg-white/95 text-black shadow-md backdrop-blur-sm hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/95 dark:text-white dark:hover:bg-gray-700"
	>
		<Star class="h-4 w-4" fill="currentColor" />
		{#if count > 0}
			<span
				class="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold text-white"
			>
				{count > 99 ? '99+' : count}
			</span>
		{/if}
	</button>

	<Popover
		aria-label={$t('favorites.title')}
		arrow={false}
		class="left-0 max-h-[min(24rem,70vh)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-gray-300 bg-white/95 shadow-lg outline-none backdrop-blur-sm dark:border-gray-600 dark:bg-gray-800/95"
		defaultClass="p-3"
		id={panelId}
		offset={6}
		open={isOpen}
		on:show={handleShow}
		params={{ duration: 100 }}
		placement="bottom-end"
		role="dialog"
		transition={fade}
		trigger="click"
		triggeredBy="#{toggleId}"
	>
		<FavoritesList onStopClick={handleStopClick} onRouteClick={handleRouteClick} />
	</Popover>
</div>
