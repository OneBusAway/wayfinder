import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRetrieve = vi.hoisted(() => vi.fn());
const mockHandleOBAResponse = vi.hoisted(() => vi.fn());
const mockFilterByRouteId = vi.hoisted(() => vi.fn((schedules) => schedules));
const mockGetAgencyFilter = vi.hoisted(() => vi.fn(() => null));

vi.mock('$lib/obaSdk', () => ({
	default: { scheduleForStop: { retrieve: mockRetrieve } },
	handleOBAResponse: mockHandleOBAResponse
}));

vi.mock('$lib/agencyFilter.js', () => ({
	filterByRouteId: mockFilterByRouteId,
	getAgencyFilter: mockGetAgencyFilter
}));

const { GET } = await import('../../routes/api/oba/schedule-for-stop/[stopId]/+server.js');

describe('GET /api/oba/schedule-for-stop/[stopId]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockHandleOBAResponse.mockImplementation((response) => response);
	});

	it('passes an unavailable upstream response to the shared error handler', async () => {
		mockRetrieve.mockResolvedValue(null);

		const response = await GET({
			params: { stopId: '12434' },
			url: new URL('http://localhost/api/oba/schedule-for-stop/12434?date=2026-08-24')
		});

		expect(mockHandleOBAResponse).toHaveBeenCalledWith(null, 'stop-for-schedule');
		expect(mockFilterByRouteId).not.toHaveBeenCalled();
		expect(response).toBeNull();
	});

	it('filters a valid schedule response before returning it', async () => {
		const upstreamResponse = {
			data: { entry: { stopRouteSchedules: [{ routeId: '11_120' }] } }
		};
		mockRetrieve.mockResolvedValue(upstreamResponse);

		await GET({
			params: { stopId: '12434' },
			url: new URL('http://localhost/api/oba/schedule-for-stop/12434')
		});

		expect(mockRetrieve).toHaveBeenCalledWith('12434', {});
		expect(mockFilterByRouteId).toHaveBeenCalledWith(
			upstreamResponse.data.entry.stopRouteSchedules,
			null
		);
		expect(mockHandleOBAResponse).toHaveBeenCalledWith(upstreamResponse, 'stop-for-schedule');
	});
});
