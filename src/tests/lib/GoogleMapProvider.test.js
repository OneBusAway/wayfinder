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
