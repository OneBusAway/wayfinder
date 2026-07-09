import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// SvelteKit only ships files from the configured assets directory
// (kit.files.assets, which this repo points at src/static), so any
// root-relative asset the app references must live there. The config is
// read as text because importing it pulls in vite, which cannot load in
// the jsdom test environment.
const repoRoot = path.resolve(__dirname, '../..');
const svelteConfig = fs.readFileSync(path.join(repoRoot, 'svelte.config.js'), 'utf8');
const assetsSetting = svelteConfig.match(/assets:\s*'([^']+)'/)?.[1] ?? 'static';
const assetsDir = path.resolve(repoRoot, assetsSetting);

// favicon.png and apple-touch-icon.png are the icon defaults in +layout.svelte;
// the android-chrome icons are the web app manifest defaults in api/manifest/+server.js.
const referencedAssets = [
	'favicon.png',
	'apple-touch-icon.png',
	'android-chrome-192x192.png',
	'android-chrome-512x512.png'
];

describe('static assets', () => {
	it.each(referencedAssets)('includes %s', (file) => {
		expect(fs.existsSync(path.join(assetsDir, file)), file).toBe(true);
	});

	it('has no decoy asset directory that SvelteKit would silently ignore', () => {
		const defaultDir = path.resolve(repoRoot, 'static');
		expect(defaultDir === assetsDir || !fs.existsSync(defaultDir)).toBe(true);
	});
});
