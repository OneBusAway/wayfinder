import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// https://svelte.dev/docs/kit/adapter-node
		adapter: adapter(),
		files: {
			assets: 'src/static'
		},
		alias: {
			$components: './src/components',
			$config: './src/config',
			$images: './src/assets/images',
			$lib: './src/lib',
			$src: './src',
			$stores: './src/stores'
		}
	},
	preprocess: vitePreprocess()
};

export default config;
