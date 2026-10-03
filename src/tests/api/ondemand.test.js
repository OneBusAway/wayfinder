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
