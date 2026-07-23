# Shareable `/map/stops/{id}` Deep Links — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the map a real, shareable URL for an open stop (`/map/stops/{id}`) that reopens the same stop on the map, framed exactly as an in-app marker tap frames it.

**Architecture:** Move the map into a `(map)` route-group layout so it stays mounted across `/` ↔ `/map/stops/{id}`. A marker tap uses shallow `pushState` (instant, no fetch); cold loads/shares use a server `load`. The open stop is derived from the URL path, so both entry paths share one code path.

**Tech Stack:** SvelteKit 2.8.4 (shallow routing via `$app/navigation`, `$page` from `$app/stores`), Svelte 5 runes, Vitest + `@testing-library/svelte`, Leaflet/Google map providers.

## Global Constraints

- SvelteKit **2.8.4** — read shallow-routing state via **`$page.state` from `$app/stores`** (the `$app/state` `page.state` API needs 2.12+). Do not import `$app/state`.
- `pushState(url, state)` — **`state` is a required second argument.** Use `pushState('/', {})`, never `pushState('/')`.
- No `preloadData` / `data-sveltekit-preload-data` for marker taps — the marker already carries the stop object; push it straight into `page.state`.
- Reuse the existing `flyTo(lat, lon, zoom, { offsetY, animate })` — `offsetY` is `0.25` below the `md` (768px) breakpoint, else `0` (desktop uses a side-panel sheet).
- Open/closed is decided by the pathname-derived `selectedStopId`/`stopSheetOpen` — **never** gate UI on `selectedStopData` truthiness (it can be stale after close on a cold-loaded page).
- Standalone `/stops/{id}` and `/stops/{id}/schedule` pages stay **unchanged**; the sheet's "View Details" link still points to `/stops/{id}`.
- Run tests with `npx vitest run <path>` (not `npm run test`, which watches).

**Spec:** `docs/superpowers/specs/2026-07-22-map-stop-deep-links-design.md`

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/mapStopUrl.js` (create) | Pure URL helpers: `mapStopPath(id)`, `stopIdFromPath(pathname)` |
| `src/lib/__tests__/mapStopUrl.test.js` (create) | Unit tests for the helpers |
| `src/app.d.ts` (modify) | `App.PageState` type for `pushState`/`page.state` |
| `src/components/MapExperience.svelte` (create; moved from `+page.svelte`) | The persistent map shell + URL-driven stop selection |
| `src/routes/+page.svelte` (delete) | Replaced by the `(map)` group |
| `src/routes/(map)/+layout.svelte` (create) | Owns/renders `MapExperience` once; persists across children |
| `src/routes/(map)/+page.svelte` (create) | `/` — idle map, no stop |
| `src/routes/(map)/map/stops/[stopID]/+page.server.js` (create) | Cold-load `load`: fetch the stop entry |
| `src/routes/(map)/map/stops/[stopID]/+page.svelte` (create) | Minimal; `<svelte:head>` title/meta for shares |
| `src/tests/routes/mapStopLoad.test.js` (create) | Unit test for the loader |
| `src/components/__tests__/MapExperience.test.js` (create) | Sheet visibility follows the URL |

---

## Task 1: URL helpers (`mapStopPath` / `stopIdFromPath`)

**Files:**
- Create: `src/lib/mapStopUrl.js`
- Test: `src/lib/__tests__/mapStopUrl.test.js`

**Interfaces:**
- Produces:
  - `mapStopPath(id: string): string` — returns `/map/stops/<encoded id>`
  - `stopIdFromPath(pathname: string): string | null` — returns the decoded stop id when `pathname` matches `/map/stops/<id>`, else `null`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/mapStopUrl.test.js
import { describe, test, expect } from 'vitest';
import { mapStopPath, stopIdFromPath } from '$lib/mapStopUrl.js';

describe('mapStopPath', () => {
	test('builds the map stop path with an encoded id', () => {
		expect(mapStopPath('1_75403')).toBe('/map/stops/1_75403');
		// agency-prefixed ids can contain characters worth encoding
		expect(mapStopPath('40_100 200')).toBe('/map/stops/40_100%20200');
	});
});

describe('stopIdFromPath', () => {
	test('extracts and decodes the id from a map stop path', () => {
		expect(stopIdFromPath('/map/stops/1_75403')).toBe('1_75403');
		expect(stopIdFromPath('/map/stops/40_100%20200')).toBe('40_100 200');
	});

	test('returns null for non-map-stop paths', () => {
		expect(stopIdFromPath('/')).toBeNull();
		expect(stopIdFromPath('/stops/1_75403')).toBeNull(); // standalone page, not ours
		expect(stopIdFromPath('/map/stops')).toBeNull();
		expect(stopIdFromPath('/map/stops/')).toBeNull();
		expect(stopIdFromPath('/map/stops/1_75403/extra')).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/mapStopUrl.test.js`
Expected: FAIL — `Failed to resolve import '$lib/mapStopUrl.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/mapStopUrl.js

/**
 * Path for a stop opened on the map. Shareable, and pushed onto history when a
 * marker is tapped. Distinct from the standalone `/stops/{id}` detail page.
 * @param {string} id - OBA stop id (e.g. "1_75403")
 * @returns {string}
 */
export function mapStopPath(id) {
	return `/map/stops/${encodeURIComponent(id)}`;
}

/**
 * The stop id embedded in a `/map/stops/{id}` pathname, or null for any other
 * path. Used to derive "which stop is open" from the URL — works for both
 * shallow `pushState` and real navigation.
 * @param {string} pathname
 * @returns {string | null}
 */
export function stopIdFromPath(pathname) {
	const match = /^\/map\/stops\/([^/]+)\/?$/.exec(pathname);
	return match ? decodeURIComponent(match[1]) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/mapStopUrl.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mapStopUrl.js src/lib/__tests__/mapStopUrl.test.js
git commit -m "feat: add map stop URL helpers (mapStopPath, stopIdFromPath)"
```

---

## Task 2: `App.PageState` type

**Files:**
- Modify: `src/app.d.ts`

**Interfaces:**
- Produces: `App.PageState.stopData?` — the marker/loader stop entry pushed via `pushState('/map/stops/{id}', { stopData })` and read via `$page.state.stopData`.

- [ ] **Step 1: Write the type declaration**

`src/app.d.ts` is currently empty. Replace its entire contents with:

```ts
// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface PageState {
			/** Stop entry carried through a shallow pushState marker tap. */
			stopData?: {
				id: string;
				lat: number;
				lon: number;
				name: string;
				[key: string]: unknown;
			};
		}
	}
}

export {};
```

- [ ] **Step 2: Verify the project still builds**

Run: `npm run build`
Expected: build completes without errors (SvelteKit picks up `App.PageState`; `pushState` state args in later tasks will typecheck against it).

- [ ] **Step 3: Commit**

```bash
git add src/app.d.ts
git commit -m "feat: add App.PageState type for map stop shallow routing"
```

---

## Task 3: Move the map into a `(map)` route-group layout (behavior-preserving)

This is a pure restructure: extract today's `src/routes/+page.svelte` into a reusable
`MapExperience` component rendered by a `(map)` group layout, so it persists across
`/` ↔ `/map/stops/{id}`. **No behavior changes** — the marker tap still does
`pushState('/stops/${stop.id}')` for now (rewired in Task 5).

**Files:**
- Create: `src/components/MapExperience.svelte` (moved content of `src/routes/+page.svelte`)
- Delete: `src/routes/+page.svelte`
- Create: `src/routes/(map)/+layout.svelte`
- Create: `src/routes/(map)/+page.svelte`

**Interfaces:**
- Produces: `MapExperience` (no props) — renders the full map UI, reads `$page` for initial coordinates. Consumed by `(map)/+layout.svelte`.

- [ ] **Step 1: Move the page file into a component**

```bash
git mv src/routes/+page.svelte src/components/MapExperience.svelte
```

The file's content is unchanged by the move. It already imports `page` from
`$app/stores` and computes `initialCoords` at the top — that keeps working inside a
component.

- [ ] **Step 2: Create the group layout that renders it once**

```svelte
<!-- src/routes/(map)/+layout.svelte -->
<!--
    @component
    Owns the map experience. Because `/` and `/map/stops/[stopID]` share this
    `(map)` group layout, the map stays mounted across navigations between them —
    only the child +page.svelte components are recreated.
-->
<script>
	import MapExperience from '$components/MapExperience.svelte';

	let { children } = $props();
</script>

<MapExperience />
{@render children()}
```

- [ ] **Step 3: Create the idle `/` page**

```svelte
<!-- src/routes/(map)/+page.svelte -->
<!-- "/" — the map with no stop selected. The map itself lives in the (map) layout;
     this page intentionally renders nothing. -->
```

- [ ] **Step 4: Verify the build and existing tests pass**

Run: `npm run build`
Expected: builds cleanly; `/` resolves to `(map)/+page.svelte`.

Run: `npx vitest run src/routes src/components`
Expected: PASS — existing route/component tests unaffected.

- [ ] **Step 5: Smoke-test `/` in the running app**

Start the dev server if not running (`npm run dev`), then load `http://localhost:5173/`
and confirm the map, search pane, and stop markers render, and tapping a marker still
opens the sheet (URL becomes `/stops/{id}` as before — rewired in Task 5).

- [ ] **Step 6: Commit**

```bash
git add src/components/MapExperience.svelte src/routes/'(map)'
git commit -m "refactor: move map into a (map) route-group layout via MapExperience"
```

---

## Task 4: Stop route — server load + minimal page (cold-load data + shareable head)

Adds the real `/map/stops/[stopID]` route. After this task a cold load renders the map
(via the persistent layout) and provides `stopData`, but `MapExperience` does not yet
react to it — the sheet opens in Task 5.

**Files:**
- Create: `src/routes/(map)/map/stops/[stopID]/+page.server.js`
- Create: `src/routes/(map)/map/stops/[stopID]/+page.svelte`
- Test: `src/tests/routes/mapStopLoad.test.js`

**Interfaces:**
- Produces: `load({ params })` returning `{ stopData }`, where `stopData` is the OBA stop
  **entry** (`{ id, lat, lon, name, routeIds, ... }`) — the same shape a map marker hands
  `handleStopMarkerSelect`, so `selectedStopData` is uniform across both entry paths.

- [ ] **Step 1: Write the failing loader test**

```js
// src/tests/routes/mapStopLoad.test.js
import { describe, test, expect, vi, beforeEach } from 'vitest';

const retrieve = vi.fn();
vi.mock('$lib/obaSdk.js', () => ({
	default: { stop: { retrieve: (...a) => retrieve(...a) } },
	handleOBAResponse: (res) => res // pass-through; res already has .json()
}));

import { load } from '../../routes/(map)/map/stops/[stopID]/+page.server.js';

describe('/(map)/map/stops/[stopID] load', () => {
	beforeEach(() => retrieve.mockReset());

	test('returns the stop entry for the requested id', async () => {
		const entry = { id: '1_75403', lat: 47.6, lon: -122.3, name: 'Pine St & 3rd Ave' };
		retrieve.mockResolvedValue({ json: async () => ({ data: { entry } }) });

		const result = await load({ params: { stopID: '1_75403' } });

		expect(retrieve).toHaveBeenCalledWith('1_75403');
		expect(result).toEqual({ stopData: entry });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/routes/mapStopLoad.test.js`
Expected: FAIL — cannot resolve the not-yet-created `+page.server.js`.

- [ ] **Step 3: Write the loader**

```js
// src/routes/(map)/map/stops/[stopID]/+page.server.js
import oba, { handleOBAResponse } from '$lib/obaSdk.js';

/**
 * Cold-load / share path for a stop opened on the map. Returns the stop entry in
 * the same shape a map marker provides, so MapExperience can treat marker-tap and
 * direct-link stops identically. Arrivals are still fetched client-side by StopPane.
 */
export async function load({ params }) {
	const response = await oba.stop.retrieve(params.stopID);
	const body = await handleOBAResponse(response, 'stop').json();
	return { stopData: body.data.entry };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/routes/mapStopLoad.test.js`
Expected: PASS.

- [ ] **Step 5: Create the minimal page with shareable head**

```svelte
<!-- src/routes/(map)/map/stops/[stopID]/+page.svelte -->
<!--
    "/map/stops/{id}" — the map with this stop's sheet open. The map and sheet are
    rendered by the (map) layout (MapExperience) based on the URL; this page only
    emits the head tags a shared link needs, which SSR from the server load.
-->
<script>
	import { PUBLIC_OBA_REGION_NAME } from '$env/static/public';

	let { data } = $props();
	let stop = $derived(data.stopData);
</script>

<svelte:head>
	<title>{stop?.name ?? PUBLIC_OBA_REGION_NAME}</title>
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content={stop?.name ?? PUBLIC_OBA_REGION_NAME} />
</svelte:head>
```

- [ ] **Step 6: Verify build + cold load renders the map**

Run: `npm run build`
Expected: builds cleanly; `/map/stops/[stopID]` is a recognized route.

Load `http://localhost:5173/map/stops/1_75403` (use a valid stop id for your region).
Expected: the map renders (via the layout) and the browser tab title is the stop name.
The sheet does **not** open yet — that's Task 5.

- [ ] **Step 7: Commit**

```bash
git add src/routes/'(map)'/map src/tests/routes/mapStopLoad.test.js
git commit -m "feat: add /map/stops/[stopID] route with server load and shareable head"
```

---

## Task 5: Drive the stop sheet from the URL (marker tap, close, selection effect)

The behavioral heart. Replace `MapExperience`'s local `stop`/`Modal.STOP` state with
URL-derived selection, rewire the marker tap and close to shallow routing, and add one
effect that flies/highlights/reports when the selected stop changes.

**Files:**
- Modify: `src/components/MapExperience.svelte`
- Test: `src/components/__tests__/MapExperience.test.js`

**Interfaces:**
- Consumes: `mapStopPath`, `stopIdFromPath` (Task 1); `App.PageState.stopData` (Task 2);
  loader `stopData` (Task 4); existing `flyTo(lat, lon, zoom, { offsetY, animate })`.
- Produces: `handleStopMarkerSelect(stopData)` → `pushState(mapStopPath(id), { stopData })`;
  `closePane()` → `pushState('/', {})` when a stop is open.

- [ ] **Step 1: Add imports and URL-derived selection state**

In the `<script>` of `src/components/MapExperience.svelte`:

Add to the imports near the top (alongside the existing `pushState` import from
`$app/navigation`):

```js
import { mapStopPath, stopIdFromPath } from '$lib/mapStopUrl.js';
```

Below the existing `Modal` constant, add the offset constant and derived selection
(the same `MOBILE_STOP_MAP_OFFSET_Y` value used by the marker-lift fix):

```js
// Fraction of map height to lift a selected stop above center so the mobile bottom
// sheet (half detent, ~55% tall) doesn't cover it — lands it ~25% down.
const MOBILE_STOP_MAP_OFFSET_Y = 0.25;

// The open stop is derived from the URL, unifying marker taps (shallow pushState
// state) and cold loads/shares (server load data). Gate UI on selectedStopId /
// stopSheetOpen — never on selectedStopData (it can linger after close).
let selectedStopId = $derived(stopIdFromPath($page.url.pathname));
let selectedStopData = $derived($page.state?.stopData ?? $page.data?.stopData ?? null);
```

- [ ] **Step 2: Replace `stopSheetOpen` and remove `Modal.STOP` usage**

The current line:

```js
let stopSheetOpen = $derived(currentModal === Modal.STOP);
```

becomes:

```js
let stopSheetOpen = $derived(selectedStopId != null);
```

Remove `STOP: 'stop',` from the `Modal` object (only ROUTE / ALL_ROUTES / TRIP_PLANNER
remain — those stay local state). Delete the now-unused `let stop = $state();`
declaration; replace every remaining reference to `stop` in the file with
`selectedStopData` (uses: the `MapContainer` `{stop}` prop → `stop={selectedStopData}`;
`tripSelected`'s `updatePopupContent` calls; the `StopBottomSheet` `{stop}` prop →
`stop={selectedStopData}`).

- [ ] **Step 3: Rewire `handleStopMarkerSelect` to a shallow push**

Replace the entire body of `handleStopMarkerSelect` with just the URL push — all the
fly/highlight/analytics/cleanup work moves into the effect in Step 5:

```js
function handleStopMarkerSelect(stopData) {
	// Instant: the marker already carries the stop, so push it into history state
	// (no fetch). The selection effect reacts to the URL change and frames the map.
	pushState(mapStopPath(stopData.id), { stopData });
}
```

- [ ] **Step 4: Rewire `closePane` to drop the URL for the stop case**

Replace `closePane` with a version that shallow-pushes `/` when a stop is open (the
effect tears the map down), and keeps the existing local cleanup for the other modals:

```js
function closePane() {
	if (stopSheetOpen) {
		pushState('/', {}); // selection effect runs the map/stop teardown
		return;
	}
	// route / all-routes / trip-planner modals are local state
	if (polylines) {
		mapProvider.clearAllPolylines();
		mapProvider.removeStopMarkers();
		mapProvider.cleanupInfoWindow();
		mapProvider.clearVehicleMarkers();
		clearInterval(currentIntervalId);
		currentIntervalId = null;
	}
	selectedTrip = null;
	selectedRoute = null;
	isRouteSelected = false;
	showRouteMap = false;
	currentModal = null;
}
```

- [ ] **Step 5: Add the selection effect (fly / highlight / report / teardown)**

Add near the other module state (after `let currentHighlightedStopId = null;`):

```js
// Last stop id the effect acted on, and whether the map was already interactive
// on a prior run — used to decide animate (cold load snaps; in-app taps animate).
let appliedStopId = null;
let mapWasReady = false;

$effect(() => {
	const id = selectedStopId; // track
	const provider = mapProvider; // track — null until MapContainer mounts

	if (!provider) return; // wait for the map (re-runs when mapProvider is set)

	if (id === appliedStopId) {
		mapWasReady = true;
		return;
	}

	if (id) {
		const data = selectedStopData;
		if (!data) return; // wait for state/load data; re-runs when it arrives

		// A stop supersedes any route/trip selection.
		if (currentModal === Modal.ROUTE || selectedRoute || isRouteSelected) {
			provider.clearAllPolylines();
			provider.removeStopMarkers();
			provider.clearVehicleMarkers();
			if (currentIntervalId) {
				clearInterval(currentIntervalId);
				currentIntervalId = null;
			}
			selectedRoute = null;
			isRouteSelected = false;
			selectedTrip = null;
			currentModal = null;
		}

		searchCollapsed = true;
		if (browser && window.innerWidth >= 768) sheetSnap = 'full';

		const offsetY = browser && window.innerWidth < 768 ? MOBILE_STOP_MAP_OFFSET_Y : 0;
		// mapWasReady is false only on the very first framing (cold load) → snap
		// instantly; later in-app selections animate.
		provider.flyTo(data.lat, data.lon, 16, { offsetY, animate: mapWasReady });

		if (currentHighlightedStopId !== null) provider.unHighlightMarker(currentHighlightedStopId);
		provider.highlightMarker(id);
		currentHighlightedStopId = id;

		loadSurveys(data, getUserId());
		analytics.reportStopViewed(
			id,
			analyticsDistanceToStop(currentUserLocation.lat, currentUserLocation.lng, data.lat, data.lon)
		);
	} else {
		// Closed (back button or close): tear down the stop overlay.
		if (currentHighlightedStopId !== null) {
			provider.unHighlightMarker(currentHighlightedStopId);
			currentHighlightedStopId = null;
		}
		provider.cleanupInfoWindow();
		provider.clearVehicleMarkers();
		selectedTrip = null;
	}

	appliedStopId = id;
	mapWasReady = true;
});
```

- [ ] **Step 6: Point "open a route" at the same mutual-exclusion**

In `handleRouteSelected`, drop an open stop's URL first so the route modal isn't
competing with a stop sheet. Add as the first line of `handleRouteSelected`:

```js
	if (stopSheetOpen) pushState('/', {});
```

- [ ] **Step 7: Write the sheet-visibility test**

```js
// src/components/__tests__/MapExperience.test.js
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

// Stub the heavy children so MapExperience mounts in jsdom.
vi.mock('$components/MapContainer.svelte', () => ({ default: () => ({}) }));
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
	default: function StopBottomSheet(anchor, props) {
		const el = document.createElement('div');
		el.setAttribute('data-testid', 'stop-bottom-sheet');
		anchor.before(el);
		return {};
	}
}));

vi.mock('$app/navigation', () => ({ pushState: vi.fn(), replaceState: vi.fn() }));

// Per-test controllable page store (overrides the global vitest-setup mock).
let pageValue;
vi.mock('$app/stores', () => ({
	page: { subscribe: (fn) => { fn(pageValue); return () => {}; } }
}));

global.fetch = vi.fn(async () => ({ ok: false, status: 204 })); // loadAlerts no-op

import MapExperience from '$components/MapExperience.svelte';

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
```

- [ ] **Step 8: Run the test**

Run: `npx vitest run src/components/__tests__/MapExperience.test.js`
Expected: PASS (2 tests). If the mount fails on an unmocked import, add that child to the
`vi.mock` stubs above — do not change component behavior to satisfy the test.

- [ ] **Step 9: Run the full suite and lint**

Run: `npx vitest run`
Expected: PASS.

Run: `npm run lint`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add src/components/MapExperience.svelte src/components/__tests__/MapExperience.test.js
git commit -m "feat: drive the stop sheet from the /map/stops/{id} URL"
```

---

## Task 6: Cold-load instant framing (no visible pan)

A cold `/map/stops/{id}` load should boot the map already centered on the stop (avoids a
region-center → stop flash), then apply the mobile offset with `animate:false` (already
wired in Task 5's effect). This task supplies the initial center.

**Files:**
- Modify: `src/components/MapExperience.svelte`

**Interfaces:**
- Consumes: loader `stopData` via `$page.data` at mount; existing `MapContainer`
  `initialCoords={{ lat, lng }}` prop.

- [ ] **Step 1: Seed `initialCoords` from a cold-loaded stop**

At the top of `MapExperience`'s `<script>`, the current initial-coords computation is:

```js
const initialCoords = parseInitialCoordinates(
	$page.url.searchParams,
	Number(PUBLIC_OBA_REGION_CENTER_LAT),
	Number(PUBLIC_OBA_REGION_CENTER_LNG)
);
```

Read the page snapshot once (not reactively — this is a one-time mount value) and prefer
the cold-loaded stop's coordinates. Add `import { get } from 'svelte/store';` to the
imports, then replace the block above with:

```js
// One-time snapshot at mount: on a cold /map/stops/{id} load, `data.stopData` is
// present, so boot the map centered on the stop (the selection effect then applies
// the mobile offset with animate:false — no visible pan). Otherwise fall back to the
// existing ?lat/?lng query params / region center.
const initialPage = get(page);
const initialCoords = initialPage.data?.stopData
	? { lat: initialPage.data.stopData.lat, lng: initialPage.data.stopData.lon }
	: parseInitialCoordinates(
			initialPage.url.searchParams,
			Number(PUBLIC_OBA_REGION_CENTER_LAT),
			Number(PUBLIC_OBA_REGION_CENTER_LNG)
		);
```

(The existing `onMount` `cleanUrlParams()` only runs when `?lat/?lng` were present, so it
is unaffected.)

- [ ] **Step 2: Run tests and lint**

Run: `npx vitest run src/components/__tests__/MapExperience.test.js`
Expected: PASS (the `/` test still passes; `get(page)` returns the mocked value).

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Manually verify instant framing**

With the dev server running, hard-load `http://localhost:5173/map/stops/1_75403` on a
mobile viewport (e.g. 390×844). Expected: the map appears already centered on the stop
with the sheet open and the stop at ~25% from the top — **no** visible pan from region
center.

- [ ] **Step 4: Commit**

```bash
git add src/components/MapExperience.svelte
git commit -m "feat: boot the map centered on a cold-loaded /map/stops/{id}"
```

---

## Task 7: End-to-end verification (Playwright MCP)

No committed E2E framework exists in this repo (tests are Vitest). Verify the full flow
manually with the Playwright MCP tools, as was done for the marker-lift fix. Record
pass/fail for each check.

**Files:** none (verification only).

- [ ] **Step 1: Prep**

Ensure the dev server is running against a configured region with live stops. Resize the
browser to a mobile viewport (390×844) and navigate to `http://localhost:5173/`.

- [ ] **Step 2: Marker tap → instant deep link**

Tap a stop marker in the lower half of the map. Expected:
- URL becomes `/map/stops/{id}` (shallow — no full navigation/reload).
- The sheet opens immediately (no fetch wait).
- The map animates so the stop sits ~25% from the top.

- [ ] **Step 3: Back button closes the sheet**

Press the browser Back button. Expected: the sheet closes, the URL returns to `/`, and
the map stays put (not re-initialized).

- [ ] **Step 4: Close button**

Reopen a stop, then tap the sheet's ✕. Expected: sheet closes, URL returns to `/`.

- [ ] **Step 5: Cold load / share**

Open a fresh tab directly at `http://localhost:5173/map/stops/{id}` (a valid id).
Expected: the map boots centered on the stop, sheet open, stop framed at ~25% — no
visible pan. Tab title is the stop name.

- [ ] **Step 6: Desktop check**

Resize to ≥768px wide and repeat Step 2. Expected: the sheet opens as the side panel and
the stop is centered normally (no vertical offset applied).

- [ ] **Step 7: Regression — standalone page untouched**

Open a stop, click "View Details". Expected: navigates to `/stops/{id}` (the standalone
full-page detail), unchanged.

- [ ] **Step 8: Final full check**

Run: `npm run prepush`
Expected: format, lint, and the full Vitest suite all pass.

---

## Self-Review

**Spec coverage:**
- Two distinct URLs (`/map/stops/{id}` vs `/stops/{id}`) → Tasks 3–5, Task 7 Step 7. ✓
- Route-group layout owns the map → Task 3. ✓
- Cold load instant, pre-centered → Tasks 4 + 6. ✓
- Marker tap instant via shallow `pushState({ stopData })` → Task 5 Step 3. ✓
- Selection derived from pathname; `state ?? data` payload → Task 5 Step 1. ✓
- `flyTo` offset reuse; cold `animate:false` vs tap animate → Task 5 Step 5, Task 6. ✓
- Close = `pushState('/', {})`; back/forward auto → Task 5 Step 4, Task 7 Steps 3–4. ✓
- `App.PageState` type → Task 2. ✓
- SSR title/meta for shares → Task 4 Step 5. ✓
- Gate on `selectedStopId`, not `selectedStopData` → Task 5 Steps 1–2 (comment + usage). ✓
- Testing: unit (helpers, loader), component (sheet visibility), manual E2E → Tasks 1, 4, 5, 7. ✓

**Type/name consistency:** `mapStopPath`/`stopIdFromPath` (Task 1) used verbatim in Task 5.
`stopData` key consistent across loader (Task 4), `App.PageState` (Task 2), and effect
(Task 5). `selectedStopId`/`selectedStopData`/`stopSheetOpen` defined once (Task 5 Step 1)
and consumed consistently. `flyTo(..., { offsetY, animate })` matches the shipped provider
signature.

**Placeholder scan:** none — every code step contains full code and exact commands.
