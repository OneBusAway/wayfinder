import { init, addMessages, register, getLocaleFromNavigator } from 'svelte-i18n';

// English loaded synchronously as the fallback locale
import english from '../locales/en.json';
addMessages('en', english);

// Other locales registered with lazy loaders
register('am', () => import('../locales/am.json').then((m) => m.default));
register('ar', () => import('../locales/ar.json').then((m) => m.default));
register('es', () => import('../locales/es.json').then((m) => m.default));
register('pl', () => import('../locales/pl.json').then((m) => m.default));
register('so', () => import('../locales/so.json').then((m) => m.default));
register('tl', () => import('../locales/tl.json').then((m) => m.default));
register('vi', () => import('../locales/vi.json').then((m) => m.default));
register('zh-CN', () => import('../locales/zh-CN.json').then((m) => m.default));

init({
	fallbackLocale: 'en',
	initialLocale: getLocaleFromNavigator()
});
