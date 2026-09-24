import { render } from '@testing-library/svelte';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import RouteMap from '../RouteMap.svelte';
import { fetchAndUpdateVehiclesForRoutes } from '$lib/vehicleUtils';
import { mapContrastColor } from '$lib/colorUtils';

vi.mock('$lib/vehicleUtils', () => ({
	clearVehicleMarkersMap: vi.fn(),
	fetchAndUpdateVehiclesForRoutes: vi.fn().mockResolvedValue({ intervalId: null, refresh: vi.fn() })
}));

function makeProvider() {
	return {
		clearAllPolylines: vi.fn(),
		removeStopMarkers: vi.fn(),
		cleanupInfoWindow: vi.fn(),
		clearVehicleMarkers: vi.fn(),
		createPolyline: vi.fn().mockResolvedValue(undefined),
		addStopRouteMarker: vi.fn(),
		setPolylineColor: vi.fn(),
		fitToPolylines: vi.fn().mockResolvedValue(true),
		flyTo: vi.fn()
	};
}

describe('RouteMap', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
		document.documentElement.classList.remove('dark');
	});

	afterEach(() => document.documentElement.classList.remove('dark'));

	// Regression test for the transient-mount crash: MapExperience's framing
	// effect nulls selectedTrip one render tick *after* the DOM re-renders, so
	// on closing a stop after expanding a trip, RouteMap can transiently mount
	// with tripId already null before its parent unmounts it again. It must be
	// a no-op in that state, not clear the map or hit the network.
	test('does nothing when mounted with a null tripId', async () => {
		const mapProvider = makeProvider();
		const { unmount } = render(RouteMap, {
			props: { mapProvider, tripId: null, currentSelectedStop: { lat: 1, lon: 2 } }
		});

		await vi.waitFor(() => {
			// give any pending microtasks a chance to run
		});
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mapProvider.clearAllPolylines).not.toHaveBeenCalled();
		expect(mapProvider.removeStopMarkers).not.toHaveBeenCalled();
		expect(global.fetch).not.toHaveBeenCalled();

		unmount();
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Teardown must also be a no-op: nothing was drawn, so nothing should be
		// cleared, and it must not flyTo the stop as though a trip had loaded.
		expect(mapProvider.clearAllPolylines).not.toHaveBeenCalled();
		expect(mapProvider.removeStopMarkers).not.toHaveBeenCalled();
		expect(mapProvider.cleanupInfoWindow).not.toHaveBeenCalled();
		expect(mapProvider.clearVehicleMarkers).not.toHaveBeenCalled();
		expect(mapProvider.flyTo).not.toHaveBeenCalled();
	});

	test('still loads and tears down route data normally when tripId is present', async () => {
		global.fetch = vi.fn(async (url) => {
			if (url.includes('/trip-details/')) {
				return {
					ok: true,
					json: async () => ({
						data: {
							entry: { schedule: { stopTimes: [] } },
							references: { trips: [{ id: 'trip_1', shapeId: null }], routes: [] }
						}
					})
				};
			}
			return { ok: true, json: async () => ({ data: { entry: { points: null } } }) };
		});
		const mapProvider = makeProvider();
		const { unmount } = render(RouteMap, {
			props: { mapProvider, tripId: 'trip_1', currentSelectedStop: { lat: 1, lon: 2 } }
		});

		await vi.waitFor(() => expect(mapProvider.clearAllPolylines).toHaveBeenCalled());
		expect(mapProvider.removeStopMarkers).toHaveBeenCalled();
		expect(global.fetch).toHaveBeenCalledWith('/api/oba/trip-details/trip_1');

		unmount();
		await vi.waitFor(() => expect(mapProvider.flyTo).toHaveBeenCalledWith(1, 2, 18));
	});
	function mockTrip() {
		global.fetch = vi.fn(async (url) => ({
			ok: true,
			json: async () =>
				url.includes('/trip-details/')
					? {
							data: {
								entry: { schedule: { stopTimes: [] } },
								references: {
									trips: [{ id: 'trip_1', routeId: 'route_1', shapeId: 'shape_1' }],
									routes: [{ id: 'route_1', color: '#003366' }]
								}
							}
						}
					: { data: { entry: { points: 'encoded-shape' } } }
		}));
	}

	function switchTheme(darkMode) {
		document.documentElement.classList.toggle('dark', darkMode);
		window.dispatchEvent(new CustomEvent('themeChange', { detail: { darkMode } }));
	}

	test.each([false, true])(
		'recolors the line and cached vehicles together (initial dark=%s)',
		async (initialDark) => {
			mockTrip();
			document.documentElement.classList.toggle('dark', initialDark);
			const mapProvider = makeProvider();
			const polyline = {};
			mapProvider.createPolyline.mockResolvedValue(polyline);
			const { unmount } = render(RouteMap, { props: { mapProvider, tripId: 'trip_1' } });
			await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalledOnce());
			const { colorsByRouteId } = fetchAndUpdateVehiclesForRoutes.mock.calls[0][2];
			const { refresh } = await fetchAndUpdateVehiclesForRoutes.mock.results[0].value;
			await Promise.resolve();
			for (const dark of [!initialDark, initialDark]) {
				refresh.mockClear();
				switchTheme(dark);
				const expected = mapContrastColor('#003366', { dark });
				expect(mapProvider.setPolylineColor).toHaveBeenLastCalledWith(polyline, expected);
				expect(colorsByRouteId.get('route_1').line).toBe(expected);
				expect(refresh).toHaveBeenCalledOnce();
			}
			expect(global.fetch).toHaveBeenCalledTimes(2);
			expect(mapProvider.createPolyline).toHaveBeenCalledOnce();
			expect(mapProvider.fitToPolylines).toHaveBeenCalledOnce();
			expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalledOnce();
			unmount();
			mapProvider.setPolylineColor.mockClear();
			switchTheme(!initialDark);
			expect(mapProvider.setPolylineColor).not.toHaveBeenCalled();
		}
	);

	test('uses the latest theme when the polyline finishes loading', async () => {
		mockTrip();
		const mapProvider = makeProvider();
		let finishPolyline;
		mapProvider.createPolyline.mockReturnValue(
			new Promise((resolve) => {
				finishPolyline = resolve;
			})
		);
		const { unmount } = render(RouteMap, { props: { mapProvider, tripId: 'trip_1' } });
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledOnce());
		switchTheme(true);
		const polyline = {};
		finishPolyline(polyline);
		await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalledOnce());
		const expected = mapContrastColor('#003366', { dark: true });
		expect(mapProvider.setPolylineColor).toHaveBeenLastCalledWith(polyline, expected);
		expect(
			fetchAndUpdateVehiclesForRoutes.mock.calls[0][2].colorsByRouteId.get('route_1').line
		).toBe(expected);
		unmount();
	});
});
