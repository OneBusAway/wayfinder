import { describe, it, expect, vi, beforeEach } from 'vitest';

const upstream = vi.hoisted(() => ({
	loadServicesForLocation: vi.fn(),
	loadServiceEntry: vi.fn()
}));
vi.mock('$lib/onDemand/upstream.server.js', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, ...upstream };
});
vi.mock('$env/static/private', () => ({ PRIVATE_OBA_API_KEY: 'secret' }));

import { GET as servicesForLocation } from '../../routes/api/oba/ondemand/services-for-location/+server.js';
import { GET as service } from '../../routes/api/oba/ondemand/service/[id]/+server.js';

describe('GET /api/oba/ondemand/services-for-location', () => {
	beforeEach(() => vi.clearAllMocks());

	it('400s on invalid input without calling upstream', async () => {
		const response = await servicesForLocation({
			url: new URL('http://x/api/oba/ondemand/services-for-location?lat=abc&lon=1')
		});
		expect(response.status).toBe(400);
		expect(upstream.loadServicesForLocation).not.toHaveBeenCalled();
	});

	it('still 400s on malformed spans even when a valid radius is present', async () => {
		const response = await servicesForLocation({
			url: new URL(
				'http://x/api/oba/ondemand/services-for-location?lat=1&lon=2&radius=500&latSpan=bad'
			)
		});
		const body = await response.json();
		expect(response.status).toBe(400);
		expect(body.error).toBe('latSpan and lonSpan must both be positive numbers');
		expect(upstream.loadServicesForLocation).not.toHaveBeenCalled();
	});

	it('pins exact lat/lon error strings for this route', async () => {
		const missingLat = await servicesForLocation({
			url: new URL('http://x/api/oba/ondemand/services-for-location?lon=1')
		});
		expect(await missingLat.json()).toEqual({
			error: 'lat must be between -90 and 90'
		});

		const badLon = await servicesForLocation({
			url: new URL('http://x/api/oba/ondemand/services-for-location?lat=1&lon=abc')
		});
		expect(await badLon.json()).toEqual({
			error: 'lon must be between -180 and 180'
		});
	});

	it('passes validated params and relays the result', async () => {
		upstream.loadServicesForLocation.mockResolvedValue({ kind: 'unsupported' });
		const response = await servicesForLocation({
			url: new URL(
				'http://x/api/oba/ondemand/services-for-location?lat=1&lon=2&latSpan=0.1&lonSpan=0.2&geometryDetail=simplified'
			)
		});
		expect(upstream.loadServicesForLocation).toHaveBeenCalledWith({
			lat: 1,
			lon: 2,
			latSpan: 0.1,
			lonSpan: 0.2,
			geometryDetail: 'simplified'
		});
		expect(response.status).toBe(501);
	});
});

describe('GET /api/oba/ondemand/service/[id]', () => {
	beforeEach(() => vi.clearAllMocks());

	it('400s on an invalid geometryDetail', async () => {
		const response = await service({
			params: { id: '1_a' },
			url: new URL('http://x/api/oba/ondemand/service/1_a?geometryDetail=huge')
		});
		expect(response.status).toBe(400);
	});

	it('relays a not-found', async () => {
		upstream.loadServiceEntry.mockResolvedValue({ kind: 'notFound' });
		const response = await service({
			params: { id: '1_a' },
			url: new URL('http://x/api/oba/ondemand/service/1_a')
		});
		expect(upstream.loadServiceEntry).toHaveBeenCalledWith('1_a', null);
		expect(response.status).toBe(404);
	});
});
