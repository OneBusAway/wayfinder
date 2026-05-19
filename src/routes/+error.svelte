<script>
	import { page } from '$app/stores';
	import { _ } from 'svelte-i18n';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faMap,
		faBan,
		faTriangleExclamation,
		faCircleExclamation,
		faHome,
		faArrowLeft
	} from '@fortawesome/free-solid-svg-icons';

	const status = $derived($page.status);
	const errorMessage = $derived($page.error?.message || '');

	const errorKey = $derived(
		status === 404 ? '404' : status === 403 ? '403' : status === 500 ? '500' : 'generic'
	);

	const icons = {
		404: faMap,
		403: faBan,
		500: faTriangleExclamation,
		generic: faCircleExclamation
	};

	const icon = $derived(icons[errorKey] || icons.generic);

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
		<div class="mb-6 flex items-center justify-center">
			<FontAwesomeIcon {icon} class="text-4xl text-brand-accent dark:text-brand" />
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
				<FontAwesomeIcon icon={faHome} class="text-sm" />
				{goHomeText}
			</a>
			<button
				onclick={() => history.back()}
				class="button inline-flex items-center gap-2 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700"
				id="error-go-back"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="text-sm" />
				{goBackText}
			</button>
		</div>
	</div>
</div>
