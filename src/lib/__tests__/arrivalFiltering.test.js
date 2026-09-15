import { describe, it, expect } from 'vitest';
import { collapseLayovers, filterDeparted, makeKey, visibleArrivals } from '../arrivalFiltering';

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

describe('collapseLayovers', () => {
	// A vehicle finishing trip N at this stop (its final stop) and then starting
	// trip N+1 here (first stop) produces two rows for one physical bus sitting
	// at the curb. Modeled on King County Metro route 10 at stop 1_11370.
	const serviceDate = 1789369200000;
	const t = (mins) => serviceDate + mins * 60000;

	function makeLayoverPair({ arrivalOverrides = {}, departureOverrides = {} } = {}) {
		const arrival = makeArrival({
			tripId: '1_846336761',
			serviceDate,
			vehicleId: '1_4391',
			stopSequence: 20,
			totalStopsInTrip: 21,
			blockTripSequence: 5,
			scheduledArrivalTime: t(1178),
			...arrivalOverrides
		});
		const departure = makeArrival({
			tripId: '1_846336651',
			serviceDate,
			vehicleId: '1_4391',
			stopSequence: 0,
			totalStopsInTrip: 13,
			blockTripSequence: 6,
			scheduledArrivalTime: t(1196),
			...departureOverrides
		});
		return { arrival, departure };
	}

	it('drops the final-stop arrival when the same vehicle departs on the next block trip', () => {
		const { arrival, departure } = makeLayoverPair();
		const result = collapseLayovers([arrival, departure]);
		expect(result).toEqual([departure]);
	});

	it('keeps both rows when the departure is not the next trip in the block (short route, wide window)', () => {
		// The vehicle already left on trip 6 and is back at this stop later on
		// trip 7 -- the arrival at trip 5's end and trip 7's departure are
		// unrelated visits and must both stay.
		const { arrival, departure } = makeLayoverPair({
			departureOverrides: {
				blockTripSequence: 7,
				tripId: '1_846336999',
				scheduledArrivalTime: t(1256)
			}
		});
		const result = collapseLayovers([arrival, departure]);
		expect(result).toEqual([arrival, departure]);
	});

	it('keeps both rows when the trips are served by different vehicles', () => {
		const { arrival, departure } = makeLayoverPair({
			departureOverrides: { vehicleId: '1_8222301' }
		});
		const result = collapseLayovers([arrival, departure]);
		expect(result).toEqual([arrival, departure]);
	});

	it('keeps an arrival that is not at the final stop of its trip', () => {
		// A mid-route through-stop is not a layover even if the block's next
		// trip happens to start here as well.
		const { arrival, departure } = makeLayoverPair({
			arrivalOverrides: { stopSequence: 12 }
		});
		const result = collapseLayovers([arrival, departure]);
		expect(result).toEqual([arrival, departure]);
	});

	it('keeps both rows when neither has a vehicle assigned', () => {
		for (const vehicleId of ['', null, undefined]) {
			const { arrival, departure } = makeLayoverPair({
				arrivalOverrides: { vehicleId },
				departureOverrides: { vehicleId }
			});
			expect(collapseLayovers([arrival, departure])).toEqual([arrival, departure]);
		}
	});

	it('keeps both rows when the trips belong to different service dates', () => {
		const { arrival, departure } = makeLayoverPair({
			departureOverrides: { serviceDate: serviceDate + 86400000 }
		});
		const result = collapseLayovers([arrival, departure]);
		expect(result).toEqual([arrival, departure]);
	});

	it('collapses each adjoining pair when a vehicle lays over here twice in the window', () => {
		const first = makeLayoverPair();
		const second = makeLayoverPair({
			arrivalOverrides: {
				tripId: '1_846336641',
				blockTripSequence: 7,
				scheduledArrivalTime: t(1238)
			},
			departureOverrides: {
				tripId: '1_846336631',
				blockTripSequence: 8,
				scheduledArrivalTime: t(1256)
			}
		});
		const result = collapseLayovers([
			first.arrival,
			first.departure,
			second.arrival,
			second.departure
		]);
		expect(result).toEqual([first.departure, second.departure]);
	});

	it('leaves unrelated arrivals untouched and preserves order', () => {
		const { arrival, departure } = makeLayoverPair();
		const other = makeArrival({
			tripId: '1_other',
			serviceDate,
			vehicleId: '1_9999',
			stopSequence: 4,
			totalStopsInTrip: 30,
			blockTripSequence: 2,
			scheduledArrivalTime: t(1180)
		});
		const result = collapseLayovers([other, arrival, departure]);
		expect(result).toEqual([other, departure]);
	});

	it('returns an empty array for null or empty input', () => {
		expect(collapseLayovers(null)).toEqual([]);
		expect(collapseLayovers(undefined)).toEqual([]);
		expect(collapseLayovers([])).toEqual([]);
	});
});

describe('visibleArrivals', () => {
	const serviceDate = 1789369200000;
	const t = (mins) => serviceDate + mins * 60000;

	it('drops departed rows and then collapses layover pairs', () => {
		const departed = makeArrival({ tripId: '1_gone', serviceDate, scheduledArrivalTime: t(1170) });
		const arrival = makeArrival({
			tripId: '1_a',
			serviceDate,
			vehicleId: '1_4391',
			stopSequence: 20,
			totalStopsInTrip: 21,
			blockTripSequence: 5,
			scheduledArrivalTime: t(1178)
		});
		const departure = makeArrival({
			tripId: '1_b',
			serviceDate,
			vehicleId: '1_4391',
			stopSequence: 0,
			totalStopsInTrip: 13,
			blockTripSequence: 6,
			scheduledArrivalTime: t(1196)
		});
		expect(visibleArrivals([departed, arrival, departure], t(1175))).toEqual([departure]);
	});

	it('returns an empty array for null input', () => {
		expect(visibleArrivals(null, 0)).toEqual([]);
	});
});
