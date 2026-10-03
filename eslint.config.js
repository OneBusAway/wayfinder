import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...withSvelteAndTsFiles(tseslint.configs.recommended),
	...withSvelteAndTsFiles(tseslint.configs.stylistic),
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		files: ['**/*.svelte'],
		plugins: { '@typescript-eslint': tseslint.plugin },
		languageOptions: {
			parserOptions: {
				parser: { ts: tseslint.parser }
			}
		},
		rules: {
			// No-op default callbacks are common in component props.
			'@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
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
 * Base parser entries apply only to TS files so they cannot override Svelte's outer parser,
 * regardless of config order. Svelte registers the plugin and delegates TS scripts separately.
 *
 * @param {import('eslint').Linter.Config[]} configs
 */
function withSvelteAndTsFiles(configs) {
	return configs.map((config) => ({
		...config,
		files:
			config.files ?? (config.languageOptions?.parser ? ['**/*.ts'] : ['**/*.svelte', '**/*.ts'])
	}));
}
