import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { groupStopTimesByHour } from '$lib/scheduleForStop.js';

let GET;

function stopResponse(routeId = 'MTS_120', scheduleDate = 1787554800000) {
	return {
		code: 200,
		data: {
			entry: {
				scheduleDate,
				stopRouteSchedules: [
					{
						routeId,
						stopRouteDirectionSchedules: [
							{
								tripHeadsign: 'Kearny Mesa',
								scheduleStopTimes: [
									{
										tripId: 'MTS_full',
										stopHeadsign: '',
										arrivalTime: new Date('2026-08-24T08:05:00').getTime()
									},
									{
										tripId: 'MTS_short',
										stopHeadsign: '',
										arrivalTime: new Date('2026-08-24T08:25:00').getTime()
									}
								]
							}
						]
					}
				]
			},
			references: { trips: [] }
		}
	};
}

// Real OBA envelope: entry contains groupings; per-trip metadata is in references.
function routeResponse() {
	return {
		code: 200,
		data: {
			entry: {
				routeId: 'MTS_120',
				scheduleDate: 1787554800000,
				serviceIds: [],
				stopTripGroupings: []
			},
			references: {
				trips: [
					{ id: 'MTS_full', tripHeadsign: 'Kearny Mesa' },
					{ id: 'MTS_short', tripHeadsign: 'Fashion Valley' }
				]
			}
		}
	};
}

function request(date = '2026-08-24', stopId = 'MTS_12434') {
	return GET({
		params: { stopId },
		url: new URL(
			`http://localhost/api/oba/schedule-for-stop/${stopId}${date ? `?date=${date}` : ''}`
		)
	});
}

describe('GET /api/oba/schedule-for-stop/[stopId]', () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.resetAllMocks();
		({ GET } = await import('../../routes/api/oba/schedule-for-stop/[stopId]/+server.js'));
		mockFilterByRouteId.mockImplementation((schedules) => schedules);
		mockGetAgencyFilter.mockReturnValue(null);
		mockHandleOBAResponse.mockImplementation((response) => response);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('resolves real-envelope trip references through to short-line table data', async () => {
		mockRetrieve.mockResolvedValue(stopResponse());
		mockScheduleForRouteRetrieve.mockResolvedValue(routeResponse());

		const response = await request();
		const direction = response.data.entry.stopRouteSchedules[0].stopRouteDirectionSchedules[0];
		expect(groupStopTimesByHour(direction.scheduleStopTimes, direction.tripHeadsign)[8]).toEqual([
			{ arrivalTime: '8:05 AM', destination: 'Kearny Mesa', isShortLine: false },
			{ arrivalTime: '8:25 AM', destination: 'Fashion Valley', isShortLine: true }
		]);
		expect(mockRetrieve).toHaveBeenCalledWith('MTS_12434', { date: '2026-08-24' });
		expect(mockFilterByRouteId).toHaveBeenCalledWith(expect.any(Array), null);
		expect(mockScheduleForRouteRetrieve).toHaveBeenCalledWith('MTS_120', { date: '2026-08-24' });
		expect(mockHandleOBAResponse).toHaveBeenCalledWith(response, 'stop-for-schedule');
	});

	it('reuses headsigns across stops and when returning to a previously selected date', async () => {
		mockRetrieve.mockImplementation(() => Promise.resolve(stopResponse()));
		mockScheduleForRouteRetrieve.mockResolvedValue(routeResponse());
		await request();
		await request('2026-08-25');
		const response = await request('2026-08-24', 'MTS_other');
		expect(mockScheduleForRouteRetrieve).toHaveBeenCalledTimes(2);
		expect(
			response.data.entry.stopRouteSchedules[0].stopRouteDirectionSchedules[0].scheduleStopTimes[1]
				.tripHeadsign
		).toBe('Fashion Valley');
	});

	it('shares an in-flight route lookup between concurrent stop requests', async () => {
		mockRetrieve.mockImplementation(() => Promise.resolve(stopResponse()));
		let resolveRoute;
		mockScheduleForRouteRetrieve.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveRoute = resolve;
				})
		);
		const requests = [request(), request('2026-08-24', 'MTS_other')];
		await vi.waitFor(() => expect(mockScheduleForRouteRetrieve).toHaveBeenCalledTimes(1));
		resolveRoute(routeResponse());
		const responses = await Promise.all(requests);
		for (const response of responses) {
			expect(
				response.data.entry.stopRouteSchedules[0].stopRouteDirectionSchedules[0]
					.scheduleStopTimes[1].tripHeadsign
			).toBe('Fashion Valley');
		}
	});

	it('separates routes and uses the upstream service day for undated requests', async () => {
		mockScheduleForRouteRetrieve.mockResolvedValue(routeResponse());
		mockRetrieve.mockImplementation(() => Promise.resolve(stopResponse()));
		await request(null);
		await request(null);
		mockRetrieve.mockResolvedValueOnce(stopResponse('MTS_3'));
		await request(null);
		mockRetrieve.mockResolvedValueOnce(stopResponse('MTS_120', 1787641200000));
		await request(null);
		expect(mockScheduleForRouteRetrieve.mock.calls).toEqual([
			['MTS_120', {}],
			['MTS_3', {}],
			['MTS_120', {}]
		]);
	});

	it('does not cache an undated response with no service date', async () => {
		mockRetrieve.mockImplementation(() => Promise.resolve(stopResponse('MTS_120', null)));
		mockScheduleForRouteRetrieve.mockResolvedValue(routeResponse());
		await request(null);
		await request(null);
		expect(mockScheduleForRouteRetrieve).toHaveBeenCalledTimes(2);
	});

	it('refreshes cached headsigns after 24 hours', async () => {
		vi.useFakeTimers();
		mockRetrieve.mockImplementation(() => Promise.resolve(stopResponse()));
		mockScheduleForRouteRetrieve.mockResolvedValue(routeResponse());
		await request();
		vi.advanceTimersByTime(24 * 60 * 60 * 1000);
		await request();
		expect(mockScheduleForRouteRetrieve).toHaveBeenCalledTimes(2);
	});

	it('evicts the least recently used route when the 100-entry bound is reached', async () => {
		mockScheduleForRouteRetrieve.mockResolvedValue(routeResponse());
		for (let index = 0; index < 100; index++) {
			mockRetrieve.mockResolvedValueOnce(stopResponse(`MTS_${index}`));
			await request();
		}
		for (const routeId of ['MTS_0', 'MTS_100', 'MTS_0', 'MTS_1']) {
			mockRetrieve.mockResolvedValueOnce(stopResponse(routeId));
			await request();
		}
		expect(mockScheduleForRouteRetrieve).toHaveBeenCalledTimes(102);
		expect(mockScheduleForRouteRetrieve).toHaveBeenLastCalledWith('MTS_1', { date: '2026-08-24' });
	});

	it.each(['rejected', 'missing references', 'error envelope'])(
		'preserves the stop schedule and retries enrichment after a %s route response',
		async (failure) => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			mockRetrieve.mockImplementation(() => Promise.resolve(stopResponse()));
			if (failure === 'rejected')
				mockScheduleForRouteRetrieve.mockRejectedValueOnce(new Error('unavailable'));
			else
				mockScheduleForRouteRetrieve.mockResolvedValueOnce(
					failure === 'missing references'
						? { code: 200, data: { entry: {} } }
						: { ...routeResponse(), code: 500 }
				);
			mockScheduleForRouteRetrieve.mockResolvedValueOnce(routeResponse());
			const response = await request();
			const direction = response.data.entry.stopRouteSchedules[0].stopRouteDirectionSchedules[0];
			expect(
				groupStopTimesByHour(direction.scheduleStopTimes, direction.tripHeadsign)[8].every(
					(time) => !time.isShortLine
				)
			).toBe(true);
			const retried = await request();
			expect(mockScheduleForRouteRetrieve).toHaveBeenCalledTimes(2);
			expect(
				retried.data.entry.stopRouteSchedules[0].stopRouteDirectionSchedules[0].scheduleStopTimes[1]
					.tripHeadsign
			).toBe('Fashion Valley');
		}
	);

	it('skips malformed nested entries while enriching healthy directions', async () => {
		const response = stopResponse();
		response.data.entry.stopRouteSchedules.push(
			null,
			{ routeId: 'missing' },
			{ routeId: 'invalid', stopRouteDirectionSchedules: {} }
		);
		response.data.entry.stopRouteSchedules[0].stopRouteDirectionSchedules.push(
			null,
			{},
			{ scheduleStopTimes: null },
			{ scheduleStopTimes: {} }
		);
		response.data.entry.stopRouteSchedules[0].stopRouteDirectionSchedules[0].scheduleStopTimes.push(
			null,
			{}
		);
		mockRetrieve.mockResolvedValue(response);
		mockScheduleForRouteRetrieve.mockResolvedValue(routeResponse());
		expect(await request()).toBe(response);
		expect(mockScheduleForRouteRetrieve).toHaveBeenCalledTimes(1);
		expect(
			response.data.entry.stopRouteSchedules[0].stopRouteDirectionSchedules[0].scheduleStopTimes[1]
				.tripHeadsign
		).toBe('Fashion Valley');
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
