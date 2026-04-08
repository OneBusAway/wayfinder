import { describe, it, expect } from 'vitest';
import { groupStopTimesByHour } from '$lib/scheduleUtils.js';

describe('Schedule short-line detection', () => {
	it('should identify short-line trips with different stopHeadsign', () => {
		const mainHeadsign = 'Kearny Mesa';
		const stopTimes = [
			{
				arrivalTime: new Date(2025, 8, 23, 7, 13).getTime(),
				stopHeadsign: 'Kearny Mesa' // Full route
			},
			{
				arrivalTime: new Date(2025, 8, 23, 7, 28).getTime(),
				stopHeadsign: 'Fashion Valley' // Short-line!
			},
			{
				arrivalTime: new Date(2025, 8, 23, 7, 43).getTime(),
				stopHeadsign: 'Kearny Mesa' // Full route
			},
			{
				arrivalTime: new Date(2025, 8, 23, 7, 58).getTime(),
				stopHeadsign: 'Fashion Valley' // Short-line!
			}
		];

		const result = groupStopTimesByHour(stopTimes, mainHeadsign);

		// Check hour 7 has 4 entries
		expect(result[7]).toHaveLength(4);

		// Check first entry (full route)
		expect(result[7][0].isShortLine).toBe(false);
		expect(result[7][0].stopHeadsign).toBe('Kearny Mesa');

		// Check second entry (short-line)
		expect(result[7][1].isShortLine).toBe(true);
		expect(result[7][1].stopHeadsign).toBe('Fashion Valley');

		// Check third entry (full route)
		expect(result[7][2].isShortLine).toBe(false);

		// Check fourth entry (short-line)
		expect(result[7][3].isShortLine).toBe(true);
	});

	it('should not mark trips as short-line when stopHeadsign is missing', () => {
		const mainHeadsign = 'Kearny Mesa';
		const stopTimes = [
			{
				arrivalTime: new Date(2025, 8, 23, 7, 13).getTime(),
				stopHeadsign: undefined
			}
		];

		const result = groupStopTimesByHour(stopTimes, mainHeadsign);

		expect(result[7][0].isShortLine).toBe(false);
	});

	it('should not mark trips as short-line when stopHeadsign matches mainHeadsign', () => {
		const mainHeadsign = 'Downtown Seattle';
		const stopTimes = [
			{
				arrivalTime: new Date(2025, 8, 23, 14, 30).getTime(),
				stopHeadsign: 'Downtown Seattle' // Matches, so not a short-line
			}
		];

		const result = groupStopTimesByHour(stopTimes, mainHeadsign);

		expect(result[14][0].isShortLine).toBe(false);
	});

	it('should organize times by hour correctly', () => {
		const mainHeadsign = 'Kearny Mesa';
		const stopTimes = [
			{
				arrivalTime: new Date(2025, 8, 23, 7, 15).getTime(),
				stopHeadsign: 'Kearny Mesa'
			},
			{
				arrivalTime: new Date(2025, 8, 23, 14, 30).getTime(),
				stopHeadsign: 'Fashion Valley'
			},
			{
				arrivalTime: new Date(2025, 8, 23, 20, 45).getTime(),
				stopHeadsign: 'Kearny Mesa'
			}
		];

		const result = groupStopTimesByHour(stopTimes, mainHeadsign);

		expect(result[7]).toHaveLength(1);
		expect(result[14]).toHaveLength(1);
		expect(result[20]).toHaveLength(1);
		expect(result[14][0].isShortLine).toBe(true);
	});
});
