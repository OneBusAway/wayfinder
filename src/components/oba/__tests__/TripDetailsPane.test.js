import { render, screen, waitFor } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';

// Local i18n mock that interpolates {vehicleId}.
//
// Note: this appends each interpolated value to the key rather than
// substituting it into the key string. The key itself (e.g.
// "trip_details.live_vehicle") never contains a literal "{vehicleId}"
// placeholder to replace -- only a real translation message would -- so a
// mock that tries `key.replace('{vehicleId}', value)` is a no-op and the
// resulting assertion would pass even if the component never passed the
// vehicle id through at all. Appending the value instead means the test can
// only pass if the component actually forwards `values: { vehicleId }` to
// `$_()`.
vi.mock('svelte-i18n', () => ({
	_: {
		subscribe: (fn) => {
			fn((key, options) => {
				let str = key;
				if (options?.values) {
					for (const value of Object.values(options.values)) {
						str = `${str} ${value}`;
					}
				}
				return str;
			});
			return () => {};
		}
	}
}));

import TripDetailsPane from '../TripDetailsPane.svelte';

const stop = { id: '1_75403', name: 'Fauntleroy Way SW & SW Myrtle St' };

function mockTripResponse({ vehicleId }) {
	return {
		data: {
			entry: {
				routeId: '1_100479',
				status: vehicleId ? { vehicleId, closestStop: '1_75403' } : null,
				schedule: {
					stopTimes: [{ stopId: '1_75403', arrivalTime: 41400 }]
				}
			},
			references: {
				routes: [{ id: '1_100479', shortName: 'C Line' }],
				stops: [{ id: '1_75403', name: 'Fauntleroy Way SW & SW Myrtle St' }]
			}
		}
	};
}

// Builds a trip of `stopCount` stops where the vehicle sits at the first stop
// and the rider's stop (`stop.id`) is the last one, so the whole run from the
// vehicle to the rider is visible.
function mockLongTripResponse(stopCount) {
	const stopTimes = Array.from({ length: stopCount }, (_, i) => ({
		stopId: i === stopCount - 1 ? stop.id : `1_stop${i}`,
		arrivalTime: 41400 + i * 60
	}));

	return {
		data: {
			entry: {
				routeId: '1_100479',
				status: { vehicleId: '1_8129001', closestStop: stopTimes[0].stopId },
				schedule: { stopTimes }
			},
			references: {
				routes: [{ id: '1_100479', shortName: 'C Line' }],
				stops: [{ id: stop.id, name: stop.name }]
			}
		}
	};
}

describe('TripDetailsPane', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		// vi.restoreAllMocks() does not revert a direct global assignment, so the
		// fetch stub is registered via vi.stubGlobal and cleared here explicitly.
		vi.unstubAllGlobals();
	});

	test('shows a "Live · vehicle {id}" heading when a vehicle is present', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockTripResponse({ vehicleId: '1_8129001' })
			})
		);

		render(TripDetailsPane, { props: { stop, tripId: '1_trip', serviceDate: 123 } });

		await waitFor(() => {
			expect(screen.getByText('trip_details.live_vehicle 1_8129001')).toBeInTheDocument();
		});
	});

	test('collapses the middle stops into an "N stops" marker on a long trip', async () => {
		// 10 stops, vehicle at index 0, rider at index 9: keep the last 3, collapse 5.
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockLongTripResponse(10)
			})
		);

		render(TripDetailsPane, { props: { stop, tripId: '1_trip' } });

		await waitFor(() => {
			expect(screen.getByText('trip_details.collapsed_stops 5')).toBeInTheDocument();
		});
	});

	test('does not collapse when only a few stops remain to the rider stop', async () => {
		// 4 stops (3 intermediate == tail count) => no collapsed marker.
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockLongTripResponse(4)
			})
		);

		render(TripDetailsPane, { props: { stop, tripId: '1_trip' } });

		await waitFor(() => {
			expect(screen.getByText(stop.name)).toBeInTheDocument();
		});
		expect(screen.queryByText(/trip_details\.collapsed_stops/)).not.toBeInTheDocument();
	});
});
