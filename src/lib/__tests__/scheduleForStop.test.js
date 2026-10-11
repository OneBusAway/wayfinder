import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	dateToServiceDay,
	fetchScheduleForStop,
	groupStopTimesByHour,
	serviceDayToDate
} from '$lib/scheduleForStop';

describe('fetchScheduleForStop', () => {
	it('requests the service day from the API route and returns its data', async () => {
		const data = { entry: { stopId: 'MTA NYCT_1/2' } };
		const fetch = vi.fn().mockResolvedValue({ json: async () => ({ data }), ok: true });
		const { signal } = new AbortController();

		const result = await fetchScheduleForStop(fetch, 'MTA NYCT_1/2', '2026-10-05', { signal });

		expect(fetch).toHaveBeenCalledWith(
			'/api/oba/schedule-for-stop/MTA%20NYCT_1%2F2?date=2026-10-05',
			{ signal }
		);
		expect(result).toBe(data);
	});

	it("throws an error carrying the API's status when the request fails", async () => {
		const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

		await expect(fetchScheduleForStop(fetch, '1_75403', '2026-10-05')).rejects.toMatchObject({
			status: 503
		});
	});
});

describe('service day conversions', () => {
	const originalTimeZone = process.env.TZ;

	afterEach(() => {
		process.env.TZ = originalTimeZone;
	});

	it('keeps the calendar day in timezones east of UTC', () => {
		// Local midnight in Berlin is still the previous day in UTC, so
		// `toISOString()` would give 2026-10-04.
		process.env.TZ = 'Europe/Berlin';

		const date = serviceDayToDate('2026-10-05');

		expect(date.toISOString()).toBe('2026-10-04T22:00:00.000Z');
		expect(dateToServiceDay(date)).toBe('2026-10-05');
	});

	it('uses the local day of a time late in the evening west of UTC', () => {
		// 8pm on Oct 2 in Los Angeles is already Oct 3 in UTC.
		process.env.TZ = 'America/Los_Angeles';

		expect(dateToServiceDay(new Date('2026-10-03T03:00:00Z'))).toBe('2026-10-02');
	});
});

describe('groupStopTimesByHour', () => {
	it('uses the per-trip headsign when schedule-for-stop omits stopHeadsign', () => {
		const grouped = groupStopTimesByHour(
			[
				{
					arrivalTime: new Date('2026-08-24T08:05:00').getTime(),
					stopHeadsign: '',
					tripHeadsign: 'Kearny Mesa'
				},
				{
					arrivalTime: new Date('2026-08-24T08:25:00').getTime(),
					stopHeadsign: '',
					tripHeadsign: 'Fashion Valley'
				}
			],
			'Kearny Mesa'
		);

		expect(grouped[8]).toEqual([
			{ arrivalMinute: 5, destination: 'Kearny Mesa', isShortLine: false },
			{ arrivalMinute: 25, destination: 'Fashion Valley', isShortLine: true }
		]);
	});

	it('does not mark a trip as short when its per-trip headsign matches the direction', () => {
		const grouped = groupStopTimesByHour(
			[
				{
					arrivalTime: new Date('2026-08-24T08:05:00').getTime(),
					tripHeadsign: 'Kearny Mesa'
				}
			],
			'Kearny Mesa'
		);

		expect(grouped[8][0]).toMatchObject({ isShortLine: false, destination: 'Kearny Mesa' });
	});

	it('skips stop times without a valid arrival time', () => {
		const grouped = groupStopTimesByHour(
			[
				null,
				{},
				{ arrivalTime: NaN },
				{ arrivalTime: new Date('2026-08-24T08:05:00').getTime(), tripHeadsign: 'Kearny Mesa' }
			],
			'Kearny Mesa'
		);

		expect(grouped).toEqual({
			8: [{ arrivalMinute: 5, destination: 'Kearny Mesa', isShortLine: false }]
		});
	});

	it("groups and shows times in the given timezone, not the runtime's", () => {
		// 8:05am in Los Angeles is 3:05pm UTC, the test runner's timezone.
		const grouped = groupStopTimesByHour(
			[{ arrivalTime: new Date('2026-08-24T15:05:00Z').getTime(), tripHeadsign: 'Kearny Mesa' }],
			'Kearny Mesa',
			'America/Los_Angeles'
		);

		expect(grouped).toEqual({
			8: [{ arrivalMinute: 5, destination: 'Kearny Mesa', isShortLine: false }]
		});
	});
});
