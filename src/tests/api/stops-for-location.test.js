import { describe, it, expect, vi, beforeEach } from 'vitest';

const listMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/obaSdk', () => ({
	default: { stopsForLocation: { list: listMock } },
	handleOBAResponse: (response) => new Response(JSON.stringify(response))
}));

vi.mock('$lib/agencyFilter.js', () => ({
	getAgencyFilter: () => null,
	filterStops: (stops) => stops
}));

import { GET } from '../../routes/api/oba/stops-for-location/+server.js';

describe('GET /api/oba/stops-for-location', () => {
	beforeEach(() => {
		listMock.mockReset();
		listMock.mockResolvedValue({ code: 200, data: { list: [] } });
	});

	it.each([
		['missing lat', '', 'lng=-122.3', 'lat'],
		['missing lng', 'lat=47.6', '', 'lng'],
		['empty lat', 'lat=', 'lng=-122.3', 'lat'],
		['empty lng', 'lat=47.6', 'lng=', 'lng'],
		['non-numeric lat', 'lat=abc', 'lng=-122.3', 'lat'],
		['whitespace-only lat', 'lat=%20%20', 'lng=-122.3', 'lat'],
		['lat below range', 'lat=-90.1', 'lng=-122.3', 'lat'],
		['lat above range', 'lat=90.1', 'lng=-122.3', 'lat'],
		['lng below range', 'lat=47.6', 'lng=-180.1', 'lng'],
		['lng above range', 'lat=47.6', 'lng=180.1', 'lng']
	])('returns 400 for %s without calling OBA', async (_description, lat, lng, field) => {
		const params = [lat, lng].filter(Boolean).join('&');
		const response = await GET({
			url: new URL(`http://localhost/api/oba/stops-for-location?${params}`)
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toContain(field);
		expect(listMock).not.toHaveBeenCalled();
	});

	it.each([
		['radius', '0'],
		['radius', '-1'],
		['radius', 'NaN'],
		['radius', 'Infinity'],
		['radius', '20001'],
		['radius', '%20%20'],
		['latSpan', '0'],
		['latSpan', '-1'],
		['latSpan', 'NaN'],
		['latSpan', 'Infinity'],
		['lngSpan', '0'],
		['lngSpan', '-1'],
		['lngSpan', 'NaN'],
		['lngSpan', 'Infinity']
	])('returns 400 for invalid %s=%s without calling OBA', async (field, value) => {
		const response = await GET({
			url: new URL(
				`http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&${field}=${value}`
			)
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toContain(field);
		expect(listMock).not.toHaveBeenCalled();
	});

	it('returns 400 for a half-specified span without calling OBA', async () => {
		const response = await GET({
			url: new URL('http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&latSpan=0.02')
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toContain('latSpan');
		expect(body.error).toContain('lngSpan');
		expect(listMock).not.toHaveBeenCalled();
	});

	it('treats empty optional params as absent', async () => {
		const response = await GET({
			url: new URL(
				'http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&radius=&latSpan=&lngSpan='
			)
		});

		expect(response.status).toBe(200);
		expect(listMock).toHaveBeenCalledWith({ lat: 47.6, lon: -122.3 });
	});

	it('rejects a half-specified span when a valid radius is present', async () => {
		const response = await GET({
			url: new URL(
				'http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&radius=1500&latSpan=0'
			)
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('latSpan and lngSpan must both be positive numbers');
		expect(listMock).not.toHaveBeenCalled();
	});

	it('rejects malformed complete spans when a valid radius is present', async () => {
		const response = await GET({
			url: new URL(
				'http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&radius=1500&latSpan=bad&lngSpan=0.05'
			)
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('latSpan and lngSpan must both be positive numbers');
		expect(listMock).not.toHaveBeenCalled();
	});

	it.each([
		[-90, -180],
		[90, 180],
		[0, 0]
	])('accepts valid coordinate boundaries lat=%s lng=%s', async (lat, lng) => {
		const response = await GET({
			url: new URL(`http://localhost/api/oba/stops-for-location?lat=${lat}&lng=${lng}`)
		});

		expect(response.status).toBe(200);
		expect(listMock).toHaveBeenCalledWith({ lat, lon: lng });
	});

	// MapView sends lngSpan; the SDK's parameter is lonSpan, so forwarding the
	// client's name unchanged drops the longitude span silently.
	it('forwards the client lngSpan as the SDK lonSpan', async () => {
		const url = new URL(
			'http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&latSpan=0.02&lngSpan=0.05&radius=1500'
		);

		await GET({ url });

		expect(listMock).toHaveBeenCalledTimes(1);
		expect(listMock).toHaveBeenCalledWith({
			lat: 47.6,
			lon: -122.3,
			latSpan: 0.02,
			lonSpan: 0.05,
			radius: 1500
		});
	});

	it('passes onDemandServiceIds through untouched', async () => {
		listMock.mockResolvedValue({
			code: 200,
			data: { list: [{ id: '1_flex', routeIds: [], onDemandServiceIds: ['1_77652'] }] }
		});
		const url = new URL(
			'http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&latSpan=0.02&lngSpan=0.05'
		);

		const response = await GET({ url });
		const body = await response.json();

		expect(body.data.list[0].onDemandServiceIds).toEqual(['1_77652']);
	});

	it('names lng in the missing-lng error', async () => {
		const response = await GET({
			url: new URL('http://localhost/api/oba/stops-for-location?lat=47.6')
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('lng must be between -180 and 180');
		expect(listMock).not.toHaveBeenCalled();
	});

	it('names lngSpan in a bad-lngSpan error without a radius', async () => {
		const response = await GET({
			url: new URL(
				'http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&latSpan=0.02&lngSpan=bad'
			)
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('latSpan and lngSpan must both be positive numbers');
		expect(listMock).not.toHaveBeenCalled();
	});

	it('rejects ?lat=1&lon=2 with an lng-named error (no lon alias)', async () => {
		const response = await GET({
			url: new URL('http://localhost/api/oba/stops-for-location?lat=1&lon=2')
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('lng must be between -180 and 180');
		expect(listMock).not.toHaveBeenCalled();
	});

	it('does not forward geometryDetail to the SDK', async () => {
		const response = await GET({
			url: new URL(
				'http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&radius=1500&geometryDetail=simplified'
			)
		});

		expect(response.status).toBe(200);
		expect(listMock).toHaveBeenCalledWith({ lat: 47.6, lon: -122.3, radius: 1500 });
	});
	it('ignores unsupported geometryDetail values', async () => {
		const response = await GET({
			url: new URL(
				'http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&radius=1500&geometryDetail=bogus'
			)
		});

		expect(response.status).toBe(200);
		expect(listMock).toHaveBeenCalledWith({
			lat: 47.6,
			lon: -122.3,
			radius: 1500
		});
	});
});
