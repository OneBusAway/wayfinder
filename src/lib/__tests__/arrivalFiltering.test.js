import { describe, it, expect } from 'vitest';
import { filterDeparted, makeKey } from '../arrivalFiltering';

// Factory function for creating test arrival objects
function makeArrival({
	tripId = '1_trip1',
	serviceDate = 1711324800000,
	scheduledArrivalTime,
	predictedArrivalTime = 0,
	predicted = false,
	scheduledDepartureTime = null,
	predictedDepartureTime = 0,
	stopSequence = 1,
	...rest
} = {}) {
	return {
		tripId,
		serviceDate,
		scheduledArrivalTime,
		predictedArrivalTime,
		predicted,
		scheduledDepartureTime: scheduledDepartureTime ?? scheduledArrivalTime,
		predictedDepartureTime,
		stopSequence,
		...rest
	};
}

describe('makeKey', () => {
	it('returns "tripId_serviceDate_stopSequence" format', () => {
		const result = makeKey({ tripId: '1_100', serviceDate: 1711324800000, stopSequence: 3 });
		expect(result).toBe('1_100_1711324800000_3');
	});

	it('works with different tripId formats', () => {
		const result = makeKey({ tripId: 'MTA_123', serviceDate: 99, stopSequence: 1 });
		expect(result).toBe('MTA_123_99_1');
	});

	it('distinguishes two visits of the same trip at the same stop', () => {
		const first = makeKey({ tripId: '1_100', serviceDate: 1711324800000, stopSequence: 4 });
		const second = makeKey({ tripId: '1_100', serviceDate: 1711324800000, stopSequence: 18 });
		expect(first).not.toBe(second);
		expect(first).toBe('1_100_1711324800000_4');
		expect(second).toBe('1_100_1711324800000_18');
	});
});

describe('filterDeparted', () => {
	// Fixed "now" value: minute 100 in ms (100 * 60000 = 6000000)
	const now = 60000 * 100;

	it('keeps arrivals with positive ETA (arrival in the future)', () => {
		const arrival = makeArrival({ scheduledArrivalTime: 60000 * 105, predicted: false });
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(arrival);
	});

	it('keeps arrivals at ETA === 0 (arriving now)', () => {
		const arrival = makeArrival({ scheduledArrivalTime: 60000 * 100, predicted: false });
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(1);
	});

	it('removes arrivals with negative ETA (already departed)', () => {
		const arrival = makeArrival({ scheduledArrivalTime: 60000 * 99, predicted: false });
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(0);
	});

	it('uses predictedArrivalTime when predicted is true and > 0 (overrides schedule)', () => {
		// predicted ETA is in the past (departed), schedule would be in the future
		const arrival = makeArrival({
			predictedArrivalTime: 60000 * 95,
			scheduledArrivalTime: 60000 * 105,
			predicted: true
		});
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(0); // prediction says departed, so removed
	});

	it('falls back to scheduledArrivalTime when predicted is false', () => {
		// same times as above test, but predicted=false — schedule says future
		const arrival = makeArrival({
			predictedArrivalTime: 60000 * 95,
			scheduledArrivalTime: 60000 * 105,
			predicted: false
		});
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(1); // schedule says future, so kept
	});

	it('uses arrival times for stopSequence === 0 to match ArrivalDeparture rendering', () => {
		// First-stop layover: arrival already happened, departure is still future.
		// ArrivalDeparture coerces stopSequence 0 → 1 and shows arrival ETA, so
		// the filter must drop this row or it stays as "arrived N min ago".
		const arrival = makeArrival({
			stopSequence: 0,
			scheduledArrivalTime: 60000 * 95,
			scheduledDepartureTime: 60000 * 105,
			predicted: false
		});
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(0);
	});

	it('keeps a first-stop row when arrival time is still in the future', () => {
		const arrival = makeArrival({
			stopSequence: 0,
			scheduledArrivalTime: 60000 * 105,
			scheduledDepartureTime: 60000 * 110,
			predicted: false
		});
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(1);
	});

	it('returns empty array for empty input', () => {
		expect(filterDeparted([], now)).toEqual([]);
	});

	it('returns empty array when all arrivals have departed', () => {
		const arrivals = [
			makeArrival({ scheduledArrivalTime: 60000 * 90, predicted: false }),
			makeArrival({ tripId: '1_trip2', scheduledArrivalTime: 60000 * 95, predicted: false })
		];
		const result = filterDeparted(arrivals, now);
		expect(result).toHaveLength(0);
	});

	it('falls back to scheduledArrivalTime when predicted is true but predictedArrivalTime is 0', () => {
		// OBA API uses 0 as sentinel for "no prediction available"
		const arrival = makeArrival({
			predictedArrivalTime: 0,
			scheduledArrivalTime: 60000 * 105,
			predicted: true
		});
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(1); // scheduled time is in the future, so kept
	});

	it('uses predictedArrivalTime for stopSequence === 0 when predicted is true', () => {
		const arrival = makeArrival({
			stopSequence: 0,
			scheduledArrivalTime: 60000 * 105,
			predictedArrivalTime: 60000 * 95,
			scheduledDepartureTime: 60000 * 110,
			predictedDepartureTime: 60000 * 112,
			predicted: true
		});
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(0);
	});

	it('falls back to scheduledArrivalTime for stopSequence === 0 when predictedArrivalTime is 0', () => {
		const arrival = makeArrival({
			stopSequence: 0,
			scheduledArrivalTime: 60000 * 105,
			predictedArrivalTime: 0,
			scheduledDepartureTime: 60000 * 110,
			predictedDepartureTime: 0,
			predicted: true
		});
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(1);
	});
});
