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
// Captures the props MapExperience passes down (incl. handleRouteSelected) so the
// route-flag-reset regression test below can invoke it the way the app does.
let capturedSearchPaneProps = null;
vi.mock('$components/search/SearchPane.svelte', () => ({
	default: function SearchPane(anchor, props) {
		capturedSearchPaneProps = props;
		return {};
	}
}));
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

const pageStore = writable(undefined);
vi.mock('$app/stores', () => ({
	page: { subscribe: (fn) => pageStore.subscribe(fn) }
}));

function setPage(next) {
	pageStore.set(next);
}

global.fetch = vi.fn(async () => ({ ok: false, status: 204 })); // loadAlerts no-op

import { tick } from 'svelte';
import { pushState } from '$app/navigation';
import MapExperience from '$components/MapExperience.svelte';
import { createReactiveStop } from './support/reactiveStop.svelte.js';
import { clearVehicleMarkersMap } from '$lib/vehicleUtils.js';

const STOP = { id: '1_75403', lat: 47.6, lon: -122.3, name: 'Pine St & 3rd Ave' };
const STOP_B = { id: '1_99999', lat: 47.61, lon: -122.31, name: 'Other St & 4th Ave' };

// Builds a realistic /arrivals-and-departures-for-stop response. `routes` is a list
// of { id, shortName, etaMin } arrival entries (one per array element, so a route can
// appear more than once to exercise soonest-wins dedup).
function arrivalsPayload(stopId, routes) {
	const now = Date.now();
	return {
		data: {
			entry: {
				stopId,
				arrivalsAndDepartures: routes.map((r) => ({
					routeId: r.id,
					routeShortName: r.shortName,
					tripId: `trip_${r.id}_${r.etaMin}`,
					predicted: true,
					predictedArrivalTime: now + r.etaMin * 60000,
					scheduledArrivalTime: now + r.etaMin * 60000
				}))
			},
			references: {
				routes: [...new Map(routes.map((r) => [r.id, r])).values()].map((r) => ({
					id: r.id,
					shortName: r.shortName,
					type: 3,
					color: r.color ?? null
				})),
				situations: []
			}
		}
	};
}

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

test('selecting a route from an open stop sheet survives the resulting stop-close teardown', async () => {
	setPage(pageWithStop());
	render(MapExperience);

	// Mirrors handleRouteSelected: stopSheetOpen is true, so it calls pushState('/', {})
	// (mocked — doesn't itself change the page store) and then synchronously sets
	// selectedRoute / currentModal / isRouteSelected. Svelte coalesces these into one
	// effect flush together with the page-store change we drive next, which is what
	// makes the framing effect's stop-close branch run with currentModal already
	// ROUTE — the exact scenario the guard exists for.
	const route = { id: 'route_1', shortName: 'C' };
	capturedSearchPaneProps.handleRouteSelected({
		route,
		polylines: [],
		stops: [],
		currentIntervalId: null
	});

	// Simulate the navigation handleRouteSelected's pushState('/', {}) triggers: the
	// stop id goes null, which is what runs the framing effect's else branch.
	setPage(pageWithoutStop());

	// The else branch is synchronous and unconditionally calls cleanupInfoWindow near
	// its top, before the route-flag lines run — waiting for that call is proof the
	// whole branch (including the flag resets under test) has finished executing, so
	// the assertions below can't pass on a stale, pre-effect snapshot of the state.
	await vi.waitFor(() => {
		expect(capturedMapContainerProps.mapProvider.cleanupInfoWindow).toHaveBeenCalled();
	});

	expect(capturedMapContainerProps.isRouteSelected).toBe(true);
	expect(capturedMapContainerProps.selectedRoute).toEqual(route);
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

// Finding 2: the whole point of lifting stopArrivals is to feed activeRoutes and
// routeColors to MapContainer -- prove they actually arrive there, with the right
// shape, and that the arrivalsMatchSelection gate actually withholds them for a
// mismatched stop.
test('activeRoutes and routeColors reach MapContainer once a matching arrivals response lands', async () => {
	setPage(pageWithStop());
	render(MapExperience);

	// Deliberately unsorted, with a duplicate for route_a (later arrival) to prove
	// dedup keeps only the soonest.
	const payload = arrivalsPayload(STOP.id, [
		{ id: 'route_c', shortName: 'C Line', etaMin: 20 },
		{ id: 'route_a', shortName: '10', etaMin: 30 },
		{ id: 'route_a', shortName: '10', etaMin: 5 },
		{ id: 'route_b', shortName: '8', etaMin: 10 }
	]);
	capturedSheetProps.arrivalsAndDeparturesResponse = payload;

	await vi.waitFor(() => expect(capturedMapContainerProps.activeRoutes.length).toBe(3));

	// One entry per distinct route, soonest arrival first.
	expect(capturedMapContainerProps.activeRoutes.map((r) => r.id)).toEqual([
		'route_a',
		'route_b',
		'route_c'
	]);

	const colors = capturedMapContainerProps.routeColors;
	expect(colors.size).toBe(3);
	for (const route of capturedMapContainerProps.activeRoutes) {
		const routeColor = colors.get(route.id);
		expect(routeColor.line).toMatch(/^#/);
		expect(routeColor.badgeBg).toBe(routeColor.line.slice(1));
	}
});

test('activeRoutes stays empty when the arrivals payload belongs to a different stop', async () => {
	setPage(pageWithStop());
	render(MapExperience);

	// stopId doesn't match the selected stop -- arrivalsMatchSelection must withhold it.
	const payload = arrivalsPayload(STOP_B.id, [{ id: 'route_a', shortName: '10', etaMin: 5 }]);
	capturedSheetProps.arrivalsAndDeparturesResponse = payload;

	await tick();

	expect(capturedMapContainerProps.activeRoutes).toEqual([]);
});

// Finding 1: switching stop A -> stop B used to null stopArrivals immediately, which
// emptied StopPane's routeById derived (fed from arrivalsAndDeparturesResponse) while
// its rendered rows -- a one-time $state seed -- stayed put showing A's rows. Result:
// A's badges flashed to RouteBadge's hardcoded gray for the ~300ms until B's arrivals
// landed. routeColors (what actually reaches the badges) must hold steady across that
// gap even though the map's activeRoutes is correctly withheld in the meantime.
test('routeColors does not go blank when the stop changes before the new arrivals land', async () => {
	setPage(pageWithStop());
	render(MapExperience);

	const payload = arrivalsPayload(STOP.id, [{ id: 'route_a', shortName: '10', etaMin: 5 }]);
	capturedSheetProps.arrivalsAndDeparturesResponse = payload;

	await vi.waitFor(() => expect(capturedMapContainerProps.routeColors.get('route_a')).toBeTruthy());
	const colorBefore = capturedMapContainerProps.routeColors.get('route_a');

	// Tap stop B. Its arrivals haven't fetched yet, so stopArrivals still holds A's
	// response -- which no longer matches the (now B) selection.
	setPage({
		url: new URL('https://example.com/map/stops/1_99999'),
		params: {},
		route: { id: '/(map)' },
		state: { stopData: STOP_B },
		data: {}
	});
	await tick();

	// The map is correctly withheld from drawing A's route around B's marker...
	expect(capturedMapContainerProps.activeRoutes).toEqual([]);
	// ...but the sheet is still showing A's rows, so A's badge color must not vanish.
	expect(capturedMapContainerProps.routeColors.get('route_a')).toEqual(colorBefore);
});
