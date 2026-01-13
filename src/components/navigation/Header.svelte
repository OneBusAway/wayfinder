<script>
	import {
		PUBLIC_OBA_REGION_NAME,
		PUBLIC_OBA_LOGO_URL,
		PUBLIC_NAV_BAR_LINKS
	} from '$env/static/public';

	import { onMount } from 'svelte';
	import OverflowMenu from './OverflowMenu.svelte';

	const showRegionName = __SHOW_REGION_NAME_IN_NAV_BAR__;

	let isDarkMode = $state(false);

	$effect(() => {
		isDarkMode = document.documentElement.classList.contains('dark');

		const handleThemeChange = (e) => {
			isDarkMode = e.detail.darkMode;
		};
		window.addEventListener('themeChange', handleThemeChange);

		return () => window.removeEventListener('themeChange', handleThemeChange);
	});

	let logoUrl = $derived(
		isDarkMode && __OBA_LOGO_URL_DARK__ ? __OBA_LOGO_URL_DARK__ : PUBLIC_OBA_LOGO_URL
	);

	let isOverflowMenuOpen = $state(false);
	let navContainer;
	let logoElement;

	const EXTRA_PADDING = 32;
	const GAP_WIDTH = 16; // 1rem = 16px (gap-x-4)
	const OVERFLOW_BUTTON_WIDTH = 40;
	const DEFAULT_LOGO_HEIGHT = 40; // h-10
	const MIN_LOGO_HEIGHT = 24; // h-6

	let headerLinks = $state(null);
	let linkWidths = $state([]);
	let visibleLinks = $state([]);
	let overflowLinks = $state([]);
	let logoHeight = $state(DEFAULT_LOGO_HEIGHT);
	let baseLogoWidth = 0; // Logo width at default height

	if (PUBLIC_NAV_BAR_LINKS) {
		headerLinks = JSON.parse(PUBLIC_NAV_BAR_LINKS);
	}

	function toggleOverflowMenu() {
		isOverflowMenuOpen = !isOverflowMenuOpen;
	}

	function closeOverflowMenu() {
		isOverflowMenuOpen = false;
	}

	function measureLinkWidths() {
		if (!headerLinks) return;

		linkWidths = [];
		Object.entries(headerLinks).forEach(([key, value]) => {
			const tempDiv = document.createElement('div');
			tempDiv.style.cssText =
				'position:absolute;visibility:hidden;padding:0.25rem 0.5rem;font-weight:600;';
			tempDiv.textContent = key;
			document.body.appendChild(tempDiv);
			// Add border width (1px each side) to the measurement
			linkWidths.push({ key, value, width: tempDiv.offsetWidth + 2 });
			document.body.removeChild(tempDiv);
		});
	}

	function checkOverflow() {
		if (!navContainer || linkWidths.length === 0) return;

		const navWidth = navContainer.clientWidth;
		const logoContainer = navContainer.querySelector('.logo-container');
		const logoContainerPadding = 16; // px-2 py-2 = 8px each side horizontal

		// Calculate logo container width (logo + region name if shown + gaps + padding)
		const regionNameEl = logoContainer?.querySelector('.region-name');
		const regionNameWidth = regionNameEl?.offsetWidth || 0;
		const logoContainerGap = showRegionName && regionNameWidth > 0 ? 8 : 0; // gap-x-2

		// Calculate available width with current logo height
		const currentLogoWidth =
			logoHeight === DEFAULT_LOGO_HEIGHT
				? baseLogoWidth
				: (baseLogoWidth * logoHeight) / DEFAULT_LOGO_HEIGHT;
		const logoContainerWidth =
			currentLogoWidth + regionNameWidth + logoContainerGap + logoContainerPadding;
		let availableWidth = navWidth - logoContainerWidth - EXTRA_PADDING;

		const newVisibleLinks = [];
		const newOverflowLinks = [];
		let usedWidth = 0;

		// First link must always be visible - shrink logo if needed
		if (linkWidths.length > 0) {
			const firstLink = linkWidths[0];
			const hasMoreLinks = linkWidths.length > 1;
			const firstLinkSpace =
				firstLink.width + (hasMoreLinks ? OVERFLOW_BUTTON_WIDTH + GAP_WIDTH : 0);

			if (firstLinkSpace > availableWidth && baseLogoWidth > 0) {
				// Need to shrink logo to fit first link
				const spaceNeeded = firstLinkSpace - availableWidth;
				const logoShrinkNeeded = spaceNeeded;
				const newLogoWidth = Math.max(
					currentLogoWidth - logoShrinkNeeded,
					(baseLogoWidth * MIN_LOGO_HEIGHT) / DEFAULT_LOGO_HEIGHT
				);
				const newHeight = Math.max(
					(newLogoWidth / baseLogoWidth) * DEFAULT_LOGO_HEIGHT,
					MIN_LOGO_HEIGHT
				);

				if (newHeight !== logoHeight) {
					logoHeight = newHeight;
					// Recalculate available width with new logo size
					const shrunkLogoWidth = (baseLogoWidth * logoHeight) / DEFAULT_LOGO_HEIGHT;
					const newLogoContainerWidth =
						shrunkLogoWidth + regionNameWidth + logoContainerGap + logoContainerPadding;
					availableWidth = navWidth - newLogoContainerWidth - EXTRA_PADDING;
				}
			} else if (availableWidth > firstLinkSpace + 50 && logoHeight < DEFAULT_LOGO_HEIGHT) {
				// Room to grow logo back
				logoHeight = DEFAULT_LOGO_HEIGHT;
				const newLogoContainerWidth =
					baseLogoWidth + regionNameWidth + logoContainerGap + logoContainerPadding;
				availableWidth = navWidth - newLogoContainerWidth - EXTRA_PADDING;
			}
		}

		for (let i = 0; i < linkWidths.length; i++) {
			const link = linkWidths[i];
			const remainingLinks = linkWidths.length - i;
			const gapNeeded = newVisibleLinks.length > 0 ? GAP_WIDTH : 0;
			const widthNeeded = link.width + gapNeeded;

			// Reserve space for overflow button if we might need it
			const mightNeedOverflow = remainingLinks > 1;
			const reserveForButton = mightNeedOverflow ? OVERFLOW_BUTTON_WIDTH + GAP_WIDTH : 0;

			// First link always visible
			if (i === 0 || usedWidth + widthNeeded + reserveForButton <= availableWidth) {
				newVisibleLinks.push(link);
				usedWidth += widthNeeded;
			} else {
				// This link and all remaining go to overflow
				newOverflowLinks.push(...linkWidths.slice(i));
				break;
			}
		}

		visibleLinks = newVisibleLinks;
		overflowLinks = newOverflowLinks;
	}

	onMount(() => {
		measureLinkWidths();

		// Measure base logo width after image loads
		if (logoElement) {
			if (logoElement.complete) {
				baseLogoWidth = logoElement.offsetWidth;
				checkOverflow();
			} else {
				logoElement.onload = () => {
					baseLogoWidth = logoElement.offsetWidth;
					checkOverflow();
				};
			}
		} else {
			checkOverflow();
		}

		const headerResizeObserver = new ResizeObserver(() => {
			checkOverflow();
		});

		headerResizeObserver.observe(navContainer);

		return () => {
			headerResizeObserver.disconnect();
		};
	});
</script>

<div
	class="relative z-[9999] flex items-center justify-between border-b border-gray-500 bg-brand/80 text-brand-foreground backdrop-blur-md dark:bg-surface-dark dark:text-surface-foreground-dark md:flex-row md:px-8"
	bind:this={navContainer}
>
	<div class="logo-container flex items-center gap-2 px-1 py-1 md:gap-4 md:px-2 md:py-2">
		<div class="flex items-center justify-center gap-x-2">
			<a href="/" class="block">
				<img
					bind:this={logoElement}
					src={logoUrl}
					alt={PUBLIC_OBA_REGION_NAME}
					class="rounded-sm"
					style="height: {logoHeight}px"
				/>
			</a>
			{#if showRegionName}
				<a href="/" class="region-name block text-xl font-extrabold text-brand-foreground">
					{PUBLIC_OBA_REGION_NAME}
				</a>
			{/if}
		</div>
	</div>

	<div class="flex-1"></div>

	<div class="flex items-center gap-x-2 px-1 py-1 md:gap-x-4 md:px-2 md:py-2">
		{#each visibleLinks as { key, value }}
			<div class="flex-shrink-0 rounded-md border bg-surface/80 dark:bg-surface-dark">
				<a
					href={value}
					class="block px-2 py-1 font-semibold text-surface-foreground dark:text-surface-foreground-dark"
					>{key}</a
				>
			</div>
		{/each}

		{#if overflowLinks.length > 0}
			<div class="relative">
				<button
					onclick={toggleOverflowMenu}
					aria-label="More navigation options"
					class="flex h-8 w-8 items-center justify-center rounded-md border bg-surface/80 dark:bg-surface-dark"
				>
					<svg
						class="h-5 w-5 text-surface-foreground dark:text-surface-foreground-dark"
						fill="currentColor"
						viewBox="0 0 20 20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z"
						></path>
					</svg>
				</button>

				{#if isOverflowMenuOpen}
					<OverflowMenu links={overflowLinks} onClose={closeOverflowMenu} />
				{/if}
			</div>
		{/if}
	</div>
</div>
