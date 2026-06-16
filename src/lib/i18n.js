/**
 * Initializes internationalization (i18n) support for the application.
 *
 * Configures svelte-i18n with English as the fallback locale and registers
 * lazy-loaded translations for 23 additional languages. The initial locale
 * is automatically detected from the browser's navigator settings.
 *
 * Supported locales:
 * - Fallback: English (en)
 * - Lazy-loaded: Amharic (am), Arabic (ar), Spanish (es), Persian (fa),
 *   French (fr), Hindi (hi), Haitian Creole (ht), Japanese (ja),
 *   Khmer (km), Korean (ko), Lao (lo), Oromo (om), Punjabi (pa),
 *   Polish (pl), Portuguese (pt), Russian (ru), Samoan (sm),
 *   Somali (so), Tigrinya (ti), Tagalog (tl), Ukrainian (uk),
 *   Vietnamese (vi), Chinese Simplified (zh-CN), Chinese Traditional (zh-TW)
 */
import { init, addMessages, register, getLocaleFromNavigator, locale } from 'svelte-i18n';
import { browser } from '$app/environment';

// Language metadata - single source of truth
export const languages = [
	{ code: 'am', nativeName: 'አማርኛ', englishName: 'Amharic' },
	{ code: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
	{ code: 'en', nativeName: 'English', englishName: 'English' },
	{ code: 'es', nativeName: 'Español', englishName: 'Spanish' },
	{ code: 'fa', nativeName: 'فارسی', englishName: 'Persian' },
	{ code: 'fr', nativeName: 'Français', englishName: 'French' },
	{ code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
	{ code: 'ht', nativeName: 'Kreyòl ayisyen', englishName: 'Haitian Creole' },
	{ code: 'ja', nativeName: '日本語', englishName: 'Japanese' },
	{ code: 'km', nativeName: 'ភាសាខ្មែរ', englishName: 'Khmer' },
	{ code: 'ko', nativeName: '한국어', englishName: 'Korean' },
	{ code: 'lo', nativeName: 'ລາວ', englishName: 'Lao' },
	{ code: 'om', nativeName: 'Oromoo', englishName: 'Oromo' },
	{ code: 'pa', nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi' },
	{ code: 'pl', nativeName: 'Polski', englishName: 'Polish' },
	{ code: 'pt', nativeName: 'Português', englishName: 'Portuguese' },
	{ code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
	{ code: 'sm', nativeName: 'Gagana Samoa', englishName: 'Samoan' },
	{ code: 'so', nativeName: 'Soomaali', englishName: 'Somali' },
	{ code: 'ti', nativeName: 'ትግርኛ', englishName: 'Tigrinya' },
	{ code: 'tl', nativeName: 'Tagalog', englishName: 'Tagalog' },
	{ code: 'uk', nativeName: 'Українська', englishName: 'Ukrainian' },
	{ code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese' },
	{ code: 'zh-CN', nativeName: '简体中文', englishName: 'Chinese (Simplified)' },
	{ code: 'zh-TW', nativeName: '繁體中文', englishName: 'Chinese (Traditional)' }
];

// English loaded synchronously as the fallback locale
import english from '../locales/en.json';

// Named because init() below must bootstrap on this synchronously-loaded locale.
const FALLBACK_LOCALE = 'en';
addMessages(FALLBACK_LOCALE, english);

// Other locales registered with lazy loaders
register('am', () => import('../locales/am.json').then((m) => m.default));
register('ar', () => import('../locales/ar.json').then((m) => m.default));
register('es', () => import('../locales/es.json').then((m) => m.default));
register('fa', () => import('../locales/fa.json').then((m) => m.default));
register('fr', () => import('../locales/fr.json').then((m) => m.default));
register('hi', () => import('../locales/hi.json').then((m) => m.default));
register('ht', () => import('../locales/ht.json').then((m) => m.default));
register('ja', () => import('../locales/ja.json').then((m) => m.default));
register('km', () => import('../locales/km.json').then((m) => m.default));
register('ko', () => import('../locales/ko.json').then((m) => m.default));
register('lo', () => import('../locales/lo.json').then((m) => m.default));
register('om', () => import('../locales/om.json').then((m) => m.default));
register('pa', () => import('../locales/pa.json').then((m) => m.default));
register('pl', () => import('../locales/pl.json').then((m) => m.default));
register('pt', () => import('../locales/pt.json').then((m) => m.default));
register('ru', () => import('../locales/ru.json').then((m) => m.default));
register('sm', () => import('../locales/sm.json').then((m) => m.default));
register('so', () => import('../locales/so.json').then((m) => m.default));
register('ti', () => import('../locales/ti.json').then((m) => m.default));
register('tl', () => import('../locales/tl.json').then((m) => m.default));
register('uk', () => import('../locales/uk.json').then((m) => m.default));
register('vi', () => import('../locales/vi.json').then((m) => m.default));
register('zh-CN', () => import('../locales/zh-CN.json').then((m) => m.default));
register('zh-TW', () => import('../locales/zh-TW.json').then((m) => m.default));

// Get initial locale from localStorage if available, otherwise use browser preference
export function getInitialLocale() {
	// Check localStorage first (user preference)
	if (browser) {
		try {
			const savedLocale = localStorage.getItem('locale');
			if (savedLocale && languages.find((l) => l.code === savedLocale)) {
				return savedLocale;
			}
		} catch (e) {
			console.warn('Unable to read locale from localStorage:', e.message);
		}
	}

	// Fallback to browser language (getLocaleFromNavigator handles fallback via fallbackLocale)
	return getLocaleFromNavigator() || 'en';
}

// Initialize synchronously with the fallback locale, the only dictionary loaded
// up front (via addMessages above). Every other locale is lazy-registered, and
// svelte-i18n defers setting $locale until a lazy dictionary's dynamic import
// resolves — leaving $locale null in the meantime. Any $t()/$format() call
// during that window throws "Cannot format a message without first setting the
// initial locale", crashing hydration for visitors whose initial locale is not
// English. Bootstrapping on the fallback guarantees $locale is set before
// anything renders.
init({
	fallbackLocale: FALLBACK_LOCALE,
	initialLocale: FALLBACK_LOCALE
});

// Client-only: switch to the visitor's preferred locale. locale.set() leaves the
// store at its current value ('en', set synchronously by init above) until the
// lazy dictionary resolves, so there's no null-locale window.
if (browser) {
	const preferredLocale = getInitialLocale();
	if (preferredLocale && preferredLocale !== FALLBACK_LOCALE) {
		// locale.set() returns the dictionary-load promise only when the locale has
		// a pending lazy dictionary to flush; when the resolved dictionary is
		// already loaded (e.g. an "en-US" preference closest-matching the
		// synchronously-loaded fallback) it returns undefined. Wrap in
		// Promise.resolve() so both cases are handled and a load failure is logged
		// instead of crashing bootstrap or becoming an unhandled rejection.
		Promise.resolve(locale.set(preferredLocale)).catch((e) => {
			console.warn(`Unable to load locale "${preferredLocale}":`, e?.message);
		});
	}
}

/**
 * Determines if a given language uses right-to-left (RTL) text direction.
 *
 * @param {string} lang - The language code to check (case-insensitive)
 * @returns {boolean} True if the language uses RTL direction, false otherwise
 *
 * @example
 * isRTL('ar'); // true
 * isRTL('en'); // false
 */
export function isRTL(lang) {
	return ['ar', 'fa', 'he', 'ur'].includes(lang.toLowerCase());
}
