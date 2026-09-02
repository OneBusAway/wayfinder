import { describe, test, expect, vi, beforeEach } from 'vitest';
import OpenStreetMapProvider, {
	toLeafletPadding
} from '$lib/Provider/OpenStreetMapProvider.svelte.js';
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';

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

vi.mock('polyline-encoded', () => ({
	default: {
		decode: vi.fn(() => [
			[47.6, -122.3],
			[47.61, -122.31]
		])
	}
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
		setIcon: vi.fn(),
		setZIndexOffset: vi.fn()
	};
}

function makeFakeL(fakeMarker) {
	return {
		divIcon: vi.fn(() => ({})),
		marker: vi.fn(() => fakeMarker),
		Polyline: vi.fn(function FakePolyline(latlngs, options) {
			this.options = options;
			this.addTo = vi.fn().mockReturnThis();
			this.remove = vi.fn();
			this.getLatLngs = vi.fn(() => latlngs);
			this.getBounds = vi.fn(() => ({}));
		}),
		polylineDecorator: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
		Symbol: { arrowHead: vi.fn(() => ({})) }
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

	test('does not set aria-label when stop name is missing', () => {
		provider.addStopRouteMarker({ ...STOP, name: undefined });

		expect(fakeMarker._el.hasAttribute('aria-label')).toBe(false);
	});

	test('warns when marker element is unavailable during accessibility setup', () => {
		fakeMarker.getElement.mockReturnValue(null);
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		provider.addStopRouteMarker(STOP);

		expect(warnSpy).toHaveBeenCalledWith(
			'OpenStreetMapProvider: marker DOM element unavailable during stop route marker accessibility setup'
		);
		warnSpy.mockRestore();
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

	// divIcon ignores zIndexOffset, so the stacking order must be updated on the
	// marker itself to reflect the current highlight state on refresh.
	test('raises the z-index offset when highlighted on update', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3);

		provider.updateVehicleMarker(fakeMarker, VEHICLE, { tripHeadsign: 'Downtown' }, 3, true);
		expect(fakeMarker.setZIndexOffset).toHaveBeenLastCalledWith(2000);

		provider.updateVehicleMarker(fakeMarker, VEHICLE, { tripHeadsign: 'Downtown' }, 3, false);
		expect(fakeMarker.setZIndexOffset).toHaveBeenLastCalledWith(1000);
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

	test('warns when vehicle marker element is unavailable during accessibility setup', () => {
		fakeMarker.getElement.mockReturnValue(null);
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3);

		expect(warnSpy).toHaveBeenCalledWith(
			'OpenStreetMapProvider: marker DOM element unavailable during vehicle marker accessibility setup'
		);
		warnSpy.mockRestore();
	});
});

describe('removeVehicleMarker — marker tracking', () => {
	let provider;
	let fakeMarker;

	beforeEach(() => {
		fakeMarker = makeFakeMarker();
		fakeMarker.remove = vi.fn();
		provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(fakeMarker);
		provider.map = {};
	});

	test('removes the marker from vehicleMarkers after removal', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3);
		expect(provider.vehicleMarkers).toHaveLength(1);

		provider.removeVehicleMarker(provider.vehicleMarkers[0]);

		expect(fakeMarker.remove).toHaveBeenCalledOnce();
		expect(provider.vehicleMarkers).toHaveLength(0);
	});
});

describe('addVehicleMarker — route color', () => {
	let provider;

	beforeEach(() => {
		provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(makeFakeMarker());
		provider.map = {};
		createVehicleIconSvg.mockClear();
	});

	test('passes the route color to the icon for a predicted vehicle', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3, false, '#0a4ea2');
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, '#0a4ea2', 3, false, false);
	});

	test('gray override still wins for a non-predicted vehicle', () => {
		provider.addVehicleMarker(
			{ ...VEHICLE, predicted: false },
			{ tripHeadsign: 'Northgate' },
			3,
			false,
			'#0a4ea2'
		);
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, '#808080', 3, false, false);
	});

	test('null route color falls back to the icon default', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3, false, null);
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, undefined, 3, false, false);
	});

	test('passes the current dark-map state to the icon', () => {
		provider._darkTheme = true;
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3);
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, undefined, 3, false, true);
	});
});

describe('setTheme — avoids redundant layer rebuilds', () => {
	let provider;
	let removeLayer;

	beforeEach(() => {
		provider = new OpenStreetMapProvider(vi.fn());
		removeLayer = vi.fn();
		provider.map = { removeLayer };
		provider.L = {
			maplibreGL: vi.fn(() => ({ addTo: vi.fn().mockReturnThis() }))
		};
		// Simulate post-initMap state: the light (positron) style is applied.
		provider.currentStyleUrl = 'https://tiles.openfreemap.org/styles/positron';
		provider.maplibreLayer = { existing: true };
	});

	// Regression guard: onMount dispatches a themeChange right after initMap, so
	// setTheme is called with the theme that already matches the boot style. If it
	// rebuilds the layer, MapLibre re-fetches the style/sprites/fonts/tiles and the
	// whole map loads over the network twice.
	test('does not rebuild the layer when the style is unchanged', () => {
		provider.setTheme('light');

		expect(removeLayer).not.toHaveBeenCalled();
		expect(provider.L.maplibreGL).not.toHaveBeenCalled();
		expect(provider.currentStyleUrl).toBe('https://tiles.openfreemap.org/styles/positron');
	});

	test('rebuilds with the new style when the theme actually changes', () => {
		provider.setTheme('dark');

		expect(removeLayer).toHaveBeenCalledWith({ existing: true });
		expect(provider.L.maplibreGL).toHaveBeenCalledWith({
			style: 'https://tiles.openfreemap.org/styles/dark'
		});
		expect(provider.currentStyleUrl).toBe('https://tiles.openfreemap.org/styles/dark');
	});

	test('a repeated switch to the same theme is a no-op after the first change', () => {
		provider.setTheme('dark');
		provider.L.maplibreGL.mockClear();
		removeLayer.mockClear();

		provider.setTheme('dark');

		expect(removeLayer).not.toHaveBeenCalled();
		expect(provider.L.maplibreGL).not.toHaveBeenCalled();
	});

	test('refreshes existing vehicle icons for the new theme', () => {
		const marker = {
			vehicleIconOptions: {
				orientation: 90,
				color: '#007BFF',
				routeType: 3,
				isHighlighted: false
			},
			setIcon: vi.fn()
		};
		provider.L.divIcon = vi.fn(() => ({}));
		provider.vehicleMarkers = [marker];

		provider.setTheme('dark');

		expect(createVehicleIconSvg).toHaveBeenLastCalledWith(90, '#007BFF', 3, false, true);
		expect(marker.setIcon).toHaveBeenCalledOnce();
	});

	test('bails out before the map is initialized', () => {
		provider.map = null;
		provider.setTheme('dark');

		expect(provider.L.maplibreGL).not.toHaveBeenCalled();
	});
});

describe('flyTo — vertical offset for the bottom sheet', () => {
	let provider;

	beforeEach(() => {
		provider = new OpenStreetMapProvider(vi.fn());
	});

	test('centers on the raw coordinates when no offset is given', () => {
		const flyTo = vi.fn();
		provider.map = { flyTo, getSize: vi.fn(), project: vi.fn(), unproject: vi.fn() };

		provider.flyTo(47.6, -122.3, 16);

		expect(flyTo).toHaveBeenCalledWith([47.6, -122.3], 16, { animate: true });
		expect(provider.map.project).not.toHaveBeenCalled();
	});

	test('offsetY shifts the target up by a fraction of the viewport height', () => {
		// Marker projects to pixel (100, 300) at zoom 16; the 800px-tall viewport
		// and offsetY 0.25 should push the map center 200px south so the marker
		// lands ~25% down from the top instead of dead center.
		const point = { x: 100, y: 300 };
		const shiftedCenter = { lat: 47.5, lng: -122.3 };
		const project = vi.fn(() => point);
		const unproject = vi.fn(() => shiftedCenter);
		const flyTo = vi.fn();
		provider.map = { flyTo, getSize: vi.fn(() => ({ y: 800 })), project, unproject };

		provider.flyTo(47.6, -122.3, 16, { offsetY: 0.25 });

		expect(project).toHaveBeenCalledWith([47.6, -122.3], 16);
		expect(point.y).toBe(500);
		expect(unproject).toHaveBeenCalledWith(point, 16);
		expect(flyTo).toHaveBeenCalledWith(shiftedCenter, 16, { animate: true });
	});
});

describe('addUserLocationMarker — one marker, repositioned', () => {
	let provider;
	let circleMarker;
	let removeLayer;

	beforeEach(() => {
		circleMarker = vi.fn(() => ({
			addTo: vi.fn().mockReturnThis(),
			setLatLng: vi.fn()
		}));
		removeLayer = vi.fn();
		provider = new OpenStreetMapProvider(vi.fn());
		provider.L = { circleMarker };
		provider.map = { removeLayer };
	});

	test('creates the marker on the first call', () => {
		const marker = provider.addUserLocationMarker({ lat: 47.6, lng: -122.3 });

		expect(circleMarker).toHaveBeenCalledOnce();
		expect(circleMarker.mock.calls[0][0]).toEqual([47.6, -122.3]);
		expect(marker.addTo).toHaveBeenCalledWith(provider.map);
		expect(provider.userLocationMarker).toBe(marker);
	});

	test('moves the existing marker instead of stacking a second one', () => {
		const first = provider.addUserLocationMarker({ lat: 47.6, lng: -122.3 });
		const second = provider.addUserLocationMarker({ lat: 47.5, lng: -122.4 });

		expect(circleMarker).toHaveBeenCalledOnce();
		expect(second).toBe(first);
		expect(first.setLatLng).toHaveBeenCalledWith([47.5, -122.4]);
	});

	test('removeUserLocationMarker drops the layer and clears the reference', () => {
		const marker = provider.addUserLocationMarker({ lat: 47.6, lng: -122.3 });

		provider.removeUserLocationMarker();

		expect(removeLayer).toHaveBeenCalledWith(marker);
		expect(provider.userLocationMarker).toBeNull();
	});

	test('removeUserLocationMarker is a no-op when no marker exists', () => {
		provider.removeUserLocationMarker();

		expect(removeLayer).not.toHaveBeenCalled();
	});
});

describe('revealPolylines', () => {
	function fakePolyline() {
		const path = {
			style: {},
			getTotalLength: () => 100,
			getBoundingClientRect: () => ({})
		};
		return { _path: path, addTo: vi.fn(), remove: vi.fn() };
	}

	test('animates only the polylines passed in `only`', () => {
		const provider = new OpenStreetMapProvider(vi.fn());
		const a = fakePolyline();
		const b = fakePolyline();
		provider.map = { hasLayer: () => true, removeLayer: vi.fn() };
		provider.polylines = [a, b];

		provider.revealPolylines({ only: [a] });

		expect(a._path.style.strokeDashoffset).toBe('0');
		expect(b._path.style.strokeDashoffset).toBeUndefined();
	});

	test('animates a polyline casing alongside its polyline', () => {
		const provider = new OpenStreetMapProvider(vi.fn());
		const line = fakePolyline();
		line._casing = fakePolyline();
		provider.map = { hasLayer: () => true, removeLayer: vi.fn() };
		provider.polylines = [line];

		provider.revealPolylines({ only: [line] });

		expect(line._casing._path.style.strokeDashoffset).toBe('0');
	});

	test('does not move the camera, but still runs the reveal', () => {
		const provider = new OpenStreetMapProvider(vi.fn());
		const line = fakePolyline();
		const flyToBounds = vi.fn();
		provider.map = { hasLayer: () => true, removeLayer: vi.fn(), flyToBounds };
		provider.polylines = [line];

		provider.revealPolylines({ only: [line] });

		expect(flyToBounds).not.toHaveBeenCalled();
		expect(line._path.style.strokeDashoffset).toBe('0');
	});

	test('an empty `only` array animates nothing', () => {
		const provider = new OpenStreetMapProvider(vi.fn());
		const a = fakePolyline();
		const b = fakePolyline();
		provider.map = { hasLayer: () => true, removeLayer: vi.fn() };
		provider.polylines = [a, b];

		provider.revealPolylines({ only: [] });

		expect(a._path.style.strokeDashoffset).toBeUndefined();
		expect(b._path.style.strokeDashoffset).toBeUndefined();
	});

	test('omitting `only` animates every tracked polyline', () => {
		const provider = new OpenStreetMapProvider(vi.fn());
		const a = fakePolyline();
		const b = fakePolyline();
		provider.map = { hasLayer: () => true, removeLayer: vi.fn() };
		provider.polylines = [a, b];

		provider.revealPolylines();

		expect(a._path.style.strokeDashoffset).toBe('0');
		expect(b._path.style.strokeDashoffset).toBe('0');
	});

	test('a second reveal call clears the prior pending draw timeout for the same polyline', () => {
		vi.useFakeTimers();
		const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
		try {
			const provider = new OpenStreetMapProvider(vi.fn());
			const line = fakePolyline();
			provider.map = { hasLayer: () => true, removeLayer: vi.fn() };
			provider.polylines = [line];

			provider.revealPolylines({ only: [line] });
			const firstTimeoutId = line._drawTimeoutId;
			expect(firstTimeoutId).toBeDefined();

			provider.revealPolylines({ only: [line] });
			const secondTimeoutId = line._drawTimeoutId;

			expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimeoutId);
			expect(secondTimeoutId).not.toBe(firstTimeoutId);

			// Only one timer should still be outstanding: advancing time should
			// only ever fire once more (the second, still-pending timer), not
			// throw or double-fire against a torn-down node.
			expect(vi.getTimerCount()).toBe(1);
		} finally {
			clearTimeoutSpy.mockRestore();
			vi.useRealTimers();
		}
	});
});

describe('stop emphasis', () => {
	function providerWithMarkers(entries) {
		const provider = new OpenStreetMapProvider(vi.fn());
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

	// GoogleMapProvider.addStopRouteMarker writes bare google.maps.Marker objects
	// into markersMap; those have no reactive props to mutate.
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

describe('setBasemapDimmed', () => {
	test('toggles the dim class on the map container', () => {
		const provider = new OpenStreetMapProvider(vi.fn());
		const container = document.createElement('div');
		provider.map = { getContainer: () => container };

		provider.setBasemapDimmed(true);
		expect(container.classList.contains('oba-dim-basemap')).toBe(true);

		provider.setBasemapDimmed(false);
		expect(container.classList.contains('oba-dim-basemap')).toBe(false);
	});
});

describe('createPolyline casing', () => {
	function makeProvider() {
		const provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(makeFakeMarker());
		provider.map = { hasLayer: () => true, removeLayer: vi.fn() };
		return provider;
	}

	test('draws a wider white casing under the colored stroke', () => {
		const provider = makeProvider();
		const line = provider.createPolyline('encoded', { color: '#b02a37', casing: true, weight: 5 });

		expect(line._casing).toBeTruthy();
		expect(line._casing.options.color).toBe('#ffffff');
		expect(line._casing.options.weight).toBeGreaterThan(line.options.weight);
	});

	test('gives the polyline and its casing the panes it was asked for', () => {
		const provider = makeProvider();
		const line = provider.createPolyline('encoded', {
			color: '#b02a37',
			casing: true,
			pane: 'obaRoute',
			casingPane: 'obaRouteCasing'
		});

		expect(line.options.pane).toBe('obaRoute');
		expect(line._casing.options.pane).toBe('obaRouteCasing');
	});

	// Without this the arrow decorator builds its polyline in overlayPane (400),
	// below the casings at 402, and every arrow vanishes under a white stroke.
	test('draws the arrow decorator in the same pane as its polyline', () => {
		const provider = makeProvider();
		provider.createPolyline('encoded', { color: '#b02a37', pane: 'obaRoute' });

		const decoratorOptions = provider.L.polylineDecorator.mock.calls[0][1];
		expect(decoratorOptions.patterns[0].symbol).toBeDefined();
		expect(provider.L.Symbol.arrowHead.mock.calls[0][0].pathOptions.pane).toBe('obaRoute');
	});

	// The casing must stay out of this.polylines or fitToPolylines,
	// getPolylinesCount, and _getRoutePaths all double-count it.
	test('does not track the casing in this.polylines', () => {
		const provider = makeProvider();
		provider.createPolyline('encoded', { color: '#b02a37', casing: true });
		expect(provider.getPolylinesCount()).toBe(1);
	});

	test('removes the casing with its polyline', () => {
		const provider = makeProvider();
		const line = provider.createPolyline('encoded', { color: '#b02a37', casing: true });
		const casing = line._casing;
		provider.removePolyline(line);
		expect(casing.remove).toHaveBeenCalled();
	});

	test('clearAllPolylines removes casings too', () => {
		const provider = makeProvider();
		const line = provider.createPolyline('encoded', { color: '#b02a37', casing: true });
		const casing = line._casing;
		provider.clearAllPolylines();
		expect(casing.remove).toHaveBeenCalled();
	});
});

describe('setPolylineLayer', () => {
	function makeProvider() {
		const provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(makeFakeMarker());
		provider.map = { hasLayer: () => true, removeLayer: vi.fn() };
		return provider;
	}

	test('moves the polyline to the new pane', () => {
		const provider = makeProvider();
		const line = provider.createPolyline('encoded', { color: '#b02a37', pane: 'obaRoute' });

		provider.setPolylineLayer(line, 'obaRoutePromoted');

		expect(line.remove).toHaveBeenCalledOnce();
		expect(line.options.pane).toBe('obaRoutePromoted');
		// addTo is called once by createPolyline, then again by setPolylineLayer.
		expect(line.addTo).toHaveBeenCalledTimes(2);
		expect(line.addTo).toHaveBeenLastCalledWith(provider.map);
	});

	// Path.beforeAdd resolves the renderer from options.pane once, at add time.
	// SVG._initPath then creates a brand-new <path> on that add, discarding any
	// in-flight reveal transition — so a pending draw-reveal timer must not
	// later fire against the now-dead node.
	test('clears a pending draw-reveal timeout before re-adding', () => {
		const provider = makeProvider();
		const line = provider.createPolyline('encoded', { color: '#b02a37', pane: 'obaRoute' });
		line._drawTimeoutId = 1234;
		const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

		provider.setPolylineLayer(line, 'obaRoutePromoted');

		expect(clearTimeoutSpy).toHaveBeenCalledWith(1234);
		expect(line._drawTimeoutId).toBeNull();
		clearTimeoutSpy.mockRestore();
	});

	// The arrow decorator bakes `pane` into its Symbol.arrowHead pathOptions at
	// construction time, so re-assigning options.pane on the existing decorator
	// wouldn't move its arrows — it has to be rebuilt from scratch.
	test('recreates the arrow decorator in the new pane rather than re-paning the old one', () => {
		const provider = makeProvider();
		const line = provider.createPolyline('encoded', { color: '#b02a37', pane: 'obaRoute' });
		const originalDecorator = line.arrowDecorator;
		expect(originalDecorator).toBeTruthy();

		provider.setPolylineLayer(line, 'obaRoutePromoted');

		expect(originalDecorator.remove).toHaveBeenCalledOnce();
		expect(line.arrowDecorator).not.toBe(originalDecorator);
		const lastPathOptions = provider.L.Symbol.arrowHead.mock.calls.at(-1)[0].pathOptions;
		expect(lastPathOptions.pane).toBe('obaRoutePromoted');
	});

	// Must use layer.remove(), not provider.removePolyline() — that helper also
	// splices the layer out of this.polylines, and addTo() doesn't push it back
	// in, so a later clearAllPolylines() would leak the layer.
	test('does not remove the polyline from the tracked polylines list', () => {
		const provider = makeProvider();
		provider.createPolyline('encoded', { color: '#b02a37', pane: 'obaRoute' });
		const line = provider.polylines[0];

		provider.setPolylineLayer(line, 'obaRoutePromoted');

		expect(provider.getPolylinesCount()).toBe(1);
	});

	test('leaves the casing in its own pane', () => {
		const provider = makeProvider();
		const line = provider.createPolyline('encoded', {
			color: '#b02a37',
			casing: true,
			pane: 'obaRoute',
			casingPane: 'obaRouteCasing'
		});

		provider.setPolylineLayer(line, 'obaRoutePromoted');

		expect(line._casing.options.pane).toBe('obaRouteCasing');
	});

	test('is a no-op with no map', () => {
		const provider = makeProvider();
		const line = provider.createPolyline('encoded', { color: '#b02a37', pane: 'obaRoute' });
		line.remove.mockClear();
		line.addTo.mockClear();
		provider.map = null;

		expect(() => provider.setPolylineLayer(line, 'obaRoutePromoted')).not.toThrow();
		expect(line.remove).not.toHaveBeenCalled();
		expect(line.addTo).not.toHaveBeenCalled();
	});

	test('is a no-op with no polyline', () => {
		const provider = makeProvider();
		expect(() => provider.setPolylineLayer(null, 'obaRoutePromoted')).not.toThrow();
	});
});

describe('toLeafletPadding / fitToPolylines padding', () => {
	test('object padding becomes paddingTopLeft / paddingBottomRight', () => {
		expect(toLeafletPadding({ top: 10, right: 20, bottom: 30, left: 40 })).toEqual({
			paddingTopLeft: [40, 10],
			paddingBottomRight: [20, 30]
		});
	});

	test('array and number forms still pass through', () => {
		expect(toLeafletPadding([12, 24])).toEqual({ padding: [12, 24] });
		expect(toLeafletPadding(50)).toEqual({ padding: [50, 50] });
		expect(toLeafletPadding(null)).toEqual({ padding: [50, 50] });
	});

	test('fitToPolylines forwards object padding to flyToBounds', async () => {
		const provider = new OpenStreetMapProvider(vi.fn());
		const flyToBounds = vi.fn();
		const bounds = {
			isValid: () => true,
			extend: vi.fn()
		};
		provider.L = {
			latLngBounds: vi.fn(() => bounds)
		};
		provider.map = {
			flyToBounds,
			once: vi.fn(),
			hasLayer: () => false,
			removeLayer: vi.fn()
		};
		provider.polylines = [{ getBounds: () => ({}) }];
		provider._setPolylinesVisible = vi.fn();
		provider.revealPolylines = vi.fn();

		const fitPromise = provider.fitToPolylines({
			padding: { top: 10, right: 20, bottom: 300, left: 40 },
			duration: 0
		});
		const moveend = provider.map.once.mock.calls.find((c) => c[0] === 'moveend');
		expect(moveend).toBeTruthy();
		moveend[1]();
		await fitPromise;

		expect(flyToBounds).toHaveBeenCalledWith(
			bounds,
			expect.objectContaining({
				paddingTopLeft: [40, 10],
				paddingBottomRight: [20, 300]
			})
		);
	});
});
