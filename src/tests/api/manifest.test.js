import { describe, it, expect, vi, beforeEach } from 'vitest';
import { truncateShortName } from '$lib/manifestUtils.js';

const privateEnv = {
	PRIVATE_MANIFEST_ICON_192_URL: undefined,
	PRIVATE_MANIFEST_ICON_512_URL: undefined
};

vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_OBA_REGION_NAME: 'Test Region'
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: privateEnv
}));

const { GET } = await import('../../routes/api/manifest/+server.js');

describe('truncateShortName', () => {
	it('should return name unchanged if within limit', () => {
		expect(truncateShortName('Short')).toBe('Short');
		expect(truncateShortName('Exactly12ch')).toBe('Exactly12ch');
	});

	it('should truncate at word boundary when possible', () => {
		expect(truncateShortName('Downtown Transit Center')).toBe('Downtown');
		expect(truncateShortName('Main Street Station')).toBe('Main Street');
	});

	it('should truncate at limit when no word boundary found', () => {
		expect(truncateShortName('Superlongwordwithoutspaces')).toBe('Superlongwor');
	});

	it('should handle custom maxLength', () => {
		expect(truncateShortName('Hello World', 5)).toBe('Hello');
		expect(truncateShortName('Hello World', 20)).toBe('Hello World');
	});

	it('should handle edge cases', () => {
		expect(truncateShortName('')).toBe('');
		expect(truncateShortName('A')).toBe('A');
		expect(truncateShortName('A B C D E F G H I')).toBe('A B C D E F');
	});

	it('should trim trailing whitespace after truncation', () => {
		expect(truncateShortName('Hello   World Test')).toBe('Hello');
	});
});

describe('GET /api/manifest', () => {
	beforeEach(() => {
		privateEnv.PRIVATE_MANIFEST_ICON_192_URL = undefined;
		privateEnv.PRIVATE_MANIFEST_ICON_512_URL = undefined;
	});

	it('should return manifest with default values when no params provided', async () => {
		const mockUrl = new URL('http://localhost/api/manifest');
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest.start_url).toBe('/');
		expect(manifest.name).toBe('Test Region');
		expect(manifest.short_name).toBe('Test Region');
		expect(manifest.display).toBe('standalone');
		expect(manifest.icons).toHaveLength(2);
	});

	it('should use provided start_url parameter', async () => {
		const mockUrl = new URL('http://localhost/api/manifest?start=/stops/123');
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest.start_url).toBe('/stops/123');
	});

	it('should use provided name parameter', async () => {
		const mockUrl = new URL('http://localhost/api/manifest?name=Custom%20Stop');
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest.name).toBe('Custom Stop');
	});

	it('should fall back to default manifest icons when PRIVATE env vars are not set', async () => {
		const mockUrl = new URL('http://localhost/api/manifest');
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest.icons[0].src).toBe('/android-chrome-192x192.png');
		expect(manifest.icons[1].src).toBe('/android-chrome-512x512.png');
	});

	it('should use custom manifest icons from PRIVATE env vars', async () => {
		privateEnv.PRIVATE_MANIFEST_ICON_192_URL = '/custom-192.png';
		privateEnv.PRIVATE_MANIFEST_ICON_512_URL = '/custom-512.png';

		const mockUrl = new URL('http://localhost/api/manifest');
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest.icons[0].src).toBe('/custom-192.png');
		expect(manifest.icons[1].src).toBe('/custom-512.png');
	});

	it('should set correct content-type header', async () => {
		const mockUrl = new URL('http://localhost/api/manifest');
		const response = await GET({ url: mockUrl });

		expect(response.headers.get('Content-Type')).toBe('application/manifest+json');
	});

	it('should set cache-control header', async () => {
		const mockUrl = new URL('http://localhost/api/manifest');
		const response = await GET({ url: mockUrl });

		expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
	});

	it('should include all required manifest fields', async () => {
		const mockUrl = new URL('http://localhost/api/manifest');
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest).toHaveProperty('name');
		expect(manifest).toHaveProperty('short_name');
		expect(manifest).toHaveProperty('start_url');
		expect(manifest).toHaveProperty('display');
		expect(manifest).toHaveProperty('theme_color');
		expect(manifest).toHaveProperty('background_color');
		expect(manifest).toHaveProperty('icons');
	});
});
