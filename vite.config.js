import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config();

/**
 * flowbite-svelte 0.47 ships a few components that import from the package barrel
 * (`from ".."`). Vite SSR then loads index.js → Badge.svelte → index.js and
 * throws "dependency module is not yet fully initialized". Rewrite those
 * imports to the real files so the cycle never starts.
 */
function flowbiteSvelteNoCircular() {
	const closeButtonFromBarrel = /import\s*\{\s*CloseButton\s*\}\s*from\s*["']\.\.["']\s*;/;
	const buttonFromBarrel = /import\s*\{\s*Button\s*\}\s*from\s*["']\.\.["']\s*;/;

	return {
		name: 'flowbite-svelte-no-circular',
		enforce: 'pre',
		transform(code, id) {
			const normalizedId = id.split('?')[0];
			if (!normalizedId.includes('flowbite-svelte/dist/')) {
				return;
			}

			if (
				normalizedId.endsWith('/badge/Badge.svelte') ||
				normalizedId.endsWith('/forms/Fileupload.svelte') ||
				normalizedId.endsWith('/toast/Toast.svelte')
			) {
				if (closeButtonFromBarrel.test(code)) {
					return {
						code: code.replace(
							closeButtonFromBarrel,
							'import CloseButton from "../utils/CloseButton.svelte";'
						),
						map: null
					};
				}
			}

			if (normalizedId.endsWith('/datepicker/Datepicker.svelte') && buttonFromBarrel.test(code)) {
				return {
					code: code.replace(buttonFromBarrel, 'import Button from "../buttons/Button.svelte";'),
					map: null
				};
			}
		}
	};
}

export default defineConfig({
	plugins: [flowbiteSvelteNoCircular(), tailwindcss(), sveltekit(), svelteTesting()],
	optimizeDeps: {
		include: ['tailwind-merge', 'apexcharts', '@floating-ui/dom', 'deepmerge', 'intl-messageformat']
	},
	define: {
		__SHOW_REGION_NAME_IN_NAV_BAR__: JSON.stringify(
			process.env.SHOW_REGION_NAME_IN_NAV_BAR !== 'false'
		),
		__OBA_LOGO_URL_DARK__: JSON.stringify(process.env.OBA_LOGO_URL_DARK || '')
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		coverage: {
			provider: 'v8',
			reportsDirectory: './coverage',
			reporter: ['html', 'lcov', 'text'],
			all: true,
			exclude: [
				'**/tests',
				'.svelte-kit',
				'build',
				'coverage',
				'node_modules',
				'**/*.d.ts',
				'**/vendor/**'
			],
			thresholds: {
				global: {
					branches: 70,
					functions: 70,
					lines: 70,
					statements: 70
				}
			}
		},
		environment: 'jsdom',
		env: {
			TZ: 'UTC'
		},
		setupFiles: ['./vitest-setup.js'],
		globals: true
	}
});
