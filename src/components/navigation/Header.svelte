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
	let linksContainer;
	let linksWidthCache = 0;

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
		const themeWidth = 48;
		const availableWidth = navWidth - logoWidth - themeWidth - 32;

		let linksWidth = 0;
		if (linksContainer) {
			linksWidth = linksContainer.scrollWidth;
			linksWidthCache = linksWidth;
		} else {
			linksWidth = linksWidthCache;
		}

		const newShouldShowMobileMenu = linksWidth > availableWidth;

		if (shouldShowMobile !== newShouldShowMobileMenu) {
			shouldShowMobile = newShouldShowMobileMenu;
		}
	}

	function measureLinksWidth() {
		if (headerLinks && !linksContainer) {
			const tempDiv = document.createElement('div');
			tempDiv.style.position = 'absolute';
			tempDiv.style.visibility = 'hidden';
			tempDiv.style.display = 'flex';
			tempDiv.style.gap = '1rem';

			if (Object.keys(headerLinks).length > 0) {
				Object.keys(headerLinks).forEach((key) => {
					const linkDiv = document.createElement('div');
					linkDiv.style.padding = '0.25rem 0.5rem';
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
			linksWidthCache = tempDiv.scrollWidth;
			document.body.removeChild(tempDiv);
		}
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
	class="bg-blur-md bg-white/80 dark:bg-black dark:text-white md:flex-row md:px-8 flex items-center justify-between px-4 border-b border-gray-500"
	bind:this={navContainer}
>
	<div class="md:flex-none flex items-center justify-between flex-1">
		<div class="logo-container md:w-auto flex items-center w-full gap-4 px-2 py-2">
			<div class="gap-x-2 flex items-center justify-center">
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
				<div class="no-scrollbar gap-x-4 flex overflow-x-auto">
					{#if headerLinks && Object.keys(headerLinks).length > 0}
						{#each Object.entries(headerLinks) as [key, value]}
							<div class="bg-white/80 dark:bg-gray-800 flex-shrink-0 border rounded-md">
								<a href={value} class="dark:text-white block px-2 py-1 font-semibold text-gray-900"
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
					class="burger-icon dark:text-white w-6 h-6 text-gray-900"
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
