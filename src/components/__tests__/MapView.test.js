import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import MapView from '$components/map/MapView.svelte';

// StopRoutesLayer.svelte and RouteLegend.svelte don't exist yet (later tasks);
// MapView doesn't import them, so mocking those paths would fail resolution.
vi.mock('$components/map/RouteMap.svelte', () => ({ default: () => null }));
vi.mock('$lib/LocationButton/LocationButton.svelte', () => ({ default: () => null }));

// The global vitest-setup mock omits the region-center coords MapView reads at
// module init (see MapExperience.test.js for the same override).
vi.mock('$env/static/public', () => ({
	PUBLIC_OBA_REGION_NAME: 'Test Region',
	PUBLIC_OBA_REGION_CENTER_LAT: '47.6',
	PUBLIC_OBA_REGION_CENTER_LNG: '-122.3'
}));

function makeProvider() {
	return {
		initMap: vi.fn().mockResolvedValue(undefined),
		eventListeners: vi.fn(),
		enableContextMenu: vi.fn(),
		getBoundingBox: vi.fn(() => ({ north: 1, south: 0, east: 1, west: 0 })),
		getCenter: vi.fn(() => ({ lat: 0, lng: 0 })),
		map: { getZoom: () => 15 },
		hasMarker: vi.fn(() => false),
		addMarker: vi.fn(),
		clearAllStopMarkers: vi.fn(),
		setStopEmphasis: vi.fn(),
		resetStopEmphasis: vi.fn(),
		setBasemapDimmed: vi.fn(),
		setTheme: vi.fn()
	};
}

describe('MapView map mode', () => {
	beforeEach(() => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ data: { list: [], references: { routes: [] } } })
		});
	});

	test('does not clear stop markers when a trip is expanded inside a stop selection', async () => {
		const mapProvider = makeProvider();
		render(MapView, {
			props: {
				handleStopMarkerSelect: vi.fn(),
				mapProvider,
				stop: { id: 'stop_1', lat: 47.6, lon: -122.3 },
				selectedTrip: { tripId: 'trip_1' },
				isRouteSelected: true,
				showRouteMap: true
			}
		});
		await vi.waitFor(() => expect(mapProvider.initMap).toHaveBeenCalled());
		// Use tick() to deterministically flush pending reactive updates and effects,
		// ensuring the effect chain completes before the negative assertion.
		await tick();
		expect(mapProvider.clearAllStopMarkers).not.toHaveBeenCalled();
	});

	test('still clears stop markers for a route selection with no stop', async () => {
		const mapProvider = makeProvider();
		render(MapView, {
			props: {
				handleStopMarkerSelect: vi.fn(),
				mapProvider,
				stop: null,
				selectedRoute: { id: 'route_1' },
				isRouteSelected: true
			}
		});
		await vi.waitFor(() => expect(mapProvider.clearAllStopMarkers).toHaveBeenCalled());
	});
});
