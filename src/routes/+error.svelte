<script>
	import { page } from '$app/stores';
	import { _ } from 'svelte-i18n';

	const status = $derived($page.status);
	const errorMessage = $derived($page.error?.message || '');

	const errorKey = $derived(
		status === 404 ? '404' : status === 403 ? '403' : status === 500 ? '500' : 'generic'
	);

	const iconPaths = {
		404: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
		403: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
		500: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z',
		generic: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	};

	const iconPath = $derived(iconPaths[errorKey] || iconPaths.generic);

	// Hardcoded fallback titles for when i18n isn't initialized yet
	const fallbackTitles = {
		404: 'Page not found',
		403: 'Access denied',
		500: 'Server error',
		generic: 'Something went wrong'
	};

	const fallbackDescriptions = {
		404: "The page you're looking for doesn't exist or has been moved.",
		403: "You don't have permission to view this page.",
		500: 'Something went wrong on our end. Please try again later.',
		generic: 'An unexpected error occurred.'
	};

	// Safe wrapper for $_() that catches i18n initialization errors
	function safeTranslate(key, fallback) {
		try {
			const tFn = $_;
			if (typeof tFn === 'function') {
				const result = tFn(key);
				return result !== key ? result : fallback;
			}
			return fallback;
		} catch {
			return fallback;
		}
	}

	const title = $derived(safeTranslate(`error.${errorKey}.title`, fallbackTitles[errorKey]));
	const description = $derived(
		safeTranslate(`error.${errorKey}.description`, fallbackDescriptions[errorKey])
	);
	const goHomeText = $derived(safeTranslate('error.go_home', 'Go home'));
	const goBackText = $derived(safeTranslate('error.go_back', 'Go back'));
</script>

<svelte:head>
	<title>{status} — {title}</title>
</svelte:head>

<div
	class="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-black"
	id="error-page"
>
	<div class="flex flex-col items-center px-6 py-12 text-center">
		<div class="mb-6 flex h-20 w-20 items-center justify-center">
			<svg
				class="h-12 w-12 text-brand-accent dark:text-brand"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d={iconPath} />
			</svg>
		</div>

		<p
			class="mb-2 bg-gradient-to-br from-brand to-brand-accent bg-clip-text text-7xl font-extrabold tracking-tighter text-transparent"
			id="error-status-code"
		>
			{status}
		</p>

		<h1
			class="mb-3 text-2xl font-bold text-surface-foreground dark:text-surface-foreground-dark"
			id="error-title"
		>
			{title}
		</h1>

		<p class="mb-8 max-w-sm text-base text-gray-500 dark:text-gray-400" id="error-description">
			{description}
		</p>

		{#if errorMessage}
			<p
				class="mb-8 rounded-lg bg-gray-100 px-4 py-2 font-mono text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-500"
				id="error-detail"
			>
				{errorMessage}
			</p>
		{/if}

		<div class="flex gap-3">
			<a href="/" class="button--primary inline-flex items-center gap-2" id="error-go-home">
				<svg
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
					/>
				</svg>
				{goHomeText}
			</a>
			<button
				onclick={() => history.back()}
				class="button inline-flex items-center gap-2 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700"
				id="error-go-back"
			>
				<svg
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				{goBackText}
			</button>
		</div>
	</div>
</div>
