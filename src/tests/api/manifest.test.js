import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../routes/api/manifest/+server.js';
import { truncateShortName } from '$lib/manifestUtils.js';

// Mock the $env/dynamic/public module
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_OBA_REGION_NAME: 'Test Region',
		MANIFEST_ICON_192_URL: '/custom-192.png',
		MANIFEST_ICON_512_URL: '/custom-512.png'
	}
}));

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
		vi.clearAllMocks();
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
		const mockUrl = new URL('http://localhost/api/manifest?name=Custom%20Stop%20Name');
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest.name).toBe('Custom Stop Name');
		expect(manifest.short_name).toBe('Custom Stop');
	});

	it('should truncate long names for short_name', async () => {
		const mockUrl = new URL(
			'http://localhost/api/manifest?name=Downtown%20Transit%20Center%20Station'
		);
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest.name).toBe('Downtown Transit Center Station');
		expect(manifest.short_name).toBe('Downtown');
		expect(manifest.short_name.length).toBeLessThanOrEqual(12);
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

	it('should handle special characters in name parameter', async () => {
		const mockUrl = new URL('http://localhost/api/manifest?name=Stop%20%26%20Go');
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest.name).toBe('Stop & Go');
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
	it('should use custom manifest icons when env vars are set', async () => {
		const mockUrl = new URL('http://localhost/api/manifest');
		const response = await GET({ url: mockUrl });
		const manifest = await response.json();

		expect(manifest.icons[0].src).toBe('/custom-192.png');
		expect(manifest.icons[1].src).toBe('/custom-512.png');
});

});
