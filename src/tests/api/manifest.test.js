import { describe, it, expect, vi } from 'vitest';

// mock env FIRST
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_OBA_REGION_NAME: 'Test Region',
		MANIFEST_ICON_192_URL: '/custom-192.png',
		MANIFEST_ICON_512_URL: '/custom-512.png'
	}
}));

import { GET } from '../../routes/api/manifest/+server.js';
import { truncateShortName } from '$lib/manifestUtils.js';

describe('truncateShortName', () => {
	it('returns name unchanged if within limit', () => {
		expect(truncateShortName('Short')).toBe('Short');
	});

	it('truncates at word boundary', () => {
		expect(truncateShortName('Downtown Transit Center')).toBe('Downtown');
	});
});

describe('GET /api/manifest', () => {
	it('returns manifest with default values', async () => {
		const url = new URL('http://localhost/api/manifest');
		const res = await GET({ url });
		const manifest = await res.json();

		expect(manifest.name).toBe('Test Region');
		expect(manifest.short_name).toBe('Test Region');
		expect(manifest.icons).toHaveLength(2);
	});

	it('uses custom manifest icons from env', async () => {
		const url = new URL('http://localhost/api/manifest');
		const res = await GET({ url });
		const manifest = await res.json();

		expect(manifest.icons[0].src).toBe('/custom-192.png');
		expect(manifest.icons[1].src).toBe('/custom-512.png');
	});
});
