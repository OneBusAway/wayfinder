import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
	js.configs.recommended,
	...tsPlugin.configs['flat/recommended'].map((config) => ({
		...config,
		files: ['**/*.ts']
	})),
	...tsPlugin.configs['flat/stylistic'].map((config) => ({
		...config,
		files: ['**/*.ts']
	})),
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: { ts: tsParser }
			}
		}
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				L: 'readonly',
				google: 'readonly',
				$state: 'readonly',
				Temporal: 'readonly',
				__SHOW_REGION_NAME_IN_NAV_BAR__: 'readonly',
				__OBA_LOGO_URL_DARK__: 'readonly'
			}
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', 'src/lib/googleMaps.js', 'coverage']
	}
];
