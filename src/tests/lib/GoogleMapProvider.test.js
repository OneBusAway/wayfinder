import { describe, test, expect, vi, beforeEach } from 'vitest';
import GoogleMapProvider from '$lib/Provider/GoogleMapProvider.svelte.js';
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';

vi.mock('$components/map/StopMarker.svelte', () => ({ default: {} }));
vi.mock('$components/map/PopupContent.svelte', () => ({ default: {} }));
vi.mock('$components/map/VehiclePopupContent.svelte', () => ({ default: {} }));
vi.mock('$components/map/ContextMenuPopup.svelte', () => ({ default: {} }));
vi.mock('$components/trip-planner/tripPlanPinMarker.svelte', () => ({ default: {} }));
vi.mock('$lib/MapHelpers/generateVehicleIcon', () => ({
	createVehicleIconSvg: vi.fn(() => '<svg></svg>'),
	iconHeight: 40,
	iconWidth: 40
}));
vi.mock('$lib/MapHelpers/animateMarker', () => ({
	animateMarkerTo: vi.fn(),
	cancelMarkerAnimation: vi.fn()
}));
vi.mock('$lib/vehicleUtils', () => ({
	buildVehiclePopupData: vi.fn(() => ({}))
}));
vi.mock('$lib/googleMaps', () => ({
	loadGoogleMapsLibrary: vi.fn(),
	createMap: vi.fn(),
	nightModeStyles: vi.fn(() => [])
}));
vi.mock('svelte', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, mount: vi.fn(), unmount: vi.fn() };
});

const STOP = { id: 'stop_1', name: 'Market & Main', lat: 47.6, lon: -122.3 };

function makeGoogleMarkerMock() {
	return vi.fn(function GoogleMarker(options) {
		this.options = options;
		this.listeners = {};
		this.addListener = vi.fn((event, handler) => {
			this.listeners[event] = handler;
		});
		this.setMap = vi.fn();
	});
}

function setupGoogleMaps(MarkerMock) {
	global.google = {
		maps: {
			Marker: MarkerMock,
			InfoWindow: vi.fn(function InfoWindow() {
				this.open = vi.fn();
			}),
			SymbolPath: { CIRCLE: 0 },
			Size: vi.fn(),
			Point: vi.fn()
		}
	};
}

describe('addStopRouteMarker — accessible name', () => {
	let provider;
	let MarkerMock;

	beforeEach(() => {
		MarkerMock = makeGoogleMarkerMock();
		setupGoogleMaps(MarkerMock);

		provider = new GoogleMapProvider('test-key', vi.fn());
		provider.map = {};
		vi.spyOn(provider, 'openStopMarker').mockImplementation(() => {});
	});

	test('sets title to stop name for screen reader and tooltip access', () => {
		provider.addStopRouteMarker(STOP);

		expect(MarkerMock).toHaveBeenCalledOnce();
		expect(MarkerMock.mock.calls[0][0]).toMatchObject({
			title: STOP.name,
			position: { lat: STOP.lat, lng: STOP.lon }
		});
	});
});

describe('removeVehicleMarker — marker tracking', () => {
	let provider;
	let MarkerMock;

	beforeEach(() => {
		MarkerMock = makeGoogleMarkerMock();
		setupGoogleMaps(MarkerMock);

		provider = new GoogleMapProvider('test-key', vi.fn());
		provider.map = {};
	});

	test('removes the marker from vehicleMarkers after removal', () => {
		const marker = provider.addVehicleMarker(
			{
				position: { lat: 47.6, lon: -122.3 },
				predicted: true,
				orientation: 90
			},
			{ tripHeadsign: 'Northgate' },
			3
		);

		expect(provider.vehicleMarkers).toHaveLength(1);

		provider.removeVehicleMarker(marker);

		expect(marker.setMap).toHaveBeenCalledWith(null);
		expect(provider.vehicleMarkers).toHaveLength(0);
	});
});

describe('addVehicleMarker — route color', () => {
	let provider;

	beforeEach(() => {
		setupGoogleMaps(makeGoogleMarkerMock());
		provider = new GoogleMapProvider('test-key', vi.fn());
		provider.map = {};
		createVehicleIconSvg.mockClear();
	});

	test('passes the route color to the icon for a predicted vehicle', () => {
		provider.addVehicleMarker(
			{ position: { lat: 47.6, lon: -122.3 }, predicted: true, orientation: 90 },
			{ tripHeadsign: 'Northgate' },
			3,
			false,
			'#0a4ea2'
		);
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, '#0a4ea2', 3, false);
	});

	test('gray override still wins for a non-predicted vehicle', () => {
		provider.addVehicleMarker(
			{ position: { lat: 47.6, lon: -122.3 }, predicted: false, orientation: 90 },
			{ tripHeadsign: 'Northgate' },
			3,
			false,
			'#0a4ea2'
		);
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, '#808080', 3, false);
	});

	test('null route color falls back to the icon default (no null paint)', () => {
		provider.addVehicleMarker(
			{ position: { lat: 47.6, lon: -122.3 }, predicted: true, orientation: 90 },
			{ tripHeadsign: 'Northgate' },
			3,
			false,
			null
		);
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, undefined, 3, false);
	});
});

describe('flyTo — vertical offset for the bottom sheet', () => {
	let provider;

	beforeEach(() => {
		provider = new GoogleMapProvider('test-key', vi.fn());
	});

	function makeMap() {
		return {
			setZoom: vi.fn(),
			setCenter: vi.fn(),
			panBy: vi.fn(),
			getDiv: vi.fn(() => ({ offsetHeight: 800 }))
		};
	}

	test('centers on the raw coordinates when no offset is given', () => {
		provider.map = makeMap();

		provider.flyTo(47.6, -122.3, 16);

		expect(provider.map.setCenter).toHaveBeenCalledWith({ lat: 47.6, lng: -122.3 });
		expect(provider.map.panBy).not.toHaveBeenCalled();
	});

	test('offsetY pans the map down by a fraction of the map height', () => {
		provider.map = makeMap();

		provider.flyTo(47.6, -122.3, 16, { offsetY: 0.25 });

		expect(provider.map.setCenter).toHaveBeenCalledWith({ lat: 47.6, lng: -122.3 });
		// 800px map * 0.25 = 200px southward pan → marker rises to ~25% from the top.
		expect(provider.map.panBy).toHaveBeenCalledWith(0, 200);
	});
});

describe('addUserLocationMarker — one marker, repositioned', () => {
	let provider;
	let MarkerMock;

	beforeEach(() => {
		MarkerMock = vi.fn(function GoogleMarker(options) {
			this.options = options;
			this.setMap = vi.fn();
			this.setPosition = vi.fn();
		});
		setupGoogleMaps(MarkerMock);
		provider = new GoogleMapProvider('key', vi.fn());
		provider.map = {};
	});

	test('creates the marker on the first call', () => {
		const marker = provider.addUserLocationMarker({ lat: 47.6, lng: -122.3 });

		expect(MarkerMock).toHaveBeenCalledOnce();
		expect(marker.options.position).toEqual({ lat: 47.6, lng: -122.3 });
		expect(provider.userLocationMarker).toBe(marker);
	});

	test('moves the existing marker instead of stacking a second one', () => {
		const first = provider.addUserLocationMarker({ lat: 47.6, lng: -122.3 });
		const second = provider.addUserLocationMarker({ lat: 47.5, lng: -122.4 });

		expect(MarkerMock).toHaveBeenCalledOnce();
		expect(second).toBe(first);
		expect(first.setPosition).toHaveBeenCalledWith({ lat: 47.5, lng: -122.4 });
	});

	test('removeUserLocationMarker detaches the marker and clears the reference', () => {
		const marker = provider.addUserLocationMarker({ lat: 47.6, lng: -122.3 });

		provider.removeUserLocationMarker();

		expect(marker.setMap).toHaveBeenCalledWith(null);
		expect(provider.userLocationMarker).toBeNull();
	});

	test('removeUserLocationMarker is a no-op when no marker exists', () => {
		expect(() => provider.removeUserLocationMarker()).not.toThrow();
	});
});

describe('stop emphasis', () => {
	function providerWithMarkers(entries) {
		const provider = new GoogleMapProvider('test-key', vi.fn());
		provider.markersMap = new Map(entries);
		return provider;
	}

	test('applies per-stop emphasis and the default to everything else', () => {
		const a = { props: { emphasis: 'full', dotColor: null } };
		const b = { props: { emphasis: 'full', dotColor: null } };
		const provider = providerWithMarkers([
			['stop_a', a],
			['stop_b', b]
		]);

		provider.setStopEmphasis(
			new Map([['stop_a', { emphasis: 'routeDot', dotColor: '#b02a37' }]]),
			'muted',
			null
		);

		expect(a.props.emphasis).toBe('routeDot');
		expect(a.props.dotColor).toBe('#b02a37');
		expect(b.props.emphasis).toBe('muted');
		expect(b.props.dotColor).toBeNull();
	});

	// The selected stop is served by the drawn trips, so it is always in the
	// ring-dot map. Forcing 'full' here keeps the invariant in one place rather
	// than at every call site.
	test('forces the selected stop to full even when it is in the ring-dot map', () => {
		const selected = { props: { emphasis: 'full', dotColor: null } };
		const provider = providerWithMarkers([['stop_sel', selected]]);

		provider.setStopEmphasis(
			new Map([['stop_sel', { emphasis: 'routeDot', dotColor: '#b02a37' }]]),
			'muted',
			'stop_sel'
		);

		expect(selected.props.emphasis).toBe('full');
	});

	// addStopRouteMarker writes bare google.maps.Marker objects into markersMap;
	// those have no reactive props to mutate.
	test('skips markers with no props', () => {
		const provider = providerWithMarkers([['stop_a', { noProps: true }]]);
		expect(() => provider.setStopEmphasis(new Map(), 'muted', null)).not.toThrow();
	});

	test('resetStopEmphasis returns every marker to full', () => {
		const a = { props: { emphasis: 'muted', dotColor: '#b02a37' } };
		const provider = providerWithMarkers([['stop_a', a]]);
		provider.resetStopEmphasis();
		expect(a.props.emphasis).toBe('full');
		expect(a.props.dotColor).toBeNull();
	});
});

describe('setBasemapDimmed / setTheme composition', () => {
	function makeProvider() {
		const provider = new GoogleMapProvider('test-key', vi.fn());
		return provider;
	}

	test('setBasemapDimmed applies a desaturating style', () => {
		const provider = makeProvider();
		const setOptions = vi.fn();
		provider.map = { setOptions };

		provider.setBasemapDimmed(true);

		const styles = setOptions.mock.calls.at(-1)[0].styles;
		expect(styles.some((s) => s.stylers?.some((v) => 'saturation' in v))).toBe(true);
	});

	test('setBasemapDimmed(false) clears the dim style', () => {
		const provider = makeProvider();
		const setOptions = vi.fn();
		provider.map = { setOptions };

		provider.setBasemapDimmed(true);
		provider.setBasemapDimmed(false);

		const styles = setOptions.mock.calls.at(-1)[0].styles;
		expect(styles).toBeNull();
	});

	// Google replaces the whole `styles` array on setOptions, so theme and dim
	// must be composed together — otherwise a theme toggle silently drops the dim.
	test('a theme change preserves the basemap dim', () => {
		const provider = makeProvider();
		const setOptions = vi.fn();
		provider.map = { setOptions };

		provider.setBasemapDimmed(true);
		provider.setTheme('dark');

		const lastStyles = setOptions.mock.calls.at(-1)[0].styles;
		expect(lastStyles.some((s) => s.stylers?.some((v) => 'saturation' in v))).toBe(true);
	});

	test('a dim toggle preserves the current theme', () => {
		const provider = makeProvider();
		const setOptions = vi.fn();
		provider.map = { setOptions };

		provider.setTheme('dark');
		setOptions.mockClear();
		provider.setBasemapDimmed(true);

		const lastStyles = setOptions.mock.calls.at(-1)[0].styles;
		// nightModeStyles() is mocked to [] above, so assert the dim entry landed
		// alongside whatever the (empty, mocked) dark-theme base produced.
		expect(lastStyles.some((s) => s.stylers?.some((v) => 'saturation' in v))).toBe(true);
	});
});

describe('createPolyline casing', () => {
	function setupGoogleMapsForPolylines() {
		const PolylineMock = vi.fn(function GooglePolyline(options) {
			this.options = options;
			this.setMap = vi.fn();
		});
		global.google = {
			maps: {
				geometry: {
					encoding: {
						decodePath: vi.fn(() => [
							{ lat: () => 47.6, lng: () => -122.3 },
							{ lat: () => 47.61, lng: () => -122.31 }
						])
					}
				},
				importLibrary: vi.fn(async () => {}),
				Polyline: PolylineMock,
				SymbolPath: { FORWARD_CLOSED_ARROW: 1 }
			}
		};
		return { PolylineMock };
	}

	function makeProvider() {
		const provider = new GoogleMapProvider('test-key', vi.fn());
		provider.map = {};
		return provider;
	}

	test('draws a wider white casing under the colored stroke', async () => {
		setupGoogleMapsForPolylines();
		const provider = makeProvider();

		const line = await provider.createPolyline('encoded', {
			color: '#b02a37',
			casing: true,
			weight: 5
		});

		expect(line._casing).toBeTruthy();
		expect(line._casing.options.strokeColor).toBe('#ffffff');
		expect(line._casing.options.strokeWeight).toBeGreaterThan(line.options.strokeWeight);
	});

	test('gives the polyline and its casing the zIndex layer it was asked for', async () => {
		setupGoogleMapsForPolylines();
		const provider = makeProvider();

		const line = await provider.createPolyline('encoded', {
			color: '#b02a37',
			casing: true,
			pane: 'obaRoute',
			casingPane: 'obaRouteCasing'
		});

		expect(line.options.zIndex).toBe(20);
		expect(line._casing.options.zIndex).toBe(10);
	});

	// The casing must stay out of this.polylines or fitToPolylines,
	// getPolylinesCount, and _getRoutePaths all double-count it.
	test('does not track the casing in this.polylines', async () => {
		setupGoogleMapsForPolylines();
		const provider = makeProvider();

		await provider.createPolyline('encoded', { color: '#b02a37', casing: true });

		expect(provider.getPolylinesCount()).toBe(1);
	});

	test('removes the casing with its polyline', async () => {
		setupGoogleMapsForPolylines();
		const provider = makeProvider();

		const line = await provider.createPolyline('encoded', { color: '#b02a37', casing: true });
		const casing = line._casing;

		await provider.removePolyline(line);

		expect(casing.setMap).toHaveBeenCalledWith(null);
	});

	test('clearAllPolylines removes casings too', async () => {
		setupGoogleMapsForPolylines();
		const provider = makeProvider();

		const line = await provider.createPolyline('encoded', { color: '#b02a37', casing: true });
		const casing = line._casing;

		provider.clearAllPolylines();

		expect(casing.setMap).toHaveBeenCalledWith(null);
	});
});
