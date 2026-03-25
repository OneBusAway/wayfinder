import { describe, it, expect } from 'vitest';
import { filterDeparted, makeKey, diffArrivals } from '../arrivalDiffing';

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
	it('returns "tripId_serviceDate" format', () => {
		const result = makeKey({ tripId: '1_100', serviceDate: 1711324800000 });
		expect(result).toBe('1_100_1711324800000');
	});

	it('works with different tripId formats', () => {
		const result = makeKey({ tripId: 'MTA_123', serviceDate: 99 });
		expect(result).toBe('MTA_123_99');
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

	it('uses departure times for stopSequence === 0', () => {
		const arrival = makeArrival({
			stopSequence: 0,
			scheduledArrivalTime: 60000 * 105, // arrival would be in the future
			scheduledDepartureTime: 60000 * 99, // departure is in the past
			predicted: false
		});
		const result = filterDeparted([arrival], now);
		expect(result).toHaveLength(0); // departure time says gone
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
});

describe('diffArrivals', () => {
	const now = 60000 * 100;

	it('tags all arrivals as _isNew when prevArrivals is an empty array', () => {
		const current = [makeArrival({ scheduledArrivalTime: 60000 * 105 })];
		const result = diffArrivals([], current, now);
		expect(result).toHaveLength(1);
		expect(result[0]._isNew).toBe(true);
	});

	it('tags all arrivals as _isNew when prevArrivals is null', () => {
		const current = [makeArrival({ scheduledArrivalTime: 60000 * 105 })];
		const result = diffArrivals(null, current, now);
		expect(result).toHaveLength(1);
		expect(result[0]._isNew).toBe(true);
	});

	it('tags an existing arrival as _isNew = false when it was in previous set', () => {
		const arrivalA = makeArrival({ tripId: '1_tripA', scheduledArrivalTime: 60000 * 105 });
		const result = diffArrivals([arrivalA], [arrivalA], now);
		expect(result).toHaveLength(1);
		expect(result[0]._isNew).toBe(false);
	});

	it('tags genuinely new arrival as _isNew = true while existing stays false', () => {
		const arrivalA = makeArrival({ tripId: '1_tripA', scheduledArrivalTime: 60000 * 105 });
		const arrivalB = makeArrival({ tripId: '1_tripB', scheduledArrivalTime: 60000 * 110 });
		const result = diffArrivals([arrivalA], [arrivalA, arrivalB], now);
		expect(result).toHaveLength(2);
		const taggedA = result.find((r) => r.tripId === '1_tripA');
		const taggedB = result.find((r) => r.tripId === '1_tripB');
		expect(taggedA._isNew).toBe(false);
		expect(taggedB._isNew).toBe(true);
	});

	it('filters departed arrivals before tagging', () => {
		const arrivalA = makeArrival({
			tripId: '1_tripA',
			scheduledArrivalTime: 60000 * 90 // departed
		});
		const arrivalB = makeArrival({
			tripId: '1_tripB',
			scheduledArrivalTime: 60000 * 110 // future
		});
		const result = diffArrivals([arrivalA], [arrivalA, arrivalB], now);
		// A is filtered out (departed), only B remains
		expect(result).toHaveLength(1);
		expect(result[0].tripId).toBe('1_tripB');
		expect(result[0]._isNew).toBe(true);
	});

	it('does not mutate the input arrays', () => {
		const arrivalA = makeArrival({ tripId: '1_tripA', scheduledArrivalTime: 60000 * 105 });
		const arrivalB = makeArrival({ tripId: '1_tripB', scheduledArrivalTime: 60000 * 110 });
		const prev = [arrivalA];
		const current = [arrivalA, arrivalB];
		const prevCopy = [...prev];
		const currentCopy = [...current];

		diffArrivals(prev, current, now);

		// Verify arrays are unchanged
		expect(prev).toEqual(prevCopy);
		expect(current).toEqual(currentCopy);
		// Verify original objects were not mutated
		expect(arrivalA._isNew).toBeUndefined();
		expect(arrivalB._isNew).toBeUndefined();
	});

	it('preserves order of current arrivals after tagging', () => {
		const arrivalA = makeArrival({ tripId: '1_tripA', scheduledArrivalTime: 60000 * 105 });
		const arrivalB = makeArrival({ tripId: '1_tripB', scheduledArrivalTime: 60000 * 110 });
		// Pass B before A
		const result = diffArrivals([], [arrivalB, arrivalA], now);
		expect(result[0].tripId).toBe('1_tripB');
		expect(result[1].tripId).toBe('1_tripA');
	});

	it('returns empty array when current is empty', () => {
		const result = diffArrivals([], [], now);
		expect(result).toEqual([]);
	});
});
