import { test, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

// Stub the heavy children so MapExperience mounts in jsdom. MapContainer's
// mock captures the props MapExperience passes it (incl. handleStopMarkerSelect)
// so the DataCloneError regression test below can invoke the handler directly.
let capturedMapContainerProps = null;
vi.mock('$components/MapContainer.svelte', () => ({
	default: function MapContainer(anchor, props) {
		capturedMapContainerProps = props;
		// The real MapContainer initializes a map provider on mount and binds it back
		// to the parent (bind:mapProvider). MapExperience's framing effect no-ops until
		// mapProvider is set, so supply a default stub here — tests that care about a
		// specific call can still override capturedMapContainerProps.mapProvider after
		// render.
		props.mapProvider = {
			flyTo: vi.fn(),
			highlightMarker: vi.fn(),
			unHighlightMarker: vi.fn(),
			resetStopEmphasis: vi.fn(),
			setBasemapDimmed: vi.fn(),
			cleanupInfoWindow: vi.fn(),
			clearVehicleMarkers: vi.fn(),
			clearAllPolylines: vi.fn(),
			removeStopMarkers: vi.fn()
		};
		return {};
	}
}));
vi.mock('$components/search/SearchPane.svelte', () => ({ default: () => ({}) }));
vi.mock('$components/search/CollapsedSearchField.svelte', () => ({ default: () => ({}) }));
vi.mock('$components/routes/RouteModal.svelte', () => ({ default: () => ({}) }));
vi.mock('$components/routes/ViewAllRoutesModal.svelte', () => ({ default: () => ({}) }));
vi.mock('$components/trip-planner/TripPlanModal.svelte', () => ({ default: () => ({}) }));
vi.mock('$components/trip-planner/TripOptionsModal.svelte', () => ({ default: () => ({}) }));
vi.mock('$components/surveys/SurveyModal.svelte', () => ({ default: () => ({}) }));
vi.mock('$components/surveys/SurveyLauncher.svelte', () => ({ default: () => ({}) }));
vi.mock('$components/navigation/AlertsModal.svelte', () => ({ default: () => ({}) }));

// The one child whose presence we assert on.
let capturedSheetProps = null;
vi.mock('$components/stops/StopBottomSheet.svelte', () => ({
	default: function StopBottomSheet(anchor, props) {
		capturedSheetProps = props;
		const el = document.createElement('div');
		el.setAttribute('data-testid', 'stop-bottom-sheet');
		anchor.before(el);
		return {};
	}
}));

vi.mock('$lib/vehicleUtils.js', () => ({ clearVehicleMarkersMap: vi.fn() }));

vi.mock('$app/navigation', () => ({
	pushState: vi.fn(),
	replaceState: vi.fn(),
	afterNavigate: vi.fn()
}));

// The global vitest-setup svelte-i18n mock omits isLoading, which MapExperience's
// template subscribes to; false means "loaded" so the map UI renders.
vi.mock('svelte-i18n', () => ({
	isLoading: {
		subscribe: (fn) => {
			fn(false);
			return () => {};
		}
	},
	t: {
		subscribe: (fn) => {
			fn((key) => key);
			return () => {};
		}
	},
	_: (key) => key,
	addMessages: vi.fn(),
	init: vi.fn(),
	getLocaleFromNavigator: () => 'en',
	locale: {
		subscribe: (fn) => {
			fn('en');
			return () => {};
		}
	}
}));

// Region center coords aren't in the global vitest-setup mock; MapExperience reads
// them at module init for initialCoords.
vi.mock('$env/static/public', () => ({
	PUBLIC_OBA_REGION_NAME: 'Test Region',
	PUBLIC_OBA_REGION_CENTER_LAT: '47.6',
	PUBLIC_OBA_REGION_CENTER_LNG: '-122.3'
}));

// Per-test controllable page store (overrides the global vitest-setup mock).
// A real writable, not a one-shot subscribe, so a test can simulate navigating
// away from a stop after render — which is how the teardown path is reached.
import { writable } from 'svelte/store';

// eslint-disable-next-line no-unused-vars -- write-only bookkeeping to mirror the brief's setPage() shape
let pageValue;
const pageStore = writable(undefined);
vi.mock('$app/stores', () => ({
	page: { subscribe: (fn) => pageStore.subscribe(fn) }
}));

function setPage(next) {
	pageValue = next;
	pageStore.set(next);
}

global.fetch = vi.fn(async () => ({ ok: false, status: 204 })); // loadAlerts no-op

import { pushState } from '$app/navigation';
import MapExperience from '$components/MapExperience.svelte';
import { createReactiveStop } from './support/reactiveStop.svelte.js';
import { clearVehicleMarkersMap } from '$lib/vehicleUtils.js';

const STOP = { id: '1_75403', lat: 47.6, lon: -122.3, name: 'Pine St & 3rd Ave' };

beforeEach(() => {
	vi.clearAllMocks();
});

test('renders the stop sheet when the URL is a /map/stops path', () => {
	setPage({
		url: new URL('https://example.com/map/stops/1_75403'),
		params: {},
		route: { id: '/(map)' },
		state: { stopData: STOP },
		data: {}
	});
	const { queryByTestId } = render(MapExperience);
	expect(queryByTestId('stop-bottom-sheet')).not.toBeNull();
});

test('does not render the stop sheet on /', () => {
	setPage({
		url: new URL('https://example.com/'),
		params: {},
		route: { id: '/(map)' },
		state: {},
		data: {}
	});
	const { queryByTestId } = render(MapExperience);
	expect(queryByTestId('stop-bottom-sheet')).toBeNull();
});

test('handleStopMarkerSelect snapshots reactive stopData before pushState (DataCloneError regression)', () => {
	setPage({
		url: new URL('https://example.com/'),
		params: {},
		route: { id: '/(map)' },
		state: {},
		data: {}
	});
	render(MapExperience);

	// The marker hands handleStopMarkerSelect a $state reactive proxy, not a
	// plain object. pushState structured-clones its state arg, which throws
	// DataCloneError on a proxy in real browsers (jsdom doesn't enforce this,
	// which is why the bug shipped despite passing tests).
	const reactiveStop = createReactiveStop({ ...STOP });

	capturedMapContainerProps.handleStopMarkerSelect(reactiveStop);

	expect(pushState).toHaveBeenCalledTimes(1);
	const [, state] = pushState.mock.calls[0];
	// Snapshotted: same values, but not the same reactive proxy reference.
	expect(state.stopData).toEqual(STOP);
	expect(state.stopData).not.toBe(reactiveStop);
});

function pageWithStop() {
	return {
		url: new URL('https://example.com/map/stops/1_75403'),
		params: {},
		route: { id: '/(map)' },
		state: { stopData: STOP },
		data: {}
	};
}

function pageWithoutStop() {
	return {
		url: new URL('https://example.com/'),
		params: {},
		route: { id: '/(map)' },
		state: {},
		data: {}
	};
}

test('clearing the selection resets the route flags an expanded row left behind', async () => {
	setPage(pageWithStop());
	render(MapExperience);

	// Expanding an arrival row: StopPane calls both of these.
	capturedSheetProps.tripSelected({
		detail: { tripId: 'trip_1', routeId: 'route_1', routeShortName: 'C' }
	});
	capturedSheetProps.handleUpdateRouteMap({ detail: { show: true } });
	await vi.waitFor(() => expect(capturedMapContainerProps.showRouteMap).toBe(true));

	// closePane pushes '/' — mocked, so drive the resulting page change ourselves.
	capturedSheetProps.closePane();
	setPage(pageWithoutStop());

	await vi.waitFor(() => {
		expect(capturedMapContainerProps.showRouteMap).toBe(false);
		expect(capturedMapContainerProps.isRouteSelected).toBe(false);
		expect(capturedMapContainerProps.selectedRoute).toBeNull();
		expect(capturedMapContainerProps.selectedTrip).toBeNull();
	});
});

test('clearing the selection empties the module-level vehicle marker map', async () => {
	setPage(pageWithStop());
	render(MapExperience);

	// The framing effect needs a provider before it will run its teardown.
	capturedMapContainerProps.mapProvider = {
		flyTo: vi.fn(),
		highlightMarker: vi.fn(),
		unHighlightMarker: vi.fn(),
		resetStopEmphasis: vi.fn(),
		setBasemapDimmed: vi.fn(),
		cleanupInfoWindow: vi.fn(),
		clearVehicleMarkers: vi.fn()
	};

	setPage(pageWithoutStop());

	await vi.waitFor(() => expect(clearVehicleMarkersMap).toHaveBeenCalled());
});
