import { beforeEach, describe, expect, it, vi } from 'vitest';

const retrieve = vi.hoisted(() => vi.fn());
const handleOBAResponse = vi.hoisted(() =>
	vi.fn((response) => new Response(JSON.stringify(response)))
);

vi.mock('$lib/obaSdk.js', () => ({
	default: { tripDetails: { retrieve } },
	handleOBAResponse
}));

import { GET } from '$src/routes/api/oba/trip-details/[tripId]/+server.js';

describe('GET /api/oba/trip-details/[tripId]', () => {
	beforeEach(() => {
		retrieve.mockReset();
		handleOBAResponse.mockClear();
		retrieve.mockResolvedValue({ code: 200 });
	});

	it('forwards serviceDate but does not forward time as a trip selector', async () => {
		const response = await GET({
			params: { tripId: 'trip-1014' },
			url: new URL(
				'http://localhost/api/oba/trip-details/trip-1014?serviceDate=0&time=1793081992000'
			)
		});

		expect(retrieve).toHaveBeenCalledTimes(1);
		expect(retrieve).toHaveBeenCalledWith('trip-1014', {
			includeTrip: 'true',
			includeSchedule: 'true',
			includeStatus: 'true',
			serviceDate: '0'
		});
		expect(handleOBAResponse).toHaveBeenCalledWith({ code: 200 }, 'trip-details');
		expect(response.status).toBe(200);
	});
});
