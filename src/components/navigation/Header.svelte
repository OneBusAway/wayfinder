<script>
	import {
		PUBLIC_OBA_REGION_NAME,
		PUBLIC_OBA_LOGO_URL,
		PUBLIC_NAV_BAR_LINKS
	} from '$env/static/public';

	import { onMount } from 'svelte';
	import ThemeSwitcher from '$lib/ThemeSwitch/ThemeSwitcher.svelte';
	import MobileMenu from './MobileMenu.svelte';

	let isMobileMenuOpen = $state(false);
	let shouldShowMobile = $state(false);
	let navContainer;
	let linksContainer = $state(null);
	let cachedLinksWidth = 0;

	const THEME_SWITCHER_WIDTH = 56; // Width of the theme switcher component in pixels
	const EXTRA_PADDING = 32; // Extra padding to account for padding and margins in pixels
	const LINKS_GAP = '1rem'; // Matches gap-x-4 in the template
	const LINK_PADDING = '0.25rem 0.5rem'; // Matches px-2 py-1 in the template

	let headerLinks = $state(null);

	if (PUBLIC_NAV_BAR_LINKS) {
		headerLinks = JSON.parse(PUBLIC_NAV_BAR_LINKS);
	}

	function toggleNavbar() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}

	function checkOverflow() {
		if (!navContainer) return;

		const navWidth = navContainer.clientWidth;
		const logoWidth = navContainer.querySelector('.logo-container')?.clientWidth || 0;
		const availableWidth = navWidth - logoWidth - THEME_SWITCHER_WIDTH - EXTRA_PADDING;

		let linksWidth = 0;
		if (linksContainer) {
			linksWidth = linksContainer.scrollWidth;
			cachedLinksWidth = linksWidth;
		} else {
			linksWidth = cachedLinksWidth;
		}

		const newShouldShowMobileMenu = linksWidth > availableWidth;

		if (shouldShowMobile !== newShouldShowMobileMenu) {
			shouldShowMobile = newShouldShowMobileMenu;
		}
	}

	function measureLinksWidth() {
		if (!headerLinks && linksContainer) {
			return;
		}

		const tempDiv = document.createElement('div');
		tempDiv.style.position = 'absolute';
		tempDiv.style.visibility = 'hidden';
		tempDiv.style.display = 'flex';
		tempDiv.style.gap = LINKS_GAP;

		if (Object.keys(headerLinks).length > 0) {
			Object.keys(headerLinks).forEach((key) => {
				const linkDiv = document.createElement('div');
				linkDiv.style.padding = LINK_PADDING;
				linkDiv.style.flexShrink = '0';
				linkDiv.textContent = key;
				tempDiv.appendChild(linkDiv);
			});
		} else {
			const linkDiv = document.createElement('div');
			linkDiv.style.width = '600px';
			tempDiv.appendChild(linkDiv);
		}

		document.body.appendChild(tempDiv);
		cachedLinksWidth = tempDiv.scrollWidth;
		document.body.removeChild(tempDiv);
	}

	onMount(() => {
		measureLinksWidth();
		checkOverflow();

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
	class="bg-blur-md flex items-center justify-between border-b border-gray-500 bg-white/80 px-4 dark:bg-black dark:text-white md:flex-row md:px-8"
	bind:this={navContainer}
>
	<div class="flex flex-1 items-center justify-between md:flex-none">
		<div class="logo-container flex w-full items-center gap-4 px-2 py-2 md:w-auto">
			<div class="flex items-center justify-center gap-x-2">
				<a href="/" class="block">
					<img src={PUBLIC_OBA_LOGO_URL} alt={PUBLIC_OBA_REGION_NAME} class="h-10 rounded-sm" />
				</a>
				<a href="/" class="block text-xl font-extrabold">
					{PUBLIC_OBA_REGION_NAME}
				</a>
			</div>
		</div>

		{#if !shouldShowMobile}
			<div class="flex items-center px-2 py-2" bind:this={linksContainer}>
				<div class="no-scrollbar flex gap-x-4 overflow-x-auto">
					{#if headerLinks && Object.keys(headerLinks).length > 0}
						{#each Object.entries(headerLinks) as [key, value]}
							<div class="flex-shrink-0 rounded-md border bg-white/80 dark:bg-gray-800">
								<a href={value} class="block px-2 py-1 font-semibold text-gray-900 dark:text-white"
									>{key}</a
								>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<div class="flex items-center">
		{#if shouldShowMobile}
			<button onclick={toggleNavbar} aria-label="Toggle navigation menu" class="mr-2">
				<svg
					class="burger-icon h-6 w-6 text-gray-900 dark:text-white"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16m-7 6h7"
					></path>
				</svg>
			</button>
		{:else}
			<div class={shouldShowMobile ? '' : 'flex'}>
				<ThemeSwitcher />
			</div>
		{/if}
	</div>
</div>

{#if isMobileMenuOpen}
	<MobileMenu {headerLinks} closeMenu={toggleNavbar} />
{/if}

<style lang="postcss">
	.burger-icon {
		cursor: pointer;
	}
</style>
