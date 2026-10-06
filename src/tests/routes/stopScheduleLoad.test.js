import { afterEach, describe, expect, test, vi } from 'vitest';

const getScheduleForStop = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/obaScheduleForStop', () => ({ getScheduleForStop }));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_OBA_TIMEZONE: 'America/Los_Angeles' }
}));

import { load } from '../../routes/stops/[stopID]/schedule/+page.server';

const stop = { id: '1_75403', name: 'Pine St & 3rd Ave' };

function scheduleResponse(stopRouteSchedules = []) {
	return {
		code: 200,
		data: {
			entry: { stopId: stop.id, stopRouteSchedules },
			references: { routes: [{ id: '1_100', shortName: '8' }], stops: [stop] }
		}
	};
}

describe('/stops/[stopID]/schedule load', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.resetAllMocks();
	});

	test("loads today's schedule in the region's timezone", async () => {
		// 8pm on Oct 2 in Los Angeles, when it's already Oct 3 in UTC
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-03T03:00:00Z'));
		getScheduleForStop.mockResolvedValue(scheduleResponse());

		const result = await load({ params: { stopID: stop.id } });

		expect(getScheduleForStop).toHaveBeenCalledWith(stop.id, '2026-10-02');
		expect(result).toEqual({ schedules: [], serviceDay: '2026-10-02', stop, stopId: stop.id });
	});

	test("sends the schedules grouped in the region's timezone, ready to render", async () => {
		getScheduleForStop.mockResolvedValue(
			scheduleResponse([
				{
					routeId: '1_100',
					stopRouteDirectionSchedules: [
						{
							// 8:05am in Los Angeles is 3:05pm UTC, the test runner's timezone.
							scheduleStopTimes: [
								{ arrivalTime: new Date('2026-10-02T15:05:00Z').getTime(), tripId: '1_trip' }
							],
							tripHeadsign: 'Capitol Hill'
						}
					]
				}
			])
		);

		const { schedules } = await load({ params: { stopID: stop.id } });

		expect(schedules).toEqual([
			{
				stopTimes: {
					8: [{ arrivalMinute: 5, destination: 'Capitol Hill', isShortLine: false }]
				},
				tripHeadsign: '8 - Capitol Hill'
			}
		]);
	});

	test('skips malformed entries instead of failing the page', async () => {
		getScheduleForStop.mockResolvedValue(
			scheduleResponse([
				null,
				{ routeId: '1_missing' },
				{ routeId: '1_invalid', stopRouteDirectionSchedules: {} },
				{
					routeId: '1_100',
					stopRouteDirectionSchedules: [
						null,
						{},
						{ scheduleStopTimes: null },
						{
							scheduleStopTimes: [
								null,
								{},
								{ arrivalTime: new Date('2026-10-02T15:05:00Z').getTime(), tripId: '1_trip' }
							],
							tripHeadsign: 'Capitol Hill'
						}
					]
				}
			])
		);

		const { schedules } = await load({ params: { stopID: stop.id } });

		expect(schedules).toEqual([
			{
				stopTimes: {
					8: [{ arrivalMinute: 5, destination: 'Capitol Hill', isShortLine: false }]
				},
				tripHeadsign: '8 - Capitol Hill'
			}
		]);
	});

	test("fails when OBA can't return the schedule", async () => {
		getScheduleForStop.mockResolvedValue({ code: 500 });

		await expect(load({ params: { stopID: stop.id } })).rejects.toMatchObject({ status: 500 });
	});

	test("fails when OBA's references leave out the stop", async () => {
		const response = scheduleResponse();
		response.data.references.stops = [];
		getScheduleForStop.mockResolvedValue(response);

		await expect(load({ params: { stopID: stop.id } })).rejects.toMatchObject({ status: 500 });
	});

	test.each([
		['an empty response', null],
		['code 404', { code: 404 }]
	])('is not found when OBA answers for the stop with %s', async (_, response) => {
		getScheduleForStop.mockResolvedValue(response);

		await expect(load({ params: { stopID: '1_99999999' } })).rejects.toMatchObject({
			status: 404
		});
	});
});
