import { render } from '@testing-library/svelte';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import StopRoutesLayer from '../StopRoutesLayer.svelte';
import { ROUTE_PANE } from '$lib/mapPanes.js';

vi.mock('$lib/vehicleUtils.js', () => ({
	fetchAndUpdateVehiclesForRoutes: vi.fn().mockResolvedValue({ intervalId: 42, tick: vi.fn() }),
	removeVehicleMarkersForRoutes: vi.fn()
}));
vi.mock('$lib/routeNotifications', () => ({
	notifyPartialRouteShape: vi.fn(() => 'toast-id')
}));

import {
	fetchAndUpdateVehiclesForRoutes,
	removeVehicleMarkersForRoutes
} from '$lib/vehicleUtils.js';
import { createLayerBindings } from './support/layerBindings.svelte.js';
import { notifyPartialRouteShape } from '$lib/routeNotifications';

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

	test('tries the next boardable trip when the first trip has no usable shape', async () => {
		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const resilientRoute = {
			...routes[0],
			tripCandidates: [
				{ id: 't_stale', serviceDate: 20260904 },
				{ id: 't_good', serviceDate: 20260904 }
			]
		};
		global.fetch = vi.fn(async (url) => {
			if (url.includes('/trip-details/t_stale')) return { ok: false, status: 500 };
			if (url.includes('/trip-details/t_good')) {
				return {
					ok: true,
					json: async () => ({
						data: {
							entry: { schedule: { stopTimes: [{ stopId: 'stop_good' }] } },
							references: { trips: [{ id: 't_good', shapeId: 'shape_good' }] }
						}
					})
				};
			}
			if (url.includes('/shape/shape_good')) {
				return { ok: true, json: async () => ({ data: { entry: { points: 'encoded_good' } } }) };
			}
			throw new Error(`unexpected fetch: ${url}`);
		});

		const mapProvider = makeProvider();
		render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: [resilientRoute], routeColors: colors }
		});

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1));
		expect(mapProvider.createPolyline).toHaveBeenCalledWith(
			'encoded_good',
			expect.objectContaining({ color: '#b02a37' })
		);
		expect(global.fetch.mock.calls[0][0]).toContain('serviceDate=20260904');
		expect(global.fetch.mock.calls.some(([url]) => url.includes('/stops-for-route/'))).toBe(false);
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			'StopRoutesLayer: using alternate trip shape',
			expect.objectContaining({
				routeId: 'r_c',
				tripId: 't_good',
				shapeId: 'shape_good',
				failedTripIds: ['t_stale']
			})
		);
		expect(notifyPartialRouteShape).not.toHaveBeenCalled();
		consoleWarnSpy.mockRestore();
	});

	test('uses every route-level polyline when all boardable trip shapes fail', async () => {
		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const resilientRoute = {
			...routes[0],
			tripCandidates: [{ id: 't_bad_1' }, { id: 't_bad_2' }, { id: 't_bad_3' }, { id: 't_bad_4' }]
		};
		global.fetch = vi.fn(async (url) => {
			if (url.includes('/trip-details/')) return { ok: false, status: 500 };
			if (url.includes('/stops-for-route/r_c')) {
				return {
					ok: true,
					json: async () => ({
						data: {
							entry: {
								polylines: [
									{ points: 'fallback_a' },
									{ points: 'fallback_b' },
									{ points: 'fallback_a' }
								]
							},
							references: { stops: [{ id: 'fallback_stop' }] }
						}
					})
				};
			}
			throw new Error(`unexpected fetch: ${url}`);
		});

		const mapProvider = makeProvider();
		render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: [resilientRoute], routeColors: colors }
		});

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		expect(mapProvider.createPolyline.mock.calls.map(([points]) => points)).toEqual([
			'fallback_a',
			'fallback_b'
		]);
		const attemptedTrips = global.fetch.mock.calls
			.map(([url]) => url)
			.filter((url) => url.includes('/trip-details/'));
		expect(attemptedTrips).toHaveLength(3);
		expect(attemptedTrips.some((url) => url.includes('t_bad_4'))).toBe(false);
		expect(mapProvider.revealPolylines).toHaveBeenCalledWith({
			only: expect.arrayContaining([expect.any(Object), expect.any(Object)]),
			duration: 0.8
		});
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			'StopRoutesLayer: using route-level shape fallback',
			expect.objectContaining({
				routeId: 'r_c',
				tripIds: ['t_bad_1', 't_bad_2', 't_bad_3']
			})
		);
		expect(notifyPartialRouteShape).not.toHaveBeenCalled();
		consoleWarnSpy.mockRestore();
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
		const { unmount } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: routes, routeColors: colors }
		});

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
		expect(notifyPartialRouteShape).toHaveBeenCalledTimes(1);

		unmount();
		expect(removeVehicleMarkersForRoutes).toHaveBeenCalledWith(
			expect.arrayContaining(['r_c', 'r_22']),
			mapProvider
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
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalled());
		// Flush the resolved fetchAndUpdateVehiclesForRoutes promise so
		// vehicleIntervalId is actually assigned before we unmount and assert
		// clearInterval ran on it — not just that the interval was requested.
		await flush();

		const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
		unmount();

		// Self-scoped teardown: exactly the two polylines this layer drew, not a
		// map-wide clear (which would also strip anything a sibling component
		// drew, e.g. a route SearchPane just drew over an open stop sheet).
		expect(mapProvider.removePolyline).toHaveBeenCalledTimes(2);
		expect(removeVehicleMarkersForRoutes).toHaveBeenCalledWith(
			expect.arrayContaining(['r_c', 'r_22']),
			mapProvider
		);
		expect(clearIntervalSpy).toHaveBeenCalledWith(42);
		clearIntervalSpy.mockRestore();
	});

	// The headline regression this diff guards against (strand-route-on-search-
	// select): teardown used to call the map-wide clearAllPolylines(), which
	// would also strip a polyline a sibling component drew directly on the
	// shared provider — e.g. SearchPane drawing a newly selected route while a
	// stop sheet (and therefore this layer) was still open. This provider fake
	// models the map's actual polyline set, including a "foreign" polyline
	// never handed to this layer, so a map-wide clear is distinguishable from a
	// self-scoped one. Fails against the old `mapProvider.clearAllPolylines()`
	// teardown, which would empty `onMap` entirely.
	test('removes only its own polylines on teardown, leaving a foreign one (e.g. one SearchPane just drew) untouched', async () => {
		const onMap = new Set();
		let nextId = 0;
		const mapProvider = {
			createPolyline: vi.fn(async () => {
				const polyline = { id: `own-${nextId++}` };
				onMap.add(polyline);
				return polyline;
			}),
			revealPolylines: vi.fn(),
			clearAllPolylines: vi.fn(() => onMap.clear()),
			clearVehicleMarkers: vi.fn(),
			removePolyline: vi.fn((polyline) => onMap.delete(polyline)),
			setPolylineLayer: vi.fn()
		};

		const { unmount } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: routes, routeColors: colors }
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		const ownPolylines = [...onMap];
		expect(ownPolylines).toHaveLength(2);

		// A route SearchPane drew directly on the shared provider — this layer
		// never created it and has no reference to it.
		const foreignPolyline = { id: 'searchpane-route' };
		onMap.add(foreignPolyline);

		unmount();

		expect(onMap.has(foreignPolyline)).toBe(true);
		for (const polyline of ownPolylines) {
			expect(onMap.has(polyline)).toBe(false);
		}
		expect(mapProvider.clearAllPolylines).not.toHaveBeenCalled();
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
		const removeCallsAfterFirstDraw = mapProvider.removePolyline.mock.calls.length;

		const sameRoutes = routes.map((route) => ({ ...route }));
		const sameColors = new Map(Array.from(colors, ([id, value]) => [id, { ...value }]));
		await rerender({ mapProvider, activeRoutes: sameRoutes, routeColors: sameColors });
		await flush();

		expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2);
		expect(global.fetch.mock.calls.length).toBe(fetchCallsAfterFirstDraw);
		expect(mapProvider.removePolyline.mock.calls.length).toBe(removeCallsAfterFirstDraw);
	});

	test('does not redraw when polling only changes a route candidate list', async () => {
		const mapProvider = makeProvider();
		const initialRoutes = [{ ...routes[0], tripCandidates: [{ id: 't_c' }, { id: 't_c_next' }] }];
		const { rerender } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: initialRoutes, routeColors: colors }
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1));
		const fetchCallsAfterFirstDraw = global.fetch.mock.calls.length;

		await rerender({
			mapProvider,
			activeRoutes: [{ ...routes[0], tripCandidates: [{ id: 't_c_next' }, { id: 't_c_later' }] }],
			routeColors: colors
		});
		await flush();

		expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1);
		expect(global.fetch).toHaveBeenCalledTimes(fetchCallsAfterFirstDraw);
		expect(mapProvider.removePolyline).not.toHaveBeenCalled();
	});

	test('does redraw when the route set actually changes', async () => {
		const mapProvider = makeProvider();
		const { rerender } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: routes, routeColors: colors }
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));

		const changedColors = new Map(colors);
		changedColors.set('r_c', { ...colors.get('r_c'), line: '#000000' });
		const fetchCallsBeforeRedraw = global.fetch.mock.calls.length;
		await rerender({ mapProvider, activeRoutes: routes, routeColors: changedColors });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(4));
		// Geometry is immutable; a color-only redraw should reuse cached shapes.
		expect(global.fetch).toHaveBeenCalledTimes(fetchCallsBeforeRedraw);
		// The redraw's own teardown removes exactly the two polylines the
		// previous draw produced (the first mount's teardown had nothing to
		// remove yet).
		expect(mapProvider.removePolyline).toHaveBeenCalledTimes(2);
		expect(removeVehicleMarkersForRoutes).toHaveBeenCalledWith(
			expect.arrayContaining(['r_c', 'r_22']),
			mapProvider
		);
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
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalled());
		await flush();

		const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
		await rerender({ mapProvider, activeRoutes: [], routeColors: new Map() });

		expect(mapProvider.removePolyline).toHaveBeenCalledTimes(2);
		expect(removeVehicleMarkersForRoutes).toHaveBeenCalledWith(
			expect.arrayContaining(['r_c', 'r_22']),
			mapProvider
		);
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

		expect(notifyPartialRouteShape).toHaveBeenCalledTimes(1);

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'StopRoutesLayer: could not create polyline',
			expect.any(String),
			expect.any(Error)
		);
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
		const removeCallsBefore = mapProvider.removePolyline.mock.calls.length;

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
		// Promoting/demoting must not tear down and redraw anything.
		expect(mapProvider.removePolyline.mock.calls.length).toBe(removeCallsBefore);
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

	// IMPORTANT finding: OSM's setPolylineLayer(poly, ROUTE_PANE.LINE) does
	// remove()+addTo(), which appends the demoted route's <path> to the LINE
	// pane's SVG container — making it frontmost regardless of its
	// drawRoutes index. In a 3-route corridor this leaves the widest route
	// (index 0, drawn backmost on purpose so its casing shows as a fringe
	// beside its neighbors) painting over a narrower one once it is demoted
	// back out of the promoted pane. The fix must re-issue drawRoutes'
	// ascending-index bringToFront pass over the non-promoted routes after
	// every promote/demote.
	test('restores LINE-pane paint order (widest backmost) after demoting a route back from promoted', async () => {
		const threeRoutes = [
			...routes,
			{ id: 'r_x', shortName: 'X', type: 3, tripId: 't_x', gtfsColor: '000000' }
		];
		const threeColors = new Map(colors);
		threeColors.set('r_x', { line: '#000000', badgeBg: '000000', badgeFg: 'ffffff' });

		const callOrder = [];
		const polyC = { id: 'poly_c', bringToFront: vi.fn(() => callOrder.push('poly_c')) };
		const poly22 = { id: 'poly_22', bringToFront: vi.fn(() => callOrder.push('poly_22')) };
		const polyX = { id: 'poly_x', bringToFront: vi.fn(() => callOrder.push('poly_x')) };
		const mapProvider = {
			createPolyline: vi.fn(async (points, options) => {
				if (options.color === '#b02a37') return polyC;
				if (options.color === '#e0a021') return poly22;
				return polyX;
			}),
			revealPolylines: vi.fn(),
			clearAllPolylines: vi.fn(),
			clearVehicleMarkers: vi.fn(),
			removePolyline: vi.fn(),
			setPolylineLayer: vi.fn()
		};

		const { rerender } = render(StopRoutesLayer, {
			props: {
				mapProvider,
				activeRoutes: threeRoutes,
				routeColors: threeColors,
				promotedRouteId: null,
				highlightedTripId: null
			}
		});
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(3));

		// Promote r_c (index 0, the widest — the shared-corridor route), then
		// isolate what happens next: reset the bringToFront spies so only the
		// promotion effect's own calls remain.
		await rerender({ promotedRouteId: 'r_c', highlightedTripId: 't_c' });
		await flush();
		callOrder.length = 0;
		polyC.bringToFront.mockClear();
		poly22.bringToFront.mockClear();
		polyX.bringToFront.mockClear();

		// Now promote r_22 instead: r_c is demoted back to ROUTE_PANE.LINE,
		// landing frontmost under the unfixed OSM behavior. r_x (index 2) was
		// never disturbed and stays in LINE throughout.
		await rerender({ promotedRouteId: 'r_22', highlightedTripId: 't_22' });
		await flush();

		expect(mapProvider.setPolylineLayer).toHaveBeenCalledWith(polyC, ROUTE_PANE.LINE);
		expect(mapProvider.setPolylineLayer).toHaveBeenCalledWith(poly22, ROUTE_PANE.PROMOTED);

		// Paint order must be re-asserted in index order over the two routes
		// now sharing the LINE pane (r_c index 0, r_x index 2), the same way
		// drawRoutes does: ascending by index, last call wins, so the higher
		// index ends up frontmost and the demoted widest route (r_c) goes
		// back to the bottom of the stack rather than staying on top of it.
		expect(polyC.bringToFront).toHaveBeenCalled();
		expect(polyX.bringToFront).toHaveBeenCalled();
		expect(callOrder.indexOf('poly_c')).toBeLessThan(callOrder.lastIndexOf('poly_x'));
		expect(callOrder[callOrder.length - 1]).toBe('poly_x');
		// The freshly promoted route lives in its own pane above LINE and is
		// excluded from this reassert.
		expect(poly22.bringToFront).not.toHaveBeenCalled();

		expect(mapProvider.createPolyline).toHaveBeenCalledTimes(3);
	});
});
