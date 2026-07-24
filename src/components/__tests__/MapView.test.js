import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import MapView from '$components/map/MapView.svelte';

vi.mock('$components/map/RouteMap.svelte', () => ({ default: () => null }));
vi.mock('$lib/LocationButton/LocationButton.svelte', () => ({ default: () => null }));

// StopRoutesLayer and RouteLegend are unit-tested on their own (their tests
// cover shape-fetch races, redraw signatures, vehicle polling, i18n). Mocking
// them here keeps MapView's tests scoped to the wiring it owns: computing the
// tier map and calling setStopEmphasis/setBasemapDimmed. Rendering the real
// StopRoutesLayer would also need every method it calls on mapProvider
// (createPolyline, clearAllPolylines, revealPolylines, ...) added to the stub
// just to avoid an unhandled rejection unrelated to what these tests assert.
vi.mock('$components/map/StopRoutesLayer.svelte', () => ({ default: () => null }));
vi.mock('$components/map/RouteLegend.svelte', () => ({ default: () => null }));

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

describe('stop selection layer', () => {
	test('tiers markers when routes are drawn: route stops ring, everything else muted', async () => {
		const mapProvider = makeProvider();
		render(MapView, {
			props: {
				handleStopMarkerSelect: vi.fn(),
				mapProvider,
				stop: { id: 'stop_sel', lat: 47.6, lon: -122.3 },
				activeRoutes: [
					{ id: 'r_c', shortName: 'C Line', type: 3, tripId: 't_c', gtfsColor: 'b02a37' }
				],
				routeColors: new Map([['r_c', { line: '#b02a37', badgeBg: 'b02a37', badgeFg: 'ffffff' }]])
			}
		});

		await vi.waitFor(() => expect(mapProvider.setStopEmphasis).toHaveBeenCalled());
		const [, defaultEmphasis, selectedStopId] = mapProvider.setStopEmphasis.mock.calls.at(-1);
		expect(defaultEmphasis).toBe('muted');
		expect(selectedStopId).toBe('stop_sel');
	});

	test('does not tier or dim when there are no active routes', async () => {
		const mapProvider = makeProvider();
		render(MapView, {
			props: {
				handleStopMarkerSelect: vi.fn(),
				mapProvider,
				stop: { id: 'stop_sel', lat: 47.6, lon: -122.3 },
				activeRoutes: [],
				routeColors: new Map()
			}
		});

		await vi.waitFor(() => expect(mapProvider.initMap).toHaveBeenCalled());
		expect(mapProvider.setStopEmphasis).not.toHaveBeenCalled();
		expect(mapProvider.setBasemapDimmed).not.toHaveBeenCalledWith(true);
	});
});
