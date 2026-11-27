import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchAutocompleteResults = vi.fn();
const mockGetBoundsCache = vi.fn();

const mockEnv = vi.hoisted(() => ({
	PRIVATE_OBA_GEOCODER_API_KEY: 'test-geocoder-key'
}));

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

vi.mock('$env/static/private', () => ({
	PRIVATE_OBA_GEOCODER_PROVIDER: 'google'
}));

vi.mock('$lib/geocoder', () => ({
	fetchAutocompleteResults: (...args: unknown[]) => mockFetchAutocompleteResults(...args)
}));

vi.mock('$lib/serverCache.js', () => ({
	getBoundsCache: (...args: unknown[]) => mockGetBoundsCache(...args)
}));

const { GET } = await import('../../routes/api/oba/place-suggestions/+server.js');

describe('GET /api/oba/place-suggestions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetBoundsCache.mockReturnValue(null);
	});

	it('returns empty suggestions without calling geocoder when query is blank', async () => {
		const response = await GET({
			url: new URL('http://localhost/api/oba/place-suggestions?query=%20%20')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ suggestions: [] });
		expect(mockFetchAutocompleteResults).not.toHaveBeenCalled();
	});

	it('forwards trimmed query and bounds to fetchAutocompleteResults', async () => {
		const bounds = { north: 48, south: 47, east: -122, west: -123 };
		mockGetBoundsCache.mockReturnValue(bounds);
		mockFetchAutocompleteResults.mockResolvedValue([
			{ placeId: 'p1', name: 'Space Needle', displayText: 'Space Needle' }
		]);

		const response = await GET({
			url: new URL('http://localhost/api/oba/place-suggestions?query=%20Space%20Needle%20')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			suggestions: [{ placeId: 'p1', name: 'Space Needle', displayText: 'Space Needle' }]
		});
		expect(mockFetchAutocompleteResults).toHaveBeenCalledWith(
			'google',
			'Space Needle',
			'test-geocoder-key',
			bounds
		);
	});

	it('returns 500 JSON error when autocomplete lookup fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(vi.fn());
		mockFetchAutocompleteResults.mockRejectedValue(new Error('Upstream outage'));

		const response = await GET({
			url: new URL('http://localhost/api/oba/place-suggestions?query=Seattle')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Failed to fetch place suggestions' });
	});
});
