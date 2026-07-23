import { test, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

// Stub the heavy children so MapExperience mounts in jsdom. MapContainer's
// mock captures the props MapExperience passes it (incl. handleStopMarkerSelect)
// so the DataCloneError regression test below can invoke the handler directly.
let capturedMapContainerProps = null;
vi.mock('$components/MapContainer.svelte', () => ({
	default: function MapContainer(anchor, props) {
		capturedMapContainerProps = props;
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
vi.mock('$components/stops/StopBottomSheet.svelte', () => ({
	default: function StopBottomSheet(anchor) {
		const el = document.createElement('div');
		el.setAttribute('data-testid', 'stop-bottom-sheet');
		anchor.before(el);
		return {};
	}
}));

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
let pageValue;
vi.mock('$app/stores', () => ({
	page: {
		subscribe: (fn) => {
			fn(pageValue);
			return () => {};
		}
	}
}));

global.fetch = vi.fn(async () => ({ ok: false, status: 204 })); // loadAlerts no-op

import { pushState } from '$app/navigation';
import MapExperience from '$components/MapExperience.svelte';
import { createReactiveStop } from './support/reactiveStop.svelte.js';

const STOP = { id: '1_75403', lat: 47.6, lon: -122.3, name: 'Pine St & 3rd Ave' };

beforeEach(() => {
	vi.clearAllMocks();
});

test('renders the stop sheet when the URL is a /map/stops path', () => {
	pageValue = {
		url: new URL('https://example.com/map/stops/1_75403'),
		params: {},
		route: { id: '/(map)' },
		state: { stopData: STOP },
		data: {}
	};
	const { queryByTestId } = render(MapExperience);
	expect(queryByTestId('stop-bottom-sheet')).not.toBeNull();
});

test('does not render the stop sheet on /', () => {
	pageValue = {
		url: new URL('https://example.com/'),
		params: {},
		route: { id: '/(map)' },
		state: {},
		data: {}
	};
	const { queryByTestId } = render(MapExperience);
	expect(queryByTestId('stop-bottom-sheet')).toBeNull();
});

test('handleStopMarkerSelect snapshots reactive stopData before pushState (DataCloneError regression)', () => {
	pageValue = {
		url: new URL('https://example.com/'),
		params: {},
		route: { id: '/(map)' },
		state: {},
		data: {}
	};
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
