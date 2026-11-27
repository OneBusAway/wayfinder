import { beforeEach, describe, expect, it, vi } from 'vitest';

const retrieve = vi.hoisted(() => vi.fn());

vi.mock('$lib/obaSdk.js', () => ({
	default: { tripDetails: { retrieve } },
	callOBA: async (call: () => Promise<unknown>) => call()
}));

import { GET } from '$src/routes/api/oba/trip-details/[tripId]/+server.js';

const tripDetailsEvent = (tripId: string, search: string) =>
	({
		params: { tripId },
		url: new URL(`http://localhost/api/oba/trip-details/${tripId}${search}`)
	}) as unknown as Parameters<typeof GET>[0];

describe('GET /api/oba/trip-details/[tripId]', () => {
	beforeEach(() => {
		retrieve.mockReset();
		retrieve.mockResolvedValue({ code: 200 });
	});

	it('forwards serviceDate but does not forward time as a trip selector', async () => {
		const response = await GET(tripDetailsEvent('trip-1014', '?serviceDate=0&time=1793081992000'));

		expect(retrieve).toHaveBeenCalledTimes(1);
		expect(retrieve).toHaveBeenCalledWith('trip-1014', {
			includeTrip: 'true',
			includeSchedule: 'true',
			includeStatus: 'true',
			serviceDate: '0'
		});
		expect(response.status).toBe(200);
	});

	it('omits serviceDate when the caller does not select a service day', async () => {
		await GET(tripDetailsEvent('trip-1014', ''));

		expect(retrieve).toHaveBeenCalledWith('trip-1014', {
			includeTrip: 'true',
			includeSchedule: 'true',
			includeStatus: 'true'
		});
	});
});
