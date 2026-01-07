<script>
	import Header from '$components/navigation/Header.svelte';
	import '../app.css';
	import { config } from '@fortawesome/fontawesome-svg-core';
	import '@fortawesome/fontawesome-svg-core/styles.css';
	import '$lib/i18n';
	import { isRTL } from '$lib/i18n';
	import { locale } from 'svelte-i18n';
	import { onMount } from 'svelte';
	import analytics from '$lib/Analytics/PlausibleAnalytics.js';
	import { initSystemTheme } from '$lib/systemTheme.js';
	import { env } from '$env/dynamic/public';

	const faviconUrl = env.FAVICON_URL || '/favicon-32x32.png';

	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { children } = $props();
	config.autoAddCss = false; // Tell Font Awesome to skip adding the CSS automatically since it's being imported above

	onMount(() => {
		initSystemTheme();

		locale.subscribe((lang) => {
			let classList = document.documentElement.classList;
			if (isRTL(lang)) {
				classList.add('rtl');
			} else {
				classList.remove('rtl');
			}
		});

		analytics.reportPageView('/');
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href={faviconUrl} />
</svelte:head>

<div class="flex h-dvh w-full flex-col">
	<Header />
	<div class="relative flex-1 overflow-hidden dark:bg-black">
		{@render children?.()}
	</div>
</div>
