import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import MapView from '$components/map/MapView.svelte';

vi.mock('$components/map/RouteMap.svelte', () => ({ default: () => null }));
vi.mock('$lib/LocationButton/LocationButton.svelte', () => ({ default: () => null }));

// StopRoutesLayer and RouteLegend are unit-tested on their own (their tests
// cover shape-fetch races, redraw signatures, vehicle polling, i18n). But
// MapView's own job is the wiring between them — which props reach them, and
// whether the routeStopIds/liveCounts bindings it exposes are actually live —
// so unlike a bare stub, these mocks capture the props each child receives
// (mirroring the MapContainer/SearchPane pattern in MapExperience.test.js).
// Assigning onto the captured props object exercises the same setter a real
// bind: would, letting a test drive the bindable props back into MapView.
let capturedStopRoutesLayerProps = null;
vi.mock('$components/map/StopRoutesLayer.svelte', () => ({
	default: function StopRoutesLayer(anchor, props) {
		capturedStopRoutesLayerProps = props;
		return {};
	}
}));

let capturedRouteLegendProps = null;
vi.mock('$components/map/RouteLegend.svelte', () => ({
	default: function RouteLegend(anchor, props) {
		capturedRouteLegendProps = props;
		return {};
	}
}));

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

// Flushes the requestAnimationFrame callback batchAddMarkers defers marker
// creation into. A bare timer (setTimeout/vi.advanceTimersByTime) would be
// flushing the wrong queue — jsdom's rAF is real, not timer-backed here.
function flushRaf() {
	return new Promise((resolve) => requestAnimationFrame(resolve));
}

const ROUTE_C = { id: 'r_c', shortName: 'C Line', type: 3, tripId: 't_c', gtfsColor: 'b02a37' };
const ROUTE_COLORS = new Map([['r_c', { line: '#b02a37', badgeBg: 'b02a37', badgeFg: 'ffffff' }]]);

describe('MapView map mode', () => {
	beforeEach(() => {
		capturedStopRoutesLayerProps = null;
		capturedRouteLegendProps = null;
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
	beforeEach(() => {
		capturedStopRoutesLayerProps = null;
		capturedRouteLegendProps = null;
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ data: { list: [], references: { routes: [] } } })
		});
	});

	test('tiers markers when routes are drawn: route stops ring, everything else muted', async () => {
		const mapProvider = makeProvider();
		render(MapView, {
			props: {
				handleStopMarkerSelect: vi.fn(),
				mapProvider,
				stop: { id: 'stop_sel', lat: 47.6, lon: -122.3 },
				activeRoutes: [ROUTE_C],
				routeColors: ROUTE_COLORS
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

	// Finding 3: the else branch of the lifecycle effect (resetStopEmphasis +
	// setBasemapDimmed(false)) previously had nothing asserting it fires at all —
	// only tests proving it wasn't called on the *other* branch. Drive the actual
	// transition (routes drawn -> selection cleared) and assert the reset happens.
	test('resets emphasis and undims the basemap once the selection goes away', async () => {
		const mapProvider = makeProvider();
		const { rerender } = render(MapView, {
			props: {
				handleStopMarkerSelect: vi.fn(),
				mapProvider,
				stop: { id: 'stop_sel', lat: 47.6, lon: -122.3 },
				activeRoutes: [ROUTE_C],
				routeColors: ROUTE_COLORS
			}
		});

		await vi.waitFor(() => expect(mapProvider.setBasemapDimmed).toHaveBeenCalledWith(true));
		expect(mapProvider.resetStopEmphasis).not.toHaveBeenCalled();

		await rerender({
			handleStopMarkerSelect: vi.fn(),
			mapProvider,
			stop: null,
			activeRoutes: [],
			routeColors: new Map()
		});

		await vi.waitFor(() => expect(mapProvider.resetStopEmphasis).toHaveBeenCalled());
		expect(mapProvider.setBasemapDimmed).toHaveBeenCalledWith(false);
	});
});

// Finding 1: MapView is the integration point between the stop-selection layer
// and its two children. These tests exist to catch a broken bind: or a
// mis-wired prop, which a bare `() => null` stub can never surface.
describe('StopRoutesLayer / RouteLegend integration', () => {
	beforeEach(() => {
		capturedStopRoutesLayerProps = null;
		capturedRouteLegendProps = null;
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ data: { list: [], references: { routes: [] } } })
		});
	});

	test('StopRoutesLayer and RouteLegend receive the live map instance, activeRoutes, and routeColors', async () => {
		const mapProvider = makeProvider();
		render(MapView, {
			props: {
				handleStopMarkerSelect: vi.fn(),
				mapProvider,
				stop: { id: 'stop_sel', lat: 47.6, lon: -122.3 },
				activeRoutes: [ROUTE_C],
				routeColors: ROUTE_COLORS
			}
		});

		await vi.waitFor(() => expect(capturedStopRoutesLayerProps).not.toBeNull());

		// MapView wraps the mapProvider prop in $state (mapInstance = mapProvider),
		// so the object StopRoutesLayer receives is Svelte's reactive proxy around
		// it, not the exact same object reference the test holds — toBe on the
		// container fails even though it's the live instance. Compare a method
		// reference instead: Svelte's state proxy forwards function properties
		// untouched, so this is only true if it's the same underlying instance.
		expect(capturedStopRoutesLayerProps.mapProvider.setStopEmphasis).toBe(
			mapProvider.setStopEmphasis
		);
		expect(capturedStopRoutesLayerProps.activeRoutes).toEqual([ROUTE_C]);
		expect(capturedStopRoutesLayerProps.routeColors).toBe(ROUTE_COLORS);

		expect(capturedRouteLegendProps).not.toBeNull();
		expect(capturedRouteLegendProps.routes).toEqual([ROUTE_C]);
		expect(capturedRouteLegendProps.routeColors).toBe(ROUTE_COLORS);
	});

	// The bindable that drives the whole ring-dot tier: routeStopIds flows out of
	// StopRoutesLayer, into emphasisByStopId, and back down through
	// setStopEmphasis. Assert the wire is live end to end, not merely present.
	test('the routeStopIds binding is live: setting it drives setStopEmphasis with the routeDot tier', async () => {
		const mapProvider = makeProvider();
		render(MapView, {
			props: {
				handleStopMarkerSelect: vi.fn(),
				mapProvider,
				stop: { id: 'stop_sel', lat: 47.6, lon: -122.3 },
				activeRoutes: [ROUTE_C],
				routeColors: ROUTE_COLORS
			}
		});

		await vi.waitFor(() => expect(capturedStopRoutesLayerProps).not.toBeNull());

		capturedStopRoutesLayerProps.routeStopIds = new Map([['stop_a', '#b02a37']]);

		await vi.waitFor(() => {
			const lastCall = mapProvider.setStopEmphasis.mock.calls.at(-1);
			expect(lastCall).toBeDefined();
			expect(lastCall[0].get('stop_a')).toEqual({ emphasis: 'routeDot', dotColor: '#b02a37' });
		});
	});
});

// Finding 2: every other test's fetch mock returns an empty stop list, so
// allStops never populates and addMarker's emphasis-seeding logic never runs.
// Feed it a real stop list and assert the seeded emphasis/dotColor for all
// three tiers addMarker can produce.
describe('addMarker emphasis seeding', () => {
	beforeEach(() => {
		capturedStopRoutesLayerProps = null;
		capturedRouteLegendProps = null;
	});

	test('seeds routeDot, muted, and full emphasis onto newly created markers', async () => {
		const mapProvider = makeProvider();
		let resolveFetch;
		global.fetch = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve;
				})
		);

		render(MapView, {
			props: {
				handleStopMarkerSelect: vi.fn(),
				mapProvider,
				stop: { id: 'stop_sel', lat: 47.6, lon: -122.3 },
				activeRoutes: [ROUTE_C],
				routeColors: ROUTE_COLORS
			}
		});

		// Wire the ring-dot map before the stop list lands, so batchAddMarkers'
		// rAF-deferred addMarker calls see it — exactly the ordering addMarker's
		// own comment (about seeding at creation time, not patching after) exists
		// to protect against.
		await vi.waitFor(() => expect(capturedStopRoutesLayerProps).not.toBeNull());
		capturedStopRoutesLayerProps.routeStopIds = new Map([['stop_ring', '#b02a37']]);
		await tick();

		resolveFetch({
			ok: true,
			json: async () => ({
				data: {
					list: [
						{ id: 'stop_ring', lat: 47.601, lon: -122.301, routeIds: [] },
						{ id: 'stop_other', lat: 47.602, lon: -122.302, routeIds: [] },
						{ id: 'stop_sel', lat: 47.6, lon: -122.3, routeIds: [] }
					],
					references: { routes: [] }
				}
			})
		});

		await tick();
		await flushRaf();
		await tick();

		await vi.waitFor(() =>
			expect(mapProvider.addMarker.mock.calls.length).toBeGreaterThanOrEqual(3)
		);

		const calls = mapProvider.addMarker.mock.calls.map(([arg]) => arg);
		const ring = calls.find((c) => c.stop.id === 'stop_ring');
		const other = calls.find((c) => c.stop.id === 'stop_other');
		const selected = calls.find((c) => c.stop.id === 'stop_sel');

		expect(ring.emphasis).toBe('routeDot');
		expect(ring.dotColor).toBe('#b02a37');

		expect(other.emphasis).toBe('muted');
		expect(other.dotColor).toBeNull();

		expect(selected.emphasis).toBe('full');
		expect(selected.isHighlighted).toBe(true);
		expect(selected.dotColor).toBeNull();
	});
});
