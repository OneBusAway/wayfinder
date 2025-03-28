import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		coverage: {
			provider: 'v8',
			reportsDirectory: './coverage',
			reporter: ['html', 'lcov'],
			all: true,
			exclude: ['**/tests', '.svelte-kit', 'build', 'coverage', 'node_modules']
		},
		environment: 'jsdom'
	}
});
