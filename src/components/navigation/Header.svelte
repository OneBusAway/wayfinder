<script lang="ts">
	import {
		PUBLIC_OBA_REGION_NAME,
		PUBLIC_OBA_LOGO_URL,
		PUBLIC_NAV_BAR_LINKS
	} from '$env/static/public';

	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import OverflowMenu from './OverflowMenu.svelte';
	import LanguageSwitcher from './LanguageSwitcher/LanguageSwitcher.svelte';

	const showRegionName = __SHOW_REGION_NAME_IN_NAV_BAR__;

	let isDarkMode = $state(false);

	$effect(() => {
		isDarkMode = document.documentElement.classList.contains('dark');

		const handleThemeChange = (e: CustomEvent<{ darkMode: boolean }>) => {
			isDarkMode = e.detail.darkMode;
		};
		window.addEventListener('themeChange', handleThemeChange);

		return () => window.removeEventListener('themeChange', handleThemeChange);
	});

	let logoUrl = $derived(
		isDarkMode && __OBA_LOGO_URL_DARK__ ? __OBA_LOGO_URL_DARK__ : PUBLIC_OBA_LOGO_URL
	);

	interface MeasuredLink {
		key: string;
		value: string;
		width: number;
	}

	let languageSwitcherEl: HTMLDivElement | undefined;
	let logoEl = $state<HTMLImageElement>();
	let navContainerEl: HTMLElement | undefined;

	const EXTRA_PADDING = 32;
	const GAP_WIDTH = 16; // 1rem = 16px (gap-x-4)
	const OVERFLOW_BUTTON_WIDTH = 40;
	const DEFAULT_LOGO_HEIGHT = 40; // h-10
	const MIN_LOGO_HEIGHT = 24; // h-6

	let headerLinks = $state<Record<string, string> | null>(null);
	let linkWidths = $state<MeasuredLink[]>([]);
	let visibleLinks = $state<MeasuredLink[]>([]);
	let overflowLinks = $state<MeasuredLink[]>([]);
	let logoHeight = $state(DEFAULT_LOGO_HEIGHT);
	let baseLogoWidth = 0; // Logo width at default height
	let languageSwitcherWidth = $state(0);

	if (PUBLIC_NAV_BAR_LINKS) {
		headerLinks = JSON.parse(PUBLIC_NAV_BAR_LINKS);
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
		if (!navContainerEl || linkWidths.length === 0) return;

		const navWidth = navContainerEl.clientWidth;
		const logoContainer = navContainerEl.querySelector('.logo-container');
		const logoContainerPadding = 16; // px-2 py-2 = 8px each side horizontal

		// Calculate logo container width (logo + region name if shown + gaps + padding)
		const regionNameEl = logoContainer?.querySelector<HTMLElement>('.region-name');
		const regionNameWidth = regionNameEl?.offsetWidth || 0;
		const logoContainerGap = showRegionName && regionNameWidth > 0 ? 8 : 0; // gap-x-2

		// Calculate available width with current logo height
		const currentLogoWidth =
			logoHeight === DEFAULT_LOGO_HEIGHT
				? baseLogoWidth
				: (baseLogoWidth * logoHeight) / DEFAULT_LOGO_HEIGHT;
		const logoContainerWidth =
			currentLogoWidth + regionNameWidth + logoContainerGap + logoContainerPadding;
		// Account for language switcher width
		const languageSwitcherGap = languageSwitcherWidth > 0 ? GAP_WIDTH : 0;
		let availableWidth =
			navWidth - logoContainerWidth - EXTRA_PADDING - languageSwitcherWidth - languageSwitcherGap;

		const newVisibleLinks: MeasuredLink[] = [];
		const newOverflowLinks: MeasuredLink[] = [];
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
		if (logoEl) {
			if (logoEl.complete) {
				baseLogoWidth = logoEl.offsetWidth;
			} else {
				logoEl.onload = () => {
					baseLogoWidth = logoEl?.offsetWidth ?? 0;
					checkOverflow();
				};
			}
		}

		// Measure language switcher width
		if (languageSwitcherEl) {
			languageSwitcherWidth = languageSwitcherEl.offsetWidth || 0;
		}

		// Initial overflow check (after all measurements)
		checkOverflow();

		const headerResizeObserver = new ResizeObserver(() => {
			// Re-measure language switcher on resize
			if (languageSwitcherEl) {
				languageSwitcherWidth = languageSwitcherEl.offsetWidth || 0;
			}
			checkOverflow();
		});

		if (navContainerEl) {
			headerResizeObserver.observe(navContainerEl);
		}

		// Also observe language switcher element directly to catch width changes
		// (e.g., when locale changes and button text changes)
		const languageSwitcherResizeObserver = new ResizeObserver(() => {
			if (languageSwitcherEl) {
				languageSwitcherWidth = languageSwitcherEl.offsetWidth || 0;
				checkOverflow();
			}
		});

		if (languageSwitcherEl) {
			languageSwitcherResizeObserver.observe(languageSwitcherEl);
		}

		return () => {
			headerResizeObserver.disconnect();
			languageSwitcherResizeObserver.disconnect();
		};
	});

	function handleHomeClick(e: MouseEvent) {
		if (!browser) return;
		if (
			e &&
			(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
		) {
			return;
		}
		window.dispatchEvent(new CustomEvent('openStopsTab'));
	}
</script>

<header
	class="relative z-9999 flex items-center justify-between border-b border-gray-500 bg-brand-accent/80 text-brand-foreground backdrop-blur-md md:flex-row md:px-8 dark:bg-surface-dark dark:text-surface-foreground-dark"
	bind:this={navContainerEl}
>
	{#if logoUrl || PUBLIC_OBA_REGION_NAME}
		<div class="logo-container flex items-center gap-2 px-1 py-1 md:gap-4 md:px-2 md:py-2">
			<!-- FIXME: navigation path not built with resolve() -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="/" onclick={handleHomeClick} class="flex items-center justify-center gap-x-2">
				{#if logoUrl}
					<img
						bind:this={logoEl}
						alt=""
						class="rounded-xs"
						src={logoUrl}
						style="height: {logoHeight}px"
					/>
				{/if}
				{#if PUBLIC_OBA_REGION_NAME}
					<span
						class={showRegionName
							? 'region-name block text-xl font-extrabold text-brand-foreground'
							: 'sr-only'}
					>
						{PUBLIC_OBA_REGION_NAME}
					</span>
				{/if}
			</a>
		</div>
	{/if}

	<div class="flex-1"></div>

	<nav
		aria-label="Main navigation"
		class="flex items-center gap-x-2 px-1 py-1 md:gap-x-4 md:px-2 md:py-2"
	>
		{#each visibleLinks as { key, value } (key)}
			<div class="flex-shrink-0 rounded-md border bg-surface/80 dark:bg-surface-dark">
				<!-- external URL -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={value}
					class="block px-2 py-1 font-semibold text-surface-foreground dark:text-surface-foreground-dark"
					>{key}</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		{/each}

		{#if overflowLinks.length > 0}
			<OverflowMenu links={overflowLinks} />
		{/if}

		<div class="language-switcher-container flex-shrink-0" bind:this={languageSwitcherEl}>
			<LanguageSwitcher />
		</div>
	</nav>
</header>
