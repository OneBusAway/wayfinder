import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRoutesForLocation = vi.fn();
const mockStopsForLocation = vi.fn();
const mockGetBoundsCache = vi.fn();

const mockEnv = vi.hoisted(() => ({
	PRIVATE_OBA_AGENCY_FILTER: '',
	PRIVATE_OBA_GEOCODER_API_KEY: 'test-key'
}));

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_OBA_SERVER_URL: 'https://test.example.com/',
	PUBLIC_OBA_REGION_CENTER_LAT: '47.6',
	PUBLIC_OBA_REGION_CENTER_LNG: '-122.3'
}));

vi.mock('$env/static/private', () => ({
	PRIVATE_OBA_API_KEY: 'test-key',
	PRIVATE_OBA_GEOCODER_PROVIDER: 'google'
}));

vi.mock('onebusaway-sdk', () => ({
	OnebusawaySDK: vi.fn().mockImplementation(() => ({
		routesForLocation: { list: (...args) => mockRoutesForLocation(...args) },
		stopsForLocation: { list: (...args) => mockStopsForLocation(...args) }
	}))
}));

vi.mock('$lib/serverCache.js', () => ({
	getBoundsCache: (...args) => mockGetBoundsCache(...args)
}));

vi.mock('$lib/geocoder', () => ({
	googleGeocode: vi.fn().mockResolvedValue(null),
	bingGeocode: vi.fn().mockResolvedValue(null)
}));

const { GET } = await import('../../routes/api/oba/search/+server.js');

describe('search endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.PRIVATE_OBA_AGENCY_FILTER = '';
		mockGetBoundsCache.mockReturnValue(null);
	});

	function makeRequest(query) {
		return GET({
			url: new URL(`http://localhost/api/oba/search?query=${encodeURIComponent(query)}`)
		});
	}

	it('returns filtered routes when agency filter is set', async () => {
		mockEnv.PRIVATE_OBA_AGENCY_FILTER = '19';

		mockRoutesForLocation.mockResolvedValue({
			data: {
				list: [
					{ id: 'r1', agencyId: '19', shortName: '1' },
					{ id: 'r2', agencyId: '29', shortName: '2' }
				]
			}
		});
		mockStopsForLocation.mockResolvedValue({
			data: {
				list: [
					{ id: 's1', routeIds: ['19_100'] },
					{ id: 's2', routeIds: ['29_200'] }
				]
			}
		});

		const response = await makeRequest('test');
		const json = await response.json();

		expect(json.routes).toHaveLength(1);
		expect(json.routes[0].agencyId).toBe('19');
		expect(json.stops).toHaveLength(1);
		expect(json.stops[0].id).toBe('s1');
	});

	it('returns all routes when agency filter is not set', async () => {
		mockRoutesForLocation.mockResolvedValue({
			data: {
				list: [
					{ id: 'r1', agencyId: '19', shortName: '1' },
					{ id: 'r2', agencyId: '29', shortName: '2' }
				]
			}
		});
		mockStopsForLocation.mockResolvedValue({
			data: {
				list: [
					{ id: 's1', routeIds: ['19_100'] },
					{ id: 's2', routeIds: ['29_200'] }
				]
			}
		});

		const response = await makeRequest('test');
		const json = await response.json();

		expect(json.routes).toHaveLength(2);
		expect(json.stops).toHaveLength(2);
	});

	it('returns 500 with error message when search fails', async () => {
		mockRoutesForLocation.mockRejectedValue(new Error('Network failure'));

		const response = await makeRequest('test');

		expect(response.status).toBe(500);
		const json = await response.json();
		expect(json.error).toBe('Search failed');
		expect(json.message).toBe('Network failure');
	});
});
