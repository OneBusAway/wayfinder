import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
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
