import { render } from '@testing-library/svelte';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import RouteMap from '../RouteMap.svelte';

vi.mock('$lib/vehicleUtils', () => ({
	clearVehicleMarkersMap: vi.fn(),
	fetchAndUpdateVehicles: vi.fn().mockResolvedValue(null)
}));

function makeProvider() {
	return {
		clearAllPolylines: vi.fn(),
		removeStopMarkers: vi.fn(),
		cleanupInfoWindow: vi.fn(),
		clearVehicleMarkers: vi.fn(),
		createPolyline: vi.fn().mockResolvedValue(undefined),
		addStopRouteMarker: vi.fn(),
		fitToPolylines: vi.fn().mockResolvedValue(true),
		flyTo: vi.fn()
	};
}

describe('RouteMap', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

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
});
