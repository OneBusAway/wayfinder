import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	define: {
		__SHOW_REGION_NAME_IN_NAV_BAR__: JSON.stringify(
			process.env.SHOW_REGION_NAME_IN_NAV_BAR !== 'false'
		)
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
		setupFiles: ['./vitest-setup.js'],
		globals: true
	}
});
