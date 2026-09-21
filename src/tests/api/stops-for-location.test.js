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

	// MapView sends lngSpan; the SDK's parameter is lonSpan, so forwarding the
	// client's name unchanged drops the longitude span silently.
	it('forwards the client lngSpan as the SDK lonSpan', async () => {
		const url = new URL(
			'http://localhost/api/oba/stops-for-location?lat=47.6&lng=-122.3&latSpan=0.02&lngSpan=0.05&radius=1500'
		);

		await GET({ url });

		expect(listMock).toHaveBeenCalledTimes(1);
		const params = listMock.mock.calls[0][0];
		expect(params.lonSpan).toBe(0.05);
		expect(params.lngSpan).toBeUndefined();
	});
});
