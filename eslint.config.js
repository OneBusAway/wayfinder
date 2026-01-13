import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				L: 'readonly',
				google: 'readonly',
				$state: 'readonly',
				__SHOW_REGION_NAME_IN_NAV_BAR__: 'readonly',
				__OBA_LOGO_URL_DARK__: 'readonly'
			}
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', 'src/lib/googleMaps.js', 'coverage']
	}
];
