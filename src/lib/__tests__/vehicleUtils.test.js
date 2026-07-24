import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	buildVehiclePopupData,
	clearVehicleMarkersMap,
	fetchVehicles,
	fetchAndUpdateVehicles,
	fetchAndUpdateVehiclesForRoutes
} from '$lib/vehicleUtils.js';

function tripsResponse(routeId, vehicles) {
	return {
		data: {
			references: { trips: vehicles.map((v) => ({ id: v.tripId, routeId })) },
			list: vehicles.map((v) => ({
				status: {
					activeTripId: v.tripId,
					vehicleId: v.vehicleId,
					position: { lat: 47.6, lon: -122.3 },
					predicted: true,
					orientation: 0
				}
			}))
		}
	};
}

describe('buildVehiclePopupData', () => {
	it('returns popup data with stop name when stopsMap has the nextStop', () => {
		const vehicle = {
			vehicleId: 'v-123',
			lastUpdateTime: 1600000000,
			nextStop: 'stop-abc',
			predicted: true
		};
		const activeTrip = {
			tripHeadsign: 'Downtown'
		};
		const stopsMap = new Map();
		stopsMap.set('stop-abc', { name: 'Main St & 1st Ave' });

		const result = buildVehiclePopupData(vehicle, activeTrip, stopsMap);

		expect(result).toEqual({
			nextDestination: 'Downtown',
			vehicleId: 'v-123',
			lastUpdateTime: 1600000000,
			nextStopName: 'Main St & 1st Ave',
			predicted: true
		});
	});

	it('returns popup data with nextStopName as undefined when stopsMap lacks the nextStop', () => {
		const vehicle = {
			vehicleId: 'v-456',
			lastUpdateTime: 1600000100,
			nextStop: 'stop-unknown',
			predicted: false
		};
		const activeTrip = {
			tripHeadsign: 'Uptown'
		};
		const stopsMap = new Map();

		const result = buildVehiclePopupData(vehicle, activeTrip, stopsMap);

		expect(result).toEqual({
			nextDestination: 'Uptown',
			vehicleId: 'v-456',
			lastUpdateTime: 1600000100,
			nextStopName: undefined,
			predicted: false
		});
	});
});

// This suite used to drive the now-deleted single-route `updateVehicleMarkers`
// wrapper directly. That wrapper had zero production callers (SearchPane and
// RouteMap both go through `fetchAndUpdateVehicles`) and only duplicated what
// `fetchAndUpdateVehiclesForRoutes` already does for a single-route array, so
// it was removed. The behavior under test here — highlighting, marker-keying
// by vehicleId, routeColor forwarding — lives in the shared
// `applyRouteVehicles` helper, which the production path also exercises, so
// driving it through `fetchAndUpdateVehiclesForRoutes([{ id: 'route-1' }], ...)`
// preserves the same coverage.
describe('applyRouteVehicles behavior via fetchAndUpdateVehiclesForRoutes (single route)', () => {
	function makeProvider() {
		return {
			addVehicleMarker: vi.fn(() => ({})),
			updateVehicleMarker: vi.fn(),
			removeVehicleMarker: vi.fn()
		};
	}

	function mockFetch(data) {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) });
	}

	async function updateRoute1(provider, { highlightedTripId = null, routeColor } = {}) {
		const intervalId = await fetchAndUpdateVehiclesForRoutes(
			[{ id: 'route-1', type: undefined }],
			provider,
			{
				highlightedTripId,
				colorsByRouteId: routeColor ? new Map([['route-1', { line: routeColor }]]) : new Map()
			}
		);
		clearInterval(intervalId);
	}

	const TWO_VEHICLE_RESPONSE = {
		references: {
			trips: [
				{ id: 'trip-1', routeId: 'route-1' },
				{ id: 'trip-2', routeId: 'route-1' }
			]
		},
		list: [
			{ status: { activeTripId: 'trip-1', status: 'SCHEDULED', orientation: 0 } },
			{ status: { activeTripId: 'trip-2', status: 'SCHEDULED', orientation: 0 } }
		]
	};

	beforeEach(() => clearVehicleMarkersMap());
	afterEach(() => vi.restoreAllMocks());

	// addVehicleMarker(vehicleStatus, activeTrip, routeType, isHighlighted)
	const highlightArg = (call) => call[3];
	const tripOf = (call) => call[1].id;

	describe('highlighting', () => {
		beforeEach(() => {
			mockFetch({
				references: {
					trips: [
						{ id: 'trip-1', routeId: 'route-1' },
						{ id: 'trip-2', routeId: 'route-1' }
					]
				},
				list: [
					{ status: { activeTripId: 'trip-1', status: 'SCHEDULED', orientation: 0 } },
					{ status: { activeTripId: 'trip-2', status: 'SCHEDULED', orientation: 0 } }
				]
			});
		});

		it('marks only the matching trip as highlighted', async () => {
			const provider = makeProvider();

			await updateRoute1(provider, { highlightedTripId: 'trip-1' });

			const calls = provider.addVehicleMarker.mock.calls;
			expect(highlightArg(calls.find((c) => tripOf(c) === 'trip-1'))).toBe(true);
			expect(highlightArg(calls.find((c) => tripOf(c) === 'trip-2'))).toBe(false);
		});

		it('highlights no vehicle when highlightedTripId is null', async () => {
			const provider = makeProvider();

			await updateRoute1(provider, { highlightedTripId: null });

			for (const call of provider.addVehicleMarker.mock.calls) {
				expect(highlightArg(call)).toBe(false);
			}
		});

		it('passes the highlight flag through to updates on subsequent refreshes', async () => {
			const provider = makeProvider();

			await updateRoute1(provider, { highlightedTripId: 'trip-2' });
			await updateRoute1(provider, { highlightedTripId: 'trip-2' });

			const calls = provider.updateVehicleMarker.mock.calls;
			const trip2 = calls.find((c) => c[2].id === 'trip-2');
			const trip1 = calls.find((c) => c[2].id === 'trip-1');
			expect(trip2[4]).toBe(true);
			expect(trip1[4]).toBe(false);
		});
	});

	describe('marker keying', () => {
		it('creates a separate marker per vehicle when two share an activeTripId', async () => {
			mockFetch({
				references: { trips: [{ id: 'trip-1', routeId: 'route-1' }] },
				list: [
					{
						status: {
							activeTripId: 'trip-1',
							status: 'SCHEDULED',
							vehicleId: 'veh-A',
							position: { lat: 47.5233, lon: -122.26822 }
						}
					},
					{
						status: {
							activeTripId: 'trip-1',
							status: 'SCHEDULED',
							vehicleId: 'veh-B',
							position: { lat: 47.5221, lon: -122.26445 }
						}
					}
				]
			});

			const provider = makeProvider();
			await updateRoute1(provider);

			expect(provider.addVehicleMarker).toHaveBeenCalledTimes(2);
			expect(provider.updateVehicleMarker).not.toHaveBeenCalled();
		});

		it('reuses the same marker for a vehicle across refreshes', async () => {
			const list = [
				{
					status: {
						activeTripId: 'trip-1',
						status: 'SCHEDULED',
						vehicleId: 'veh-A',
						position: { lat: 47.5, lon: -122.3 }
					}
				}
			];
			mockFetch({ references: { trips: [{ id: 'trip-1', routeId: 'route-1' }] }, list });

			const provider = makeProvider();
			await updateRoute1(provider);
			await updateRoute1(provider);

			expect(provider.addVehicleMarker).toHaveBeenCalledTimes(1);
			expect(provider.updateVehicleMarker).toHaveBeenCalledTimes(1);
		});

		it('falls back to activeTripId when a status has no vehicleId', async () => {
			mockFetch({
				references: { trips: [{ id: 'trip-1', routeId: 'route-1' }] },
				list: [
					{
						status: {
							activeTripId: 'trip-1',
							status: 'SCHEDULED',
							position: { lat: 47.5, lon: -122.3 }
						}
					}
				]
			});

			const provider = makeProvider();
			await updateRoute1(provider);

			expect(provider.addVehicleMarker).toHaveBeenCalledTimes(1);
		});
	});

	it('forwards routeColor as the 5th arg to addVehicleMarker', async () => {
		mockFetch(TWO_VEHICLE_RESPONSE);
		const provider = makeProvider();

		await updateRoute1(provider, { highlightedTripId: 'trip-1', routeColor: '#0a4ea2' });
		for (const call of provider.addVehicleMarker.mock.calls) {
			expect(call[4]).toBe('#0a4ea2');
		}
	});

	it('forwards routeColor as the 6th arg to updateVehicleMarker', async () => {
		mockFetch(TWO_VEHICLE_RESPONSE);
		// First pass creates markers, second pass updates them.
		const provider = makeProvider();
		await updateRoute1(provider, { highlightedTripId: 'trip-1', routeColor: '#0a4ea2' });
		await updateRoute1(provider, { highlightedTripId: 'trip-1', routeColor: '#0a4ea2' });
		expect(provider.updateVehicleMarker).toHaveBeenCalled();
		for (const call of provider.updateVehicleMarker.mock.calls) {
			expect(call[5]).toBe('#0a4ea2');
		}
	});
});

function makeMultiRouteProvider() {
	return {
		addVehicleMarker: vi.fn((status) => ({ id: status.vehicleId })),
		updateVehicleMarker: vi.fn(),
		removeVehicleMarker: vi.fn()
	};
}

describe('fetchVehicles failure contract', () => {
	test('returns null when the request fails', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
		expect(await fetchVehicles('route_1')).toBeNull();
	});

	test('returns null for a malformed body', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
		expect(await fetchVehicles('route_1')).toBeNull();
	});

	test('returns the data for a well-formed empty response', async () => {
		global.fetch = vi
			.fn()
			.mockResolvedValue({ ok: true, json: async () => tripsResponse('route_1', []) });
		expect(await fetchVehicles('route_1')).toEqual({ references: { trips: [] }, list: [] });
	});
});

describe('fetchAndUpdateVehiclesForRoutes', () => {
	beforeEach(() => {
		clearVehicleMarkersMap();
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	// The old per-route sweep deleted every marker absent from the single polled
	// route's active set, so three concurrent route polls each wiped the other two.
	test('polling three routes keeps all three routes markers', async () => {
		const provider = makeMultiRouteProvider();
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			return {
				ok: true,
				json: async () =>
					tripsResponse(routeId, [{ tripId: `t_${routeId}`, vehicleId: `v_${routeId}` }])
			};
		});

		const intervalId = await fetchAndUpdateVehiclesForRoutes(
			[
				{ id: 'r_a', type: 3 },
				{ id: 'r_b', type: 3 },
				{ id: 'r_c', type: 3 }
			],
			provider
		);
		clearInterval(intervalId);

		expect(provider.addVehicleMarker).toHaveBeenCalledTimes(3);
		expect(provider.removeVehicleMarker).not.toHaveBeenCalled();
	});

	test('removes only the vehicle a route stopped reporting', async () => {
		const provider = makeMultiRouteProvider();
		let secondTick = false;
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			const vehicles =
				routeId === 'r_a' && secondTick
					? []
					: [{ tripId: `t_${routeId}`, vehicleId: `v_${routeId}` }];
			return { ok: true, json: async () => tripsResponse(routeId, vehicles) };
		});

		const routes = [
			{ id: 'r_a', type: 3 },
			{ id: 'r_b', type: 3 }
		];
		const intervalId = await fetchAndUpdateVehiclesForRoutes(routes, provider);
		secondTick = true;
		await vi.advanceTimersByTimeAsync(30000);
		clearInterval(intervalId);

		expect(provider.removeVehicleMarker).toHaveBeenCalledTimes(1);
	});

	// fetchVehicles used to return an empty list for a failed request, which a
	// scoped sweep would read as "this route has no vehicles" and clear them all.
	test('a failed fetch for one route leaves that routes markers alone', async () => {
		const provider = makeMultiRouteProvider();
		let failSecond = false;
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			if (routeId === 'r_a' && failSecond) return { ok: false, status: 503 };
			return {
				ok: true,
				json: async () =>
					tripsResponse(routeId, [{ tripId: `t_${routeId}`, vehicleId: `v_${routeId}` }])
			};
		});

		const intervalId = await fetchAndUpdateVehiclesForRoutes(
			[
				{ id: 'r_a', type: 3 },
				{ id: 'r_b', type: 3 }
			],
			provider
		);
		failSecond = true;
		await vi.advanceTimersByTimeAsync(30000);
		clearInterval(intervalId);

		expect(provider.removeVehicleMarker).not.toHaveBeenCalled();
	});

	test('reports a live vehicle count per route', async () => {
		const provider = makeMultiRouteProvider();
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			const count = routeId === 'r_a' ? 2 : 1;
			const vehicles = Array.from({ length: count }, (_, i) => ({
				tripId: `t_${routeId}_${i}`,
				vehicleId: `v_${routeId}_${i}`
			}));
			return { ok: true, json: async () => tripsResponse(routeId, vehicles) };
		});
		const onCounts = vi.fn();

		const intervalId = await fetchAndUpdateVehiclesForRoutes(
			[
				{ id: 'r_a', type: 3 },
				{ id: 'r_b', type: 3 }
			],
			provider,
			{ onCounts }
		);
		clearInterval(intervalId);

		const counts = onCounts.mock.calls.at(-1)[0];
		expect(counts.get('r_a')).toBe(2);
		expect(counts.get('r_b')).toBe(1);
	});

	// A physical vehicle can move between routes across a shift (e.g. a driver
	// swap). `applyRouteVehicles` re-stamps `existing.routeId` on marker reuse
	// specifically so ownership transfers to whichever route reports the
	// vehicle now.
	//
	// The re-stamp only becomes observable once the *old* owning route later
	// fails to fetch (dropping out of `polledRouteIds` for that tick): if
	// ownership were still (wrongly) attributed to it, the marker would be
	// skipped by the scoped sweep and never cleaned up even though its *new*
	// owner has stopped reporting it. If both routes always fetch
	// successfully, `polledRouteIds` contains both regardless of which one
	// owns the marker, so removal wouldn't depend on the re-stamp at all.
	test('a vehicle that moves to a different route transfers ownership instead of being orphaned', async () => {
		const provider = makeMultiRouteProvider();
		let tick = 1;
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			if (tick === 1) {
				const vehicles = routeId === 'r_a' ? [{ tripId: 't1_a', vehicleId: 'v1' }] : [];
				return { ok: true, json: async () => tripsResponse(routeId, vehicles) };
			}
			if (tick === 2) {
				// v1 now reported by r_b instead of r_a.
				const vehicles = routeId === 'r_b' ? [{ tripId: 't1_b', vehicleId: 'v1' }] : [];
				return { ok: true, json: async () => tripsResponse(routeId, vehicles) };
			}
			// tick 3: r_a (the *old* owner) fails to fetch entirely, and r_b (the
			// new owner) drops v1. If ownership hadn't transferred to r_b, the
			// marker would still be attributed to r_a, which is absent from
			// polledRouteIds this tick, and would incorrectly survive.
			if (routeId === 'r_a') return { ok: false, status: 503 };
			return { ok: true, json: async () => tripsResponse(routeId, []) };
		});

		const routes = [
			{ id: 'r_a', type: 3 },
			{ id: 'r_b', type: 3 }
		];
		const intervalId = await fetchAndUpdateVehiclesForRoutes(routes, provider);

		tick = 2;
		await vi.advanceTimersByTimeAsync(30000);
		expect(provider.removeVehicleMarker).not.toHaveBeenCalled();

		tick = 3;
		await vi.advanceTimersByTimeAsync(30000);
		clearInterval(intervalId);

		expect(provider.removeVehicleMarker).toHaveBeenCalledTimes(1);
	});

	// Only the fetch is isolated per route inside Promise.all. If
	// applyRouteVehicles throws synchronously for one route (e.g. a
	// map-provider bug in addVehicleMarker), that must not skip the routes
	// ordered after it in the forEach, nor abort removeInactiveMarkers/onCounts
	// for the tick.
	test('a route whose applyRouteVehicles throws does not block other routes from updating', async () => {
		const provider = makeMultiRouteProvider();
		provider.addVehicleMarker.mockImplementation((status) => {
			if (status.vehicleId === 'v_r_a') throw new Error('boom');
			return { id: status.vehicleId };
		});
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			return {
				ok: true,
				json: async () =>
					tripsResponse(routeId, [{ tripId: `t_${routeId}`, vehicleId: `v_${routeId}` }])
			};
		});
		const onCounts = vi.fn();

		const intervalId = await fetchAndUpdateVehiclesForRoutes(
			[
				{ id: 'r_a', type: 3 },
				{ id: 'r_b', type: 3 }
			],
			provider,
			{ onCounts }
		);
		clearInterval(intervalId);

		const calledForB = provider.addVehicleMarker.mock.calls.some(
			(call) => call[0].vehicleId === 'v_r_b'
		);
		expect(calledForB).toBe(true);

		const counts = onCounts.mock.calls.at(-1)[0];
		expect(counts.get('r_b')).toBe(1);
	});
});

describe('fetchAndUpdateVehicles (wrapper)', () => {
	beforeEach(() => clearVehicleMarkersMap());
	afterEach(() => vi.restoreAllMocks());

	function makeProvider() {
		return {
			addVehicleMarker: vi.fn(() => ({})),
			updateVehicleMarker: vi.fn(),
			removeVehicleMarker: vi.fn()
		};
	}

	function mockFetch(data) {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) });
	}

	const ONE_VEHICLE_RESPONSE = {
		references: { trips: [{ id: 'trip-1', routeId: 'route-1' }] },
		list: [
			{
				status: {
					activeTripId: 'trip-1',
					status: 'SCHEDULED',
					vehicleId: 'veh-A',
					position: { lat: 47.5, lon: -122.3 }
				}
			}
		]
	};

	// SearchPane calls fetchAndUpdateVehicles(routeId, provider, routeType).
	test('SearchPane call shape forwards routeType to addVehicleMarker', async () => {
		mockFetch(ONE_VEHICLE_RESPONSE);
		const provider = makeProvider();

		const intervalId = await fetchAndUpdateVehicles('route-1', provider, 3);
		clearInterval(intervalId);

		expect(provider.addVehicleMarker).toHaveBeenCalledTimes(1);
		// addVehicleMarker(vehicleStatus, activeTrip, routeType, isHighlighted, routeColor)
		expect(provider.addVehicleMarker.mock.calls[0][2]).toBe(3);
	});

	// RouteMap calls fetchAndUpdateVehicles(routeId, provider, undefined, tripId, routeColor).
	test('RouteMap call shape flags the highlighted trip and forwards the route color', async () => {
		mockFetch(ONE_VEHICLE_RESPONSE);
		const provider = makeProvider();

		const intervalId = await fetchAndUpdateVehicles(
			'route-1',
			provider,
			undefined,
			'trip-1',
			'#0a4ea2'
		);
		clearInterval(intervalId);

		const call = provider.addVehicleMarker.mock.calls[0];
		expect(call[3]).toBe(true);
		expect(call[4]).toBe('#0a4ea2');
	});

	// routeColor === undefined must collapse to an empty color map, matching
	// pre-change behavior: no color forwarded to addVehicleMarker.
	test('an omitted routeColor forwards no color to addVehicleMarker', async () => {
		mockFetch(ONE_VEHICLE_RESPONSE);
		const provider = makeProvider();

		const intervalId = await fetchAndUpdateVehicles('route-1', provider, 3, 'trip-1');
		clearInterval(intervalId);

		expect(provider.addVehicleMarker.mock.calls[0][4]).toBeUndefined();
	});
});
