import { render, screen, waitFor } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import {
	formatSecondsFromMidnight,
	msToLocalArrivalDepartureTimeString
} from '$lib/dateTimeFormat';

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

function mockTripResponse({
	vehicleId,
	tripId = '1_trip',
	serviceDate = 123,
	activeTripId = tripId,
	closestStop = '1_75403',
	responseStopName = 'Fauntleroy Way SW & SW Myrtle St'
}) {
	return {
		data: {
			entry: {
				tripId,
				serviceDate,
				routeId: '1_100479',
				status: vehicleId ? { vehicleId, activeTripId, closestStop } : null,
				schedule: {
					stopTimes: [{ stopId: '1_75403', arrivalTime: 41400 }]
				}
			},
			references: {
				routes: [{ id: '1_100479', shortName: 'C Line' }],
				stops: [{ id: '1_75403', name: responseStopName }]
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
				tripId: '1_trip',
				serviceDate: 123,
				routeId: '1_100479',
				status: {
					vehicleId: '1_8129001',
					activeTripId: '1_trip',
					closestStop: stopTimes[0].stopId
				},
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
		// 4 stops: vehicle at index 0, rider at the last index, so only 2
		// intermediate stops -- fewer than the tail count of 3, so no marker.
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

	test('formats scheduled service seconds in the browser timezone like epoch arrivals', async () => {
		const serviceDate = Date.UTC(2026, 9, 27, 7);
		const scheduledSeconds = 4 * 60 * 60 + 7 * 60;
		const expectedEpoch = Date.UTC(2026, 9, 27, 11, 7);
		const response = mockTripResponse({ vehicleId: null, serviceDate });
		response.data.entry.schedule = {
			timeZone: 'America/Los_Angeles',
			stopTimes: [{ stopId: stop.id, arrivalTime: scheduledSeconds }]
		};
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => response
			})
		);

		render(TripDetailsPane, { props: { stop, tripId: '1_trip', serviceDate } });

		await waitFor(() => {
			expect(
				screen.getByText(msToLocalArrivalDepartureTimeString(expectedEpoch))
			).toBeInTheDocument();
		});
		expect(screen.queryByText(formatSecondsFromMidnight(scheduledSeconds))).not.toBeInTheDocument();
	});

	test('requests and renders the selected trip instance', async () => {
		const tripId = '1_selected_trip';
		const serviceDate = 1738800000000;
		const responseStopName = 'Selected trip schedule';
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockTripResponse({ vehicleId: null, tripId, serviceDate, responseStopName })
		});
		vi.stubGlobal('fetch', fetchMock);

		render(TripDetailsPane, {
			props: { stop, tripId, serviceDate }
		});

		await waitFor(() => {
			expect(screen.getByText(responseStopName)).toBeInTheDocument();
		});

		const requestUrl = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
		expect(requestUrl.pathname).toBe(`/api/oba/trip-details/${tripId}`);
		expect(requestUrl.searchParams.get('serviceDate')).toBe(String(serviceDate));
		expect(requestUrl.searchParams.has('time')).toBe(false);
		expect(screen.getByText(responseStopName)).toBeInTheDocument();
	});

	test('refreshes live status without pinning requests to a timestamp', async () => {
		const tripId = '1_live_trip';
		const serviceDate = 1738800000000;
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => mockProgressTripResponse('1_start')
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => mockProgressTripResponse('1_middle')
			});
		vi.stubGlobal('fetch', fetchMock);

		render(TripDetailsPane, { props: { stop, tripId, serviceDate } });

		await waitFor(() => {
			expect(screen.getByText('Start Stop')).toBeInTheDocument();
		});

		await vi.advanceTimersByTimeAsync(30000);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(screen.queryByText('Start Stop')).not.toBeInTheDocument();
			expect(screen.getByText('Middle Stop')).toBeInTheDocument();
		});

		for (const [requestUrl] of fetchMock.mock.calls) {
			const url = new URL(requestUrl, 'http://localhost');
			expect(url.pathname).toBe(`/api/oba/trip-details/${tripId}`);
			expect(url.searchParams.get('serviceDate')).toBe(String(serviceDate));
			expect(url.searchParams.has('time')).toBe(false);
		}
	});

	test('includes serviceDate zero and never adds a time parameter', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockTripResponse({ vehicleId: null, serviceDate: 0 })
		});
		vi.stubGlobal('fetch', fetchMock);
		render(TripDetailsPane, { props: { stop, tripId: '1_trip', serviceDate: 0 } });

		await waitFor(() => expect(screen.getByText(stop.name)).toBeInTheDocument());
		const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
		expect(url.searchParams.get('serviceDate')).toBe('0');
		expect(url.searchParams.has('time')).toBe(false);
	});

	test('discards a late response after switching selected trips', async () => {
		let resolveA;
		const responseA = new Promise((resolve) => {
			resolveA = resolve;
		});
		const fetchMock = vi.fn((url) =>
			String(url).includes('/trip-A')
				? responseA
				: Promise.resolve({
						ok: true,
						json: async () =>
							mockTripResponse({
								tripId: 'trip-B',
								serviceDate: 2,
								vehicleId: null,
								responseStopName: 'Trip B schedule'
							})
					})
		);
		vi.stubGlobal('fetch', fetchMock);
		const { rerender } = render(TripDetailsPane, {
			props: { stop, tripId: 'trip-A', serviceDate: 1 }
		});
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		await rerender({ stop, tripId: 'trip-B', serviceDate: 2 });
		await waitFor(() => expect(screen.getByText('Trip B schedule')).toBeInTheDocument());

		resolveA({
			ok: true,
			json: async () =>
				mockTripResponse({
					tripId: 'trip-A',
					serviceDate: 1,
					vehicleId: null,
					responseStopName: 'Late trip A schedule'
				})
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(screen.queryByText('Late trip A schedule')).not.toBeInTheDocument();
		expect(screen.getByText('Trip B schedule')).toBeInTheDocument();
	});

	test('clears the previous trip poll timer when the selected trip changes', async () => {
		const fetchMock = vi.fn((url) => {
			const tripId = new URL(url, 'http://localhost').pathname.endsWith('/trip-A')
				? 'trip-A'
				: 'trip-B';
			return Promise.resolve({
				ok: true,
				json: async () =>
					mockTripResponse({
						tripId,
						serviceDate: tripId === 'trip-A' ? 1 : 2,
						vehicleId: null,
						responseStopName: `${tripId} schedule`
					})
			});
		});
		vi.stubGlobal('fetch', fetchMock);
		const { rerender } = render(TripDetailsPane, {
			props: { stop, tripId: 'trip-A', serviceDate: 1 }
		});
		await waitFor(() => expect(screen.getByText('trip-A schedule')).toBeInTheDocument());

		await rerender({ stop, tripId: 'trip-B', serviceDate: 2 });
		await waitFor(() => expect(screen.getByText('trip-B schedule')).toBeInTheDocument());
		await vi.advanceTimersByTimeAsync(30000);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

		expect(fetchMock.mock.calls.map(([url]) => new URL(url, 'http://localhost').pathname)).toEqual([
			'/api/oba/trip-details/trip-A',
			'/api/oba/trip-details/trip-B',
			'/api/oba/trip-details/trip-B'
		]);
	});

	test('aborts an in-flight request and stops polling on unmount', async () => {
		let signal;
		const fetchMock = vi.fn((_url, options) => {
			signal = options.signal;
			return new Promise(() => {});
		});
		vi.stubGlobal('fetch', fetchMock);
		const { unmount } = render(TripDetailsPane, { props: { stop, tripId: '1_trip' } });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		unmount();
		expect(signal.aborted).toBe(true);
		await vi.advanceTimersByTimeAsync(60000);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test('does not label another active trip live or use its marker position', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () =>
					mockProgressTripResponse('1_middle', {
						activeTripId: 'another_trip',
						vehicleId: '1_8129001'
					})
			})
		);
		render(TripDetailsPane, {
			props: {
				stop,
				tripId: '1_live_trip',
				serviceDate: 1738800000000,
				vehicleId: '1_8129001'
			}
		});

		await waitFor(() => {
			expect(screen.getByText('trip_details.previous_trip')).toBeInTheDocument();
			expect(screen.getByText('Start Stop')).toBeInTheDocument();
		});
		expect(screen.queryByText('trip_details.live_vehicle 1_8129001')).not.toBeInTheDocument();
	});

	test('shows live status only when active trip and selected vehicle match', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () =>
					mockTripResponse({
						tripId: '1_trip',
						serviceDate: 123,
						vehicleId: '1_expected_vehicle'
					})
			})
		);
		render(TripDetailsPane, {
			props: {
				stop,
				tripId: '1_trip',
				serviceDate: 123,
				vehicleId: '1_expected_vehicle'
			}
		});

		await waitFor(() =>
			expect(screen.getByText('trip_details.live_vehicle 1_expected_vehicle')).toBeInTheDocument()
		);
	});

	test('does not show live status when the response vehicle differs from the selected arrival', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () =>
					mockTripResponse({
						tripId: '1_trip',
						serviceDate: 123,
						vehicleId: '1_response_vehicle'
					})
			})
		);
		render(TripDetailsPane, {
			props: {
				stop,
				tripId: '1_trip',
				serviceDate: 123,
				vehicleId: '1_selected_vehicle'
			}
		});

		await waitFor(() => expect(screen.getByText('trip_details.previous_trip')).toBeInTheDocument());
		expect(
			screen.queryByText('trip_details.live_vehicle 1_response_vehicle')
		).not.toBeInTheDocument();
		expect(warn).toHaveBeenCalledWith(
			'Trip details vehicle did not match the selected arrival',
			expect.objectContaining({
				selectedVehicleId: '1_selected_vehicle',
				responseVehicleId: '1_response_vehicle'
			})
		);
	});

	test('rejects an entry that does not match the requested trip identity', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () =>
					mockTripResponse({
						tripId: 'wrong_trip',
						serviceDate: 123,
						vehicleId: null,
						responseStopName: 'Wrong trip schedule'
					})
			})
		);
		render(TripDetailsPane, { props: { stop, tripId: 'expected_trip', serviceDate: 123 } });

		await waitFor(() =>
			expect(
				screen.getByText('Trip details response did not match the selected trip')
			).toBeInTheDocument()
		);
		expect(screen.queryByText('Wrong trip schedule')).not.toBeInTheDocument();
		expect(warn).toHaveBeenCalledWith(
			'Trip details response did not match the selected trip',
			expect.objectContaining({
				selected: { tripId: 'expected_trip', serviceDate: 123 },
				response: { tripId: 'wrong_trip', serviceDate: 123 }
			})
		);
	});

	test('rejects an entry with a different requested serviceDate', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () =>
					mockTripResponse({
						tripId: 'expected_trip',
						serviceDate: 1,
						vehicleId: null,
						responseStopName: 'Wrong service date schedule'
					})
			})
		);
		render(TripDetailsPane, { props: { stop, tripId: 'expected_trip', serviceDate: 0 } });

		await waitFor(() =>
			expect(
				screen.getByText('Trip details response did not match the selected trip')
			).toBeInTheDocument()
		);
		expect(screen.queryByText('Wrong service date schedule')).not.toBeInTheDocument();
	});
});

function mockProgressTripResponse(
	closestStop,
	{ activeTripId = '1_live_trip', vehicleId = '1_8129001' } = {}
) {
	const stopTimes = [
		{ stopId: '1_start', arrivalTime: 41400 },
		{ stopId: '1_middle', arrivalTime: 41460 },
		{ stopId: stop.id, arrivalTime: 41520 }
	];

	return {
		data: {
			entry: {
				tripId: '1_live_trip',
				serviceDate: 1738800000000,
				routeId: '1_100479',
				status: { vehicleId, activeTripId, closestStop },
				schedule: { stopTimes }
			},
			references: {
				routes: [{ id: '1_100479', shortName: 'C Line' }],
				stops: [
					{ id: '1_start', name: 'Start Stop' },
					{ id: '1_middle', name: 'Middle Stop' },
					{ id: stop.id, name: stop.name }
				]
			}
		}
	};
}
