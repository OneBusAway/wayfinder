import { describe, expect, it } from 'vitest';
import { groupStopTimesByHour } from '$lib/scheduleForStop.js';

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
			{ arrivalTime: '8:05 AM', destination: 'Kearny Mesa', isShortLine: false },
			{ arrivalTime: '8:25 AM', destination: 'Fashion Valley', isShortLine: true }
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
});
