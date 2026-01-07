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
import { init, addMessages, register, getLocaleFromNavigator } from 'svelte-i18n';

// English loaded synchronously as the fallback locale
import english from '../locales/en.json';
addMessages('en', english);

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

init({
	fallbackLocale: 'en',
	initialLocale: getLocaleFromNavigator()
});

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
