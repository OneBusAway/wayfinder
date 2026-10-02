import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...withSvelteAndTsFiles(tsPlugin.configs['flat/recommended']),
	...withSvelteAndTsFiles(tsPlugin.configs['flat/stylistic']),
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: { ts: tsParser }
			}
		},
		rules: {
			'@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }]
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

/**
 * Applies typescript-eslint configs to Svelte components as well as TS files. Entries that are
 * already scoped keep their `files`, notably "typescript-eslint/eslint-recommended", which turns
 * off core rules like `no-undef` and `no-dupe-keys` that the TS compiler covers in `.ts` files.
 * Most Svelte components are plain JS that isn't type-checked so they need those core rules.
 *
 * @param {import('eslint').Linter.Config[]} configs
 */
function withSvelteAndTsFiles(configs) {
	return configs.map((config) => ({
		...config,
		files: config.files ?? ['**/*.svelte', '**/*.ts']
	}));
}
