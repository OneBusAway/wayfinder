import { describe, test, expect, vi, beforeEach } from 'vitest';
import OpenStreetMapProvider from '$lib/Provider/OpenStreetMapProvider.svelte.js';

// Minimal Svelte component stubs — only imported by the module, never called
// during these unit tests because we mock openStopMarker directly and never
// trigger popupopen events.
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

// updateVehicleMarker animates the marker to its new position via animateMarkerTo
// (a requestAnimationFrame loop). Stub it out so these unit tests exercise only the
// accessibility bookkeeping, not the real animation.
vi.mock('$lib/MapHelpers/animateMarker', () => ({
	animateMarkerTo: vi.fn(),
	cancelMarkerAnimation: vi.fn()
}));

// addMarker() bails early unless browser is true, and mounts the StopMarker
// component. Force browser on and stub mount/unmount (the $state rune compiles
// to svelte/internal/client, so it is unaffected by mocking the top-level module).
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('svelte', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, mount: vi.fn(), unmount: vi.fn() };
});

// Local mock so getVehicleLabel resolves real strings with {headsign} interpolation.
vi.mock('svelte-i18n', () => {
	const translations = {
		'vehicle.label': 'Vehicle',
		'vehicle.to_headsign': 'Vehicle to {headsign}'
	};
	const translate = (key, options) => {
		let str = translations[key] ?? key;
		for (const [k, v] of Object.entries(options?.values ?? {})) {
			str = str.replace(`{${k}}`, v);
		}
		return str;
	};
	return {
		t: {
			subscribe: (fn) => {
				fn(translate);
				return () => {};
			}
		}
	};
});

function makeFakeMarker() {
	const el = document.createElement('div');
	return {
		_el: el,
		vehicleData: {},
		options: {},
		getElement: vi.fn(() => el),
		getLatLng: vi.fn(() => ({ lat: 47.6, lng: -122.3 })),
		addTo: vi.fn().mockReturnThis(),
		on: vi.fn(),
		bindPopup: vi.fn().mockReturnThis(),
		openPopup: vi.fn(),
		setLatLng: vi.fn(),
		setIcon: vi.fn()
	};
}

function makeFakeL(fakeMarker) {
	return {
		divIcon: vi.fn(() => ({})),
		marker: vi.fn(() => fakeMarker)
	};
}

const STOP = { id: 'stop_1', name: 'Market & Main', lat: 47.6, lon: -122.3 };
const VEHICLE = {
	position: { lat: 47.6, lon: -122.3 },
	vehicleId: 'v1',
	lastUpdateTime: 0,
	nextStop: 'stop_1',
	predicted: true,
	orientation: 90
};

describe('addStopRouteMarker — keyboard activation', () => {
	let provider;
	let fakeMarker;

	beforeEach(() => {
		fakeMarker = makeFakeMarker();
		provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(fakeMarker);
		provider.map = {};
		vi.spyOn(provider, 'openStopMarker').mockImplementation(() => {});
	});

	test('Enter key calls openStopMarker', () => {
		provider.addStopRouteMarker(STOP);

		const el = fakeMarker._el;
		const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		vi.spyOn(event, 'preventDefault');
		el.dispatchEvent(event);

		expect(provider.openStopMarker).toHaveBeenCalledOnce();
		expect(provider.openStopMarker).toHaveBeenCalledWith(STOP, null);
		expect(event.preventDefault).toHaveBeenCalled();
	});

	test('Space key calls openStopMarker and prevents page scroll', () => {
		provider.addStopRouteMarker(STOP);

		const el = fakeMarker._el;
		const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
		vi.spyOn(event, 'preventDefault');
		el.dispatchEvent(event);

		expect(provider.openStopMarker).toHaveBeenCalledOnce();
		expect(provider.openStopMarker).toHaveBeenCalledWith(STOP, null);
		expect(event.preventDefault).toHaveBeenCalled();
	});

	test('other keys do not activate the marker', () => {
		provider.addStopRouteMarker(STOP);

		const el = fakeMarker._el;
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

		expect(provider.openStopMarker).not.toHaveBeenCalled();
	});

	test('marker element gets aria-label set to stop name', () => {
		provider.addStopRouteMarker(STOP);

		expect(fakeMarker._el.getAttribute('aria-label')).toBe(STOP.name);
	});
});

describe('addMarker — primary stop markers', () => {
	let provider;
	let fakeMarker;

	beforeEach(() => {
		fakeMarker = makeFakeMarker();
		provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(fakeMarker);
		provider.map = { getZoom: () => 16 };
	});

	// Regression guard: dropping keyboard:false makes Leaflet stamp tabindex="0" + role="button" onto the wrapper div that holds StopMarker's own real <button>, producing nested interactive controls plus a dead, unlabeled second tab stop on every stop marker.
	test('passes interactive:false and keyboard:false to the Leaflet marker', () => {
		provider.addMarker({
			stop: { id: 's1', name: 'Main St', routes: [] },
			position: { lat: 47.6, lng: -122.3 }
		});

		expect(provider.L.marker).toHaveBeenCalledOnce();
		const options = provider.L.marker.mock.calls[0][1];
		expect(options.interactive).toBe(false);
		expect(options.keyboard).toBe(false);
	});
});

describe('addVehicleMarker — accessible label', () => {
	let provider;
	let fakeMarker;

	beforeEach(() => {
		fakeMarker = makeFakeMarker();
		provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(fakeMarker);
		provider.map = {};
	});

	test('"Vehicle to <headsign>" when trip has a headsign', () => {
		const activeTrip = { tripHeadsign: 'Northgate' };
		provider.addVehicleMarker(VEHICLE, activeTrip, 3);

		expect(fakeMarker._el.getAttribute('aria-label')).toBe('Vehicle to Northgate');
	});

	test('"Vehicle" fallback when trip has no headsign', () => {
		const activeTrip = { tripHeadsign: null };
		provider.addVehicleMarker(VEHICLE, activeTrip, 3);

		expect(fakeMarker._el.getAttribute('aria-label')).toBe('Vehicle');
	});

	test('"Vehicle" fallback when activeTrip has no headsign (empty object)', () => {
		provider.addVehicleMarker(VEHICLE, {}, 3);

		expect(fakeMarker._el.getAttribute('aria-label')).toBe('Vehicle');
	});

	test('re-applies the aria-label after setIcon on update', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3);
		expect(fakeMarker._el.getAttribute('aria-label')).toBe('Vehicle to Northgate');

		provider.updateVehicleMarker(fakeMarker, VEHICLE, { tripHeadsign: 'Downtown' }, 3);

		expect(fakeMarker.setIcon).toHaveBeenCalled();
		expect(fakeMarker._el.getAttribute('aria-label')).toBe('Vehicle to Downtown');
	});

	test('re-applies the title tooltip after setIcon on update', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3);

		provider.updateVehicleMarker(fakeMarker, VEHICLE, { tripHeadsign: 'Downtown' }, 3);

		expect(fakeMarker._el.getAttribute('title')).toBe('Vehicle to Downtown');
		expect(fakeMarker.options.title).toBe('Vehicle to Downtown');
	});
});

describe('addVehicleMarker — keyboard activation', () => {
	let provider;
	let fakeMarker;

	beforeEach(() => {
		fakeMarker = makeFakeMarker();
		provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(fakeMarker);
		provider.map = {};
	});

	test('Enter opens the vehicle popup', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3);

		const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		vi.spyOn(event, 'preventDefault');
		fakeMarker._el.dispatchEvent(event);

		expect(fakeMarker.openPopup).toHaveBeenCalledOnce();
		expect(event.preventDefault).toHaveBeenCalled();
	});

	test('Space opens the vehicle popup and prevents page scroll', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3);

		const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
		vi.spyOn(event, 'preventDefault');
		fakeMarker._el.dispatchEvent(event);

		expect(fakeMarker.openPopup).toHaveBeenCalledOnce();
		expect(event.preventDefault).toHaveBeenCalled();
	});

	test('other keys do not open the popup', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3);

		fakeMarker._el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

		expect(fakeMarker.openPopup).not.toHaveBeenCalled();
	});
});
