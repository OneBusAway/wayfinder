import { render } from '@testing-library/svelte';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import StopRoutesLayer from '../StopRoutesLayer.svelte';
import { ROUTE_PANE } from '$lib/mapPanes.js';

vi.mock('$lib/vehicleUtils.js', () => ({
	fetchAndUpdateVehiclesForRoutes: vi.fn().mockResolvedValue({ intervalId: 42, tick: vi.fn() }),
	clearVehicleMarkersMap: vi.fn()
}));
import { fetchAndUpdateVehiclesForRoutes, clearVehicleMarkersMap } from '$lib/vehicleUtils.js';
import { createLayerBindings } from './support/layerBindings.svelte.js';

function makeProvider() {
	return {
		createPolyline: vi.fn(async () => ({ id: 'polyline' })),
		revealPolylines: vi.fn(),
		clearAllPolylines: vi.fn(),
		clearVehicleMarkers: vi.fn(),
		removePolyline: vi.fn(),
		setPolylineLayer: vi.fn()
	};
}

// Give a microtask-flushing macrotask a chance to run: e.g. so a resolved
// mock promise's .then() continuation (which sets vehicleIntervalId, or a
// guarded redraw's early return) has actually executed before we assert on
// its effects.
function flush(ms = 0) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const routes = [
	{ id: 'r_c', shortName: 'C Line', type: 3, tripId: 't_c', gtfsColor: 'b02a37' },
	{ id: 'r_22', shortName: '22', type: 3, tripId: 't_22', gtfsColor: 'e0a021' }
];
const colors = new Map([
	['r_c', { line: '#b02a37', badgeBg: 'b02a37', badgeFg: 'ffffff' }],
	['r_22', { line: '#e0a021', badgeBg: 'e0a021', badgeFg: '000000' }]
]);

function mockShapeFetches({ failRouteId = null } = {}) {
	global.fetch = vi.fn(async (url) => {
		if (url.includes('/trip-details/')) {
			const tripId = url.split('/trip-details/')[1].split('?')[0];
			if (failRouteId && tripId === `t_${failRouteId.replace('r_', '')}`) {
				return { ok: false, status: 500 };
			}
			return {
				ok: true,
				json: async () => ({
					data: {
						entry: { schedule: { stopTimes: [{ stopId: `stop_${tripId}` }] } },
						references: { trips: [{ id: tripId, shapeId: `shape_${tripId}` }] }
					}
				})
			};
		}
		return { ok: true, json: async () => ({ data: { entry: { points: 'encoded' } } }) };
	});
}

describe('StopRoutesLayer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockShapeFetches();
	});

	test('draws one polyline per active route, in its resolved color', async () => {
		const mapProvider = makeProvider();
		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		const usedColors = mapProvider.createPolyline.mock.calls.map(([, options]) => options.color);
		expect(usedColors).toEqual(expect.arrayContaining(['#b02a37', '#e0a021']));
	});

	test('requests casings and skips the status payload it does not need', async () => {
		const mapProvider = makeProvider();
		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalled());
		expect(mapProvider.createPolyline.mock.calls[0][1].casing).toBe(true);
		const tripDetailsUrl = global.fetch.mock.calls
			.map(([url]) => url)
			.find((u) => u.includes('/trip-details/'));
		expect(tripDetailsUrl).toContain('includeStatus=false');
	});

	// $bindable writes land on the parent's reactive state, and $state is a runes
	// macro that only compiles in a .svelte/.svelte.js module — so a plain
	// .test.js can't create the proxy to read back. Use a support harness, the
	// same pattern as the existing support/reactiveStop.svelte.js.
	test('reports the ring-dot stops from the drawn trips, with a shared stop won by the lower-index (sooner-arriving) route', async () => {
		const bindings = createLayerBindings();
		const mapProvider = makeProvider();

		// r_c is index 0 (soonest arrival, top priority) but its trip-details
		// response is delayed so it resolves *after* r_22 (index 1) — proving a
		// shared stop is claimed by index priority, not by whichever shape
		// happens to resolve first over the network.
		global.fetch = vi.fn(async (url) => {
			if (url.includes('/trip-details/t_c')) {
				await flush(20);
				return {
					ok: true,
					json: async () => ({
						data: {
							entry: {
								schedule: { stopTimes: [{ stopId: 'shared_stop' }, { stopId: 'stop_c_only' }] }
							},
							references: { trips: [{ id: 't_c', shapeId: 'shape_t_c' }] }
						}
					})
				};
			}
			if (url.includes('/trip-details/t_22')) {
				return {
					ok: true,
					json: async () => ({
						data: {
							entry: {
								schedule: { stopTimes: [{ stopId: 'shared_stop' }, { stopId: 'stop_22_only' }] }
							},
							references: { trips: [{ id: 't_22', shapeId: 'shape_t_22' }] }
						}
					})
				};
			}
			return { ok: true, json: async () => ({ data: { entry: { points: 'encoded' } } }) };
		});

		render(StopRoutesLayer, {
			props: {
				mapProvider,
				activeRoutes: routes,
				routeColors: colors,
				get routeStopIds() {
					return bindings.routeStopIds;
				},
				set routeStopIds(value) {
					bindings.routeStopIds = value;
				}
			}
		});

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		expect(bindings.routeStopIds.get('shared_stop')).toBe('#b02a37');
		expect(bindings.routeStopIds.get('stop_c_only')).toBe('#b02a37');
		expect(bindings.routeStopIds.get('stop_22_only')).toBe('#e0a021');
	});

	test('restores paint order to index priority after every resolution, regardless of arrival order', async () => {
		const callOrder = [];
		const polyC = { id: 'poly_c', bringToFront: vi.fn(() => callOrder.push('poly_c')) };
		const poly22 = { id: 'poly_22', bringToFront: vi.fn(() => callOrder.push('poly_22')) };

		// r_22 (index 1, narrower) resolves first; r_c (index 0, wider) resolves
		// later. If paint order just followed resolution order, the wider route
		// would end up on top last and cover the narrower one entirely.
		global.fetch = vi.fn(async (url) => {
			if (url.includes('/trip-details/t_c')) {
				await flush(20);
				return {
					ok: true,
					json: async () => ({
						data: {
							entry: { schedule: { stopTimes: [] } },
							references: { trips: [{ id: 't_c', shapeId: 'shape_t_c' }] }
						}
					})
				};
			}
			if (url.includes('/trip-details/t_22')) {
				return {
					ok: true,
					json: async () => ({
						data: {
							entry: { schedule: { stopTimes: [] } },
							references: { trips: [{ id: 't_22', shapeId: 'shape_t_22' }] }
						}
					})
				};
			}
			return { ok: true, json: async () => ({ data: { entry: { points: 'encoded' } } }) };
		});

		const mapProvider = {
			createPolyline: vi.fn(async (points, options) =>
				options.color === '#b02a37' ? polyC : poly22
			),
			revealPolylines: vi.fn(),
			clearAllPolylines: vi.fn(),
			clearVehicleMarkers: vi.fn(),
			removePolyline: vi.fn()
		};

		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		// The narrower route (higher index) must be the last one brought to
		// front, so it ends up frontmost regardless of arrival order.
		expect(callOrder[callOrder.length - 1]).toBe('poly_22');
	});

	test('drops a route whose shape fetch fails without losing the others', async () => {
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockShapeFetches({ failRouteId: 'r_22' });
		const mapProvider = makeProvider();
		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1));
		expect(mapProvider.createPolyline.mock.calls[0][1].color).toBe('#b02a37');

		// Prove the second route actually failed rather than just being slow:
		// give its (already-settled) rejected fetch time to reach drawRoutes,
		// then assert createPolyline never gets a second call and the failure
		// was logged for the right route.
		await flush(20);
		expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'StopRoutesLayer: could not load shape',
			'r_22',
			expect.any(Error)
		);

		consoleErrorSpy.mockRestore();
	});

	test('starts one vehicle poll for all routes', async () => {
		const mapProvider = makeProvider();
		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalledTimes(1));
		expect(fetchAndUpdateVehiclesForRoutes.mock.calls[0][0]).toHaveLength(2);
	});

	test('tears down polylines, vehicles, and the interval on destroy', async () => {
		const mapProvider = makeProvider();
		const { unmount } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: routes, routeColors: colors }
		});
		await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalled());
		// Flush the resolved fetchAndUpdateVehiclesForRoutes promise so
		// vehicleIntervalId is actually assigned before we unmount and assert
		// clearInterval ran on it — not just that the interval was requested.
		await flush();

		const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
		unmount();

		expect(mapProvider.clearAllPolylines).toHaveBeenCalled();
		expect(mapProvider.clearVehicleMarkers).toHaveBeenCalled();
		expect(clearVehicleMarkersMap).toHaveBeenCalled();
		expect(clearIntervalSpy).toHaveBeenCalledWith(42);
		clearIntervalSpy.mockRestore();
	});

	// Finding 1 (CRITICAL): StopPane polls arrivals every 30s, and
	// MapExperience's $derived recomputes activeRoutes/routeColors from
	// scratch every poll, handing this layer a fresh array/Map with identical
	// content. Keying the redraw on identity tore everything down and redrew
	// it on every poll.
	test('does not redraw when activeRoutes/routeColors are new but structurally identical', async () => {
		const mapProvider = makeProvider();
		const { rerender } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: routes, routeColors: colors }
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		const fetchCallsAfterFirstDraw = global.fetch.mock.calls.length;
		const clearCallsAfterFirstDraw = mapProvider.clearAllPolylines.mock.calls.length;

		const sameRoutes = routes.map((route) => ({ ...route }));
		const sameColors = new Map(Array.from(colors, ([id, value]) => [id, { ...value }]));
		await rerender({ mapProvider, activeRoutes: sameRoutes, routeColors: sameColors });
		await flush();

		expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2);
		expect(global.fetch.mock.calls.length).toBe(fetchCallsAfterFirstDraw);
		expect(mapProvider.clearAllPolylines.mock.calls.length).toBe(clearCallsAfterFirstDraw);
	});

	test('does redraw when the route set actually changes', async () => {
		const mapProvider = makeProvider();
		const { rerender } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: routes, routeColors: colors }
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));

		const changedColors = new Map(colors);
		changedColors.set('r_c', { ...colors.get('r_c'), line: '#000000' });
		await rerender({ mapProvider, activeRoutes: routes, routeColors: changedColors });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(4));
		expect(mapProvider.clearAllPolylines).toHaveBeenCalledTimes(2);
	});

	// Finding 2 (CRITICAL): a cold deep-link whose arrivals land before
	// initMap() resolves mounts this layer with mapProvider still null;
	// closing the sheet before the map finishes initializing must not throw
	// out of the destroy chain and abort sibling teardowns.
	test('does not throw on destroy when mapProvider is null', async () => {
		const { unmount } = render(StopRoutesLayer, {
			props: { mapProvider: null, activeRoutes: routes, routeColors: colors }
		});
		await flush();

		expect(() => unmount()).not.toThrow();
	});

	// Finding 3 (IMPORTANT): the route set going empty must tear everything
	// down (polylines, vehicle markers, the poll interval), not leave the
	// previous selection live on the map indefinitely.
	test('tears down and stops polling when the route set goes empty', async () => {
		const mapProvider = makeProvider();
		const { rerender } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: routes, routeColors: colors }
		});
		await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalled());
		await flush();

		const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
		await rerender({ mapProvider, activeRoutes: [], routeColors: new Map() });

		expect(mapProvider.clearAllPolylines).toHaveBeenCalled();
		expect(mapProvider.clearVehicleMarkers).toHaveBeenCalled();
		expect(clearIntervalSpy).toHaveBeenCalledWith(42);
		clearIntervalSpy.mockRestore();
	});

	// Finding 5 (IMPORTANT): Google's createPolyline is async (it awaits
	// importLibrary), so a supersede's clearAllPolylines() can run before a
	// stale create resolves. The stale create must not orphan its polyline on
	// the map.
	test('removes a polyline that resolves after a newer selection has superseded it', async () => {
		let resolveStaleCreate;
		const staleCreatePromise = new Promise((resolve) => {
			resolveStaleCreate = resolve;
		});
		const stalePolyline = { id: 'stale' };
		const freshPolyline = { id: 'fresh' };
		let createCalls = 0;

		const mapProvider = {
			createPolyline: vi.fn(async () => {
				createCalls++;
				if (createCalls === 1) {
					return staleCreatePromise.then(() => stalePolyline);
				}
				return freshPolyline;
			}),
			revealPolylines: vi.fn(),
			clearAllPolylines: vi.fn(),
			clearVehicleMarkers: vi.fn(),
			removePolyline: vi.fn()
		};

		const { rerender } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: [routes[0]], routeColors: colors }
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1));

		// Supersede before the first create resolves.
		await rerender({ mapProvider, activeRoutes: [routes[1]], routeColors: colors });
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));

		resolveStaleCreate();
		await vi.waitFor(() => expect(mapProvider.removePolyline).toHaveBeenCalledWith(stalePolyline));
	});

	// Finding 6 (IMPORTANT): drawRoutes(...) and the vehicle-poll .then(...)
	// chain both run detached from the effect, with no .catch — a throw from
	// createPolyline (outside fetchRouteShape's own try/catch) must not
	// produce an unhandled promise rejection.
	test('does not produce an unhandled rejection when createPolyline throws', async () => {
		const unhandled = [];
		const onUnhandledRejection = (reason) => unhandled.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const mapProvider = {
			createPolyline: vi.fn(async () => {
				throw new Error('boom');
			}),
			revealPolylines: vi.fn(),
			clearAllPolylines: vi.fn(),
			clearVehicleMarkers: vi.fn(),
			removePolyline: vi.fn()
		};

		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalled());
		await flush(20);

		process.off('unhandledRejection', onUnhandledRejection);
		consoleErrorSpy.mockRestore();
		expect(unhandled).toHaveLength(0);
	});

	// Finding 7 (IMPORTANT): routeStopIds must not go stale across a stop
	// switch — it's cleared at the top of drawRoutes rather than only once a
	// (possibly failing) shape resolves.
	test('clears routeStopIds immediately on a redraw, before any shape resolves', async () => {
		const bindings = createLayerBindings();
		const mapProvider = makeProvider();
		const { rerender } = render(StopRoutesLayer, {
			props: {
				mapProvider,
				activeRoutes: routes,
				routeColors: colors,
				get routeStopIds() {
					return bindings.routeStopIds;
				},
				set routeStopIds(value) {
					bindings.routeStopIds = value;
				}
			}
		});
		await vi.waitFor(() => expect(bindings.routeStopIds.size).toBe(2));

		// A new stop's routes, all of whose shapes will fail to fetch — the
		// previous stop's ring dots must not linger.
		global.fetch = vi.fn(async () => ({ ok: false, status: 500 }));
		const otherRoutes = [
			{ id: 'r_x', shortName: 'X', type: 3, tripId: 't_x', gtfsColor: '000000' }
		];
		const otherColors = new Map([['r_x', { line: '#000000', badgeBg: '000000', badgeFg: 'fff' }]]);
		await rerender({ mapProvider, activeRoutes: otherRoutes, routeColors: otherColors });

		expect(bindings.routeStopIds.size).toBe(0);
	});

	// The headline regression this diff guards against: deleting both
	// untrack() calls currently leaves every other test passing, because
	// promotedRouteId/highlightedTripId only affect trip-expansion styling
	// that these tests don't otherwise observe.
	test('does not re-run the redraw effect when promotedRouteId or highlightedTripId change', async () => {
		const mapProvider = makeProvider();
		const colorGetSpy = vi.spyOn(colors, 'get');
		const { rerender } = render(StopRoutesLayer, {
			props: {
				mapProvider,
				activeRoutes: routes,
				routeColors: colors,
				promotedRouteId: null,
				highlightedTripId: null
			}
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		const fetchCallsBefore = global.fetch.mock.calls.length;
		const colorGetCallsBefore = colorGetSpy.mock.calls.length;

		// Partial props only: reassigning activeRoutes/routeColors themselves
		// (even to the same reference) makes the test harness's $state props
		// wrapper treat them as changed, which would mask what we're testing.
		// Changing only promotedRouteId/highlightedTripId isolates it.
		await rerender({ promotedRouteId: 'r_c', highlightedTripId: 't_c' });
		await flush();

		expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2);
		expect(global.fetch.mock.calls.length).toBe(fetchCallsBefore);
		// If the effect re-ran at all (even if guarded from redrawing by the
		// content signature), it would recompute the signature and read
		// colors.get() again for every route.
		expect(colorGetSpy.mock.calls.length).toBe(colorGetCallsBefore);

		colorGetSpy.mockRestore();
	});
});

// Task 10b: expanding an arrival row promotes its route and highlights its
// vehicle. The main redraw effect above deliberately excludes
// promotedRouteId/highlightedTripId as dependencies (see the previous test);
// this second effect is what actually makes expansion do something, without
// touching the main effect's redraw guarantees.
describe('StopRoutesLayer — trip expansion (promote route / highlight vehicle)', () => {
	function makePromotableProvider() {
		const polyC = { id: 'poly_c' };
		const poly22 = { id: 'poly_22' };
		const mapProvider = {
			createPolyline: vi.fn(async (points, options) =>
				options.color === '#b02a37' ? polyC : poly22
			),
			revealPolylines: vi.fn(),
			clearAllPolylines: vi.fn(),
			clearVehicleMarkers: vi.fn(),
			removePolyline: vi.fn(),
			setPolylineLayer: vi.fn()
		};
		return { mapProvider, polyC, poly22 };
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockShapeFetches();
	});

	// The deliverable: expansion must re-pane, not redraw. If this regresses to
	// a full redraw, createPolyline/fetch counts below would climb.
	test('promotes the newly expanded route and demotes the previous one, without any createPolyline or fetch call', async () => {
		const { mapProvider, polyC, poly22 } = makePromotableProvider();
		const { rerender } = render(StopRoutesLayer, {
			props: {
				mapProvider,
				activeRoutes: routes,
				routeColors: colors,
				promotedRouteId: null,
				highlightedTripId: null
			}
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		const fetchCallsBefore = global.fetch.mock.calls.length;
		// The very first draw's own teardown() (there's nothing to tear down
		// yet, but it always runs) already calls clearAllPolylines() once —
		// baseline off that rather than asserting zero calls.
		const clearCallsBefore = mapProvider.clearAllPolylines.mock.calls.length;

		await rerender({ promotedRouteId: 'r_c', highlightedTripId: 't_c' });
		await flush();

		expect(mapProvider.setPolylineLayer).toHaveBeenCalledWith(polyC, ROUTE_PANE.PROMOTED);

		mapProvider.setPolylineLayer.mockClear();
		await rerender({ promotedRouteId: 'r_22', highlightedTripId: 't_22' });
		await flush();

		expect(mapProvider.setPolylineLayer).toHaveBeenCalledWith(polyC, ROUTE_PANE.LINE);
		expect(mapProvider.setPolylineLayer).toHaveBeenCalledWith(poly22, ROUTE_PANE.PROMOTED);

		expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2);
		expect(global.fetch.mock.calls.length).toBe(fetchCallsBefore);
		expect(mapProvider.clearAllPolylines.mock.calls.length).toBe(clearCallsBefore);
	});

	test('changing highlightedTripId forces an immediate vehicle refresh without redrawing', async () => {
		const mapProvider = makeProvider();
		const { rerender } = render(StopRoutesLayer, {
			props: {
				mapProvider,
				activeRoutes: routes,
				routeColors: colors,
				promotedRouteId: null,
				highlightedTripId: null
			}
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalled());
		const { tick } = await fetchAndUpdateVehiclesForRoutes.mock.results[0].value;
		const fetchCallsBefore = global.fetch.mock.calls.length;

		await rerender({ highlightedTripId: 't_22' });
		await flush();

		expect(tick).toHaveBeenCalled();
		expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2);
		expect(global.fetch.mock.calls.length).toBe(fetchCallsBefore);
	});

	// promotedRouteId can legitimately name a route whose shape fetch failed —
	// there is nothing drawn for it to re-pane, and that must not throw or call
	// setPolylineLayer with an undefined polyline.
	test('a promotedRouteId with no drawn polyline is a no-op', async () => {
		const mapProvider = makeProvider();
		const { rerender } = render(StopRoutesLayer, {
			props: {
				mapProvider,
				activeRoutes: routes,
				routeColors: colors,
				promotedRouteId: null,
				highlightedTripId: null
			}
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));

		await rerender({ promotedRouteId: 'r_never_drawn', highlightedTripId: null });
		await flush();

		expect(mapProvider.setPolylineLayer).not.toHaveBeenCalled();
	});
});
