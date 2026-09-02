import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRetrieve = vi.hoisted(() => vi.fn());
const mockScheduleForRouteRetrieve = vi.hoisted(() => vi.fn());
const mockHandleOBAResponse = vi.hoisted(() => vi.fn());
const mockFilterByRouteId = vi.hoisted(() => vi.fn((schedules) => schedules));
const mockGetAgencyFilter = vi.hoisted(() => vi.fn(() => null));

vi.mock('$lib/obaSdk', () => ({
	default: {
		scheduleForStop: { retrieve: mockRetrieve },
		scheduleForRoute: { retrieve: mockScheduleForRouteRetrieve }
	},
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

	it('adds per-trip headsigns from schedule-for-route before returning the stop schedule', async () => {
		const upstreamResponse = {
			data: {
				entry: {
					stopRouteSchedules: [
						{
							routeId: 'MTS_120',
							stopRouteDirectionSchedules: [
								{
									tripHeadsign: 'Kearny Mesa',
									scheduleStopTimes: [
										{ tripId: 'MTS_full', stopHeadsign: '' },
										{ tripId: 'MTS_short', stopHeadsign: '' }
									]
								}
							]
						}
					]
				}
			}
		};
		mockRetrieve.mockResolvedValue(upstreamResponse);
		mockScheduleForRouteRetrieve.mockResolvedValue({
			data: {
				entry: {
					trips: [
						{ id: 'MTS_full', tripHeadsign: 'Kearny Mesa' },
						{ id: 'MTS_short', tripHeadsign: 'Fashion Valley' }
					]
				}
			}
		});

		await GET({
			params: { stopId: '12434' },
			url: new URL('http://localhost/api/oba/schedule-for-stop/12434?date=2026-08-24')
		});

		expect(mockRetrieve).toHaveBeenCalledWith('12434', { date: '2026-08-24' });
		expect(mockFilterByRouteId).toHaveBeenCalledWith(expect.any(Array), null);
		expect(mockScheduleForRouteRetrieve).toHaveBeenCalledWith('MTS_120', {
			date: '2026-08-24'
		});
		expect(
			upstreamResponse.data.entry.stopRouteSchedules[0].stopRouteDirectionSchedules[0]
				.scheduleStopTimes
		).toEqual([
			{ tripId: 'MTS_full', stopHeadsign: '', tripHeadsign: 'Kearny Mesa' },
			{ tripId: 'MTS_short', stopHeadsign: '', tripHeadsign: 'Fashion Valley' }
		]);
		expect(mockHandleOBAResponse).toHaveBeenCalledWith(upstreamResponse, 'stop-for-schedule');
	});

	it('does not fetch a route schedule when a direction has only one trip', async () => {
		mockRetrieve.mockResolvedValue({
			data: {
				entry: {
					stopRouteSchedules: [
						{
							routeId: 'MTS_3',
							stopRouteDirectionSchedules: [{ scheduleStopTimes: [{ tripId: 'MTS_only' }] }]
						}
					]
				}
			}
		});

		await GET({
			params: { stopId: '12434' },
			url: new URL('http://localhost/api/oba/schedule-for-stop/12434')
		});

		expect(mockScheduleForRouteRetrieve).not.toHaveBeenCalled();
	});
});
