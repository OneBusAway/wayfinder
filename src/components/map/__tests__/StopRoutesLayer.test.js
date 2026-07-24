import { render } from '@testing-library/svelte';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import StopRoutesLayer from '../StopRoutesLayer.svelte';

vi.mock('$lib/vehicleUtils.js', () => ({
	fetchAndUpdateVehiclesForRoutes: vi.fn().mockResolvedValue(42),
	clearVehicleMarkersMap: vi.fn()
}));
import { fetchAndUpdateVehiclesForRoutes, clearVehicleMarkersMap } from '$lib/vehicleUtils.js';
import { createLayerBindings } from './support/layerBindings.svelte.js';

function makeProvider() {
	return {
		createPolyline: vi.fn(async () => ({ id: 'polyline' })),
		revealPolylines: vi.fn(),
		clearAllPolylines: vi.fn(),
		clearVehicleMarkers: vi.fn()
	};
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
	test('reports the ring-dot stops from the drawn trips', async () => {
		const mapProvider = makeProvider();
		const bindings = createLayerBindings();
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

		await vi.waitFor(() => expect(bindings.routeStopIds.size).toBe(2));
		expect(bindings.routeStopIds.get('stop_t_c')).toBe('#b02a37');
	});

	test('drops a route whose shape fetch fails without losing the others', async () => {
		mockShapeFetches({ failRouteId: 'r_22' });
		const mapProvider = makeProvider();
		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1));
		expect(mapProvider.createPolyline.mock.calls[0][1].color).toBe('#b02a37');
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

		unmount();

		expect(mapProvider.clearAllPolylines).toHaveBeenCalled();
		expect(mapProvider.clearVehicleMarkers).toHaveBeenCalled();
		expect(clearVehicleMarkersMap).toHaveBeenCalled();
	});
});
