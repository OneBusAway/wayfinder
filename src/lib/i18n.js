import { init, addMessages, getLocaleFromNavigator } from 'svelte-i18n';

import amharic from '../locales/am.json';
import arabic from '../locales/ar.json';
import english from '../locales/en.json';
import korean from '../locales/ko.json';
import spanish from '../locales/es.json';
import polish from '../locales/pl.json';
import russian from '../locales/ru.json';
import simplifiedChinese from '../locales/zh-CN.json';
import traditionalChinese from '../locales/zh-TW.json';
import somali from '../locales/so.json';
import tagalog from '../locales/tl.json';
import ukrainian from '../locales/uk.json';
import vietnamese from '../locales/vi.json';
import punjabi from '../locales/pa.json';
import khmer from '../locales/km.json';
import lao from '../locales/lo.json';

addMessages('am', amharic);
addMessages('ar', arabic);
addMessages('en', english);
addMessages('es', spanish);
addMessages('ko', korean);
addMessages('km', khmer);
addMessages('lo', lao);
addMessages('pl', polish);
addMessages('ru', russian);
addMessages('so', somali);
addMessages('tl', tagalog);
addMessages('uk', ukrainian);
addMessages('vi', vietnamese);
addMessages('pa', punjabi);
addMessages('zh-CN', simplifiedChinese);
addMessages('zh-TW', traditionalChinese);

init({
	fallbackLocale: 'en',
	initialLocale: getLocaleFromNavigator()
});
