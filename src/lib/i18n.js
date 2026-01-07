import { init, addMessages, getLocaleFromNavigator } from 'svelte-i18n';

import amharic from '../locales/am.json';
import arabic from '../locales/ar.json';
import english from '../locales/en.json';
import spanish from '../locales/es.json';
import polish from '../locales/pl.json';
import simplifiedChinese from '../locales/zh-CN.json';
import somali from '../locales/so.json';
import tagalog from '../locales/tl.json';
import vietnamese from '../locales/vi.json';

addMessages('am', amharic);
addMessages('ar', arabic);
addMessages('en', english);
addMessages('es', spanish);
addMessages('pl', polish);
addMessages('so', somali);
addMessages('tl', tagalog);
addMessages('vi', vietnamese);
addMessages('zh-CN', simplifiedChinese);

init({
	fallbackLocale: 'en',
	initialLocale: getLocaleFromNavigator()
});
