<script>
	import { languages } from '$lib/i18n';
	import { locale, t } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';

	let isOpen = $state(false);
	let menuRef = $state(null);

	// Format language based on format string
	// Supported formats: "native", "english", "native-english", "english-native", "code"
	// If native and english names are the same, avoid redundant display (e.g., "English (English)")
	function formatLanguage(lang, format) {
		// Check if native and english names are the same
		const isSame = lang.nativeName === lang.englishName;

		switch (format) {
			case 'native':
				return lang.nativeName;
			case 'english':
				return lang.englishName;
			case 'native-english':
				// If names are the same, just return one to avoid redundancy
				return isSame ? lang.nativeName : `${lang.nativeName} (${lang.englishName})`;
			case 'english-native':
				// If names are the same, just return one to avoid redundancy
				return isSame ? lang.englishName : `${lang.englishName} (${lang.nativeName})`;
			case 'code':
				return lang.code.toUpperCase();
			default:
				// Default to native-english if format is invalid
				return isSame ? lang.nativeName : `${lang.nativeName} (${lang.englishName})`;
		}
	}

	// Get language display for button (top menu)
	// Default: "native"
	const buttonFormat = env.PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT || 'native';

	// Get language display for dropdown menu
	// Default: "native-english"
	const menuFormat = env.PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT || 'native-english';

	// Get language name for a locale code, handling locale variants (e.g., 'en-US' -> 'en')
	function getLanguageNameForLocale(localeCode, format = buttonFormat) {
		if (!localeCode) return 'EN';

		// Extract base language code (e.g., 'en-US' -> 'en', 'zh-CN' -> 'zh-CN')
		const baseCode = localeCode.split('-')[0];

		// First try exact match (for codes like 'zh-CN', 'zh-TW')
		let lang = languages.find((l) => l.code === localeCode);

		// If no exact match, try base code (e.g., 'en-US' -> 'en')
		if (!lang) {
			lang = languages.find((l) => l.code === baseCode);
		}

		if (!lang) return 'EN';

		return formatLanguage(lang, format);
	}

	// Check if language switcher is enabled (defaults to true if not set)
	const isEnabled = env.PUBLIC_LANGUAGE_SWITCHER_ENABLED !== 'false';

	// Get current locale from svelte-i18n
	// Use $effect to subscribe and get initial value immediately
	let currentLocale = $state('en');

	$effect(() => {
		const unsubscribe = locale.subscribe((value) => {
			// The subscription callback is called immediately with current value
			currentLocale = value || 'en';
		});
		return unsubscribe;
	});

	function handleLanguageSelect(langCode) {
		if (browser) {
			locale.set(langCode);
			try {
				localStorage.setItem('locale', langCode);
			} catch (e) {
				console.warn('Unable to save language preference to localStorage:', e.message);
			}
		}
		isOpen = false;
	}

	$effect(() => {
		if (!isOpen) return;

		const handleClickOutside = (e) => {
			if (menuRef && !menuRef.contains(e.target)) {
				isOpen = false;
			}
		};

		// Delay adding listener to avoid immediate close from the click that opened it
		const timeoutId = setTimeout(() => {
			document.addEventListener('click', handleClickOutside);
		}, 0);

		return () => {
			clearTimeout(timeoutId);
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

{#if isEnabled}
	<div class="relative" bind:this={menuRef}>
		<button
			type="button"
			onclick={() => (isOpen = !isOpen)}
			aria-label={$t('language_switcher.select_language', { values: { language: getLanguageNameForLocale(currentLocale, buttonFormat) } })}
			aria-expanded={isOpen}
			aria-haspopup="listbox"
			class="flex h-8 items-center justify-center gap-1 rounded-md border bg-surface/80 px-2 font-semibold text-surface-foreground dark:bg-surface-dark dark:text-surface-foreground-dark"
		>
			<svg
				class="h-4 w-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
				></path>
			</svg>
			<span class="hidden sm:inline">{getLanguageNameForLocale(currentLocale, buttonFormat)}</span>
		</button>

		{#if isOpen}
			<div
				class="absolute end-0 top-full z-[9999] mt-1 max-h-[400px] overflow-y-auto rounded-md border border-gray-300 bg-surface shadow-lg dark:border-gray-600 dark:bg-surface-dark"
			>
				<div role="listbox" aria-label={$t('language_switcher.available_languages')} class="flex flex-col py-1">
					{#each languages as lang}
						<button
							type="button"
							role="option"
							aria-selected={lang.code === currentLocale}
							onclick={() => handleLanguageSelect(lang.code)}
							class="block w-full whitespace-nowrap px-4 py-2 text-left text-sm font-semibold text-surface-foreground hover:bg-gray-100 dark:text-surface-foreground-dark dark:hover:bg-gray-700 {lang.code ===
							currentLocale
								? 'bg-gray-100 dark:bg-gray-700'
								: ''}"
						>
							{formatLanguage(lang, menuFormat)}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
