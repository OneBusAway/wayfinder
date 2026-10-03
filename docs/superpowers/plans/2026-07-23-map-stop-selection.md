# Map Stop Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a rider selects a stop, de-emphasize every other stop into dots and draw the routes from that stop's arrivals list plus their live vehicles, each colored consistently across line, vehicle, legend, and arrival badge.

**Architecture:** Route colors resolve once in `MapExperience` (a pure module, `$lib/activeRoutes.js`) and flow down two paths — into the map layer and into the arrivals sheet — so badge and line can never disagree. Stop markers stay mounted for the lifetime of a selection and get their tier via a reactive `marker.props.emphasis` mutation, the same channel the providers already use for `showRoutesLabel`. A new `StopRoutesLayer.svelte` owns shape fetching and vehicle polling; a reworked `vehicleUtils.js` polls N routes on one interval with a failure-aware, route-scoped marker sweep.

**Tech Stack:** SvelteKit 5 (runes), Leaflet + MapLibre GL (OSM provider), Google Maps JS API (Google provider), Tailwind, Vitest + @testing-library/svelte.

**Spec:** `docs/superpowers/specs/2026-07-23-map-stop-selection-design.md`

## Global Constraints

- **Run tests with `npx vitest run`**, never `npm run test` — it hangs in a non-TTY shell.
- **The mockup's four settings are inlined, not configurable and not named constants.** Non-route stops always collapse to gray dots, vehicles are always drawn, the basemap is always dimmed while routes are drawn, and there is no flow-dash overlay. Do **not** add `STOP_TREATMENT` / `SHOW_VEHICLES` / `DIM_BASEMAP` constants or an unreachable `hidden` marker tier — a constant that is never false is dead code. Re-introducing configurability later is a deliberate, separate change.
- **`StopMarker.emphasis` has exactly three values:** `'full' | 'routeDot' | 'muted'`.
- **Both map providers must stay at parity** for every new method. `PUBLIC_OBA_MAP_PROVIDER` selects between them at runtime; a method on one must exist on the other.
- **Coverage:** `vite.config.js` sets `all: true` with a global 70% threshold and no `include`, so every new file counts toward coverage whether or not it has a test.
- **`RouteBadge` takes hex WITHOUT a leading `#`** (`RouteBadge.svelte:12` does `` `#${color}` ``). Map-facing colors carry the `#`. `assignRouteColors` returns both forms; do not convert anywhere else.
- **OBA sends `predictedArrivalTime: 0`, not `null`,** when there is no prediction. Always test `a.predicted && a.predictedArrivalTime > 0` — never `??`.
- **Formatting:** run `npx prettier --write <files>` before each commit; `npm run prepush` runs `prettier --check` and will fail CI otherwise.
- **Every `StopMarker` tier keeps its 32px (`h-8 w-8`) button** for WCAG 2.5.8 target size. Dots are inner `<span>`s.

## File Structure

**Create:**

| Path                                                           | Responsibility                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/activeRoutes.js`                                      | Pure: derive distinct active routes from an arrivals response; assign de-collided colors. No DOM, no fetch.              |
| `src/lib/__tests__/activeRoutes.test.js`                       | Tests for the above.                                                                                                     |
| `src/lib/mapPanes.js`                                          | Provider-neutral route stacking-layer names + their Leaflet z-indexes, so consumers never import a provider to get them. |
| `src/components/map/__tests__/support/layerBindings.svelte.js` | Test-only `$state` harness for reading `$bindable` writes back from a `.test.js`.                                        |
| `src/components/map/StopRoutesLayer.svelte`                    | Effectful: fetch per-route shapes, draw polylines, drive vehicle polling, own teardown.                                  |
| `src/components/map/__tests__/StopRoutesLayer.test.js`         | Smoke + teardown coverage.                                                                                               |
| `src/components/map/RouteLegend.svelte`                        | Presentational: swatch + short name + live count per drawn route.                                                        |
| `src/components/map/__tests__/RouteLegend.test.js`             | Rendering tests.                                                                                                         |
| `src/components/map/__tests__/StopMarker.test.js`              | Tier rendering + a11y invariants (no test exists today).                                                                 |
| `src/components/__tests__/MapView.test.js`                     | Regression: markers survive trip expansion.                                                                              |

**Modify:**

| Path                                               | Change                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/lib/colors.js`                                | Add `ROUTE_FALLBACK_PALETTE`.                                                                                      |
| `src/lib/vehicleUtils.js`                          | `fetchVehicles` returns `null` on failure; add `fetchAndUpdateVehiclesForRoutes`; per-marker `routeId` ownership.  |
| `src/lib/__tests__/vehicleUtils.test.js`           | Update for the new `fetchVehicles` contract; add multi-route tests.                                                |
| `src/components/map/StopMarker.svelte`             | Add `emphasis` + `dotColor`; branch the template.                                                                  |
| `src/components/map/MapView.svelte`                | Gate `mapMode` on `stop`; seed emphasis in `addMarker`; mount `StopRoutesLayer` + `RouteLegend`; guard `RouteMap`. |
| `src/components/MapExperience.svelte`              | Bind `stopArrivals`; derive colors; complete the teardown.                                                         |
| `src/components/stops/StopBottomSheet.svelte`      | Promote `arrivalsAndDeparturesResponse` to `$bindable`; forward `routeColors`.                                     |
| `src/components/stops/StopPane.svelte`             | Forward `routeColors` to `ArrivalDeparture`.                                                                       |
| `src/components/ArrivalDeparture.svelte`           | Accept `routeColors`; pass to `RouteBadge`.                                                                        |
| `src/lib/Provider/OpenStreetMapProvider.svelte.js` | Panes, casing, `revealPolylines`, `setStopEmphasis`, `setBasemapDimmed`, emphasis in `addMarker`.                  |
| `src/lib/Provider/GoogleMapProvider.svelte.js`     | Same surface; `_applyStyles` for dim+theme composition.                                                            |
| `src/tests/lib/OpenStreetMapProvider.test.js`      | Tests for the new methods.                                                                                         |
| `src/tests/lib/GoogleMapProvider.test.js`          | Tests for the new methods.                                                                                         |
| `src/components/__tests__/MapExperience.test.js`   | Regression: teardown clears stranded route flags.                                                                  |
| `src/locales/en.json`                              | Add `map.routes_shown`.                                                                                            |
| `src/assets/styles/leaflet-map.css`                | `.oba-dim-basemap .leaflet-tile-pane` filter.                                                                      |

---

## Task 1: Keep stop markers mounted during trip expansion (P1)

**Files:**

- Modify: `src/components/map/MapView.svelte:56-75`
- Test: `src/components/__tests__/MapView.test.js` (create)

**Interfaces:**

- Consumes: nothing.
- Produces: the invariant every later task depends on — while `stop` is truthy, `mapMode` stays `Modes.NORMAL` and `markersMap` is never emptied.

**Why:** `MapView.svelte:77-84` calls `clearAllMarkers()` whenever `mapMode !== NORMAL`. Expanding an arrival row sets `isRouteSelected`, `selectedRoute`, `selectedTrip`, and `showRouteMap` in `MapExperience`, which `MapView.svelte:60` turns into `Modes.ROUTE` — destroying every marker at exactly the moment the feature needs them.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/MapView.test.js`:

```js
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import MapView from '$components/map/MapView.svelte';

vi.mock('$components/map/RouteMap.svelte', () => ({ default: () => null }));
vi.mock('$components/map/StopRoutesLayer.svelte', () => ({ default: () => null }));
vi.mock('$components/map/RouteLegend.svelte', () => ({ default: () => null }));
vi.mock('$lib/LocationButton/LocationButton.svelte', () => ({ default: () => null }));

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/MapView.test.js`
Expected: the first test FAILS — `clearAllStopMarkers` was called.

- [ ] **Step 3: Gate the ROUTE branch on `stop`**

In `src/components/map/MapView.svelte`, change the mode effect (currently lines 56-75). Only the `else if` condition changes:

```js
$effect(() => {
	let newMode;
	if (isTripPlanModeActive) {
		newMode = Modes.TRIP_PLAN;
		// A selected stop owns the map: expanding one of its arrival rows sets
		// selectedTrip/isRouteSelected/showRouteMap, and without this guard that
		// would flip us to ROUTE — whose effect clears every stop marker, exactly
		// when the stop-selection layer needs them tiered and on screen.
	} else if (!stop && (selectedRoute || isRouteSelected || showRouteMap || selectedTrip)) {
		newMode = Modes.ROUTE;
	} else {
		newMode = Modes.NORMAL;
	}
	if (modeChangeTimeout) {
		clearTimeout(modeChangeTimeout);
	}
	if (mapMode === Modes.ROUTE && newMode === Modes.NORMAL) {
		modeChangeTimeout = setTimeout(() => {
			mapMode = newMode;
		}, 100);
	} else if (mapMode !== newMode) {
		mapMode = newMode;
	}
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/MapView.test.js`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/components/map/MapView.svelte src/components/__tests__/MapView.test.js
git add src/components/map/MapView.svelte src/components/__tests__/MapView.test.js
git commit -m "fix: keep stop markers mounted while a stop selection is active

Expanding an arrival row set isRouteSelected/showRouteMap, flipping mapMode
to ROUTE, whose effect clears every stop marker. Gate ROUTE on there being
no selected stop."
```

---

## Task 2: Complete the stop teardown (P2 + P3)

**Files:**

- Modify: `src/components/MapExperience.svelte:173-186`
- Test: `src/components/__tests__/MapExperience.test.js`

**Interfaces:**

- Consumes: Task 1's invariant.
- Produces: closing a stop sheet always returns the app to a clean NORMAL map — `showRouteMap`, `isRouteSelected`, `selectedRoute`, `selectedTrip` all falsy, and `vehicleMarkersMap` emptied.

**Why:** `closePane()` short-circuits for the stop case (`:211-214`) and never resets the route flags; the framing effect's `else` branch clears only `selectedTrip`. After expand-then-close, `mapMode` sticks at `ROUTE` forever and no stop markers ever return. Separately, `clearVehicleMarkers()` empties the map but not the module-level `vehicleMarkersMap`, so the next selection finds detached markers and its vehicles never appear.

- [ ] **Step 1: Make the page store reactive in the test file**

`src/components/__tests__/MapExperience.test.js` currently mocks `$app/stores` with a one-shot subscribe over a module-level `pageValue`, so a test can set the page **before** render but can never simulate a navigation **after** it. Closing a stop sheet is exactly that, so swap in a real store. Replace the existing mock block:

```js
// Per-test controllable page store (overrides the global vitest-setup mock).
// A real writable, not a one-shot subscribe, so a test can simulate navigating
// away from a stop after render — which is how the teardown path is reached.
import { writable } from 'svelte/store';

let pageValue;
const pageStore = writable(undefined);
vi.mock('$app/stores', () => ({
	page: { subscribe: (fn) => pageStore.subscribe(fn) }
}));

function setPage(next) {
	pageValue = next;
	pageStore.set(next);
}
```

Then change the three existing tests from `pageValue = {…}` to `setPage({…})`. Behavior is identical for them — the store is seeded before `render` exactly as before.

Also capture the sheet's props so a test can drive expansion and close, by extending the existing `StopBottomSheet` mock:

```js
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
import { clearVehicleMarkersMap } from '$lib/vehicleUtils.js';
```

- [ ] **Step 2: Write the failing test**

Append to `src/components/__tests__/MapExperience.test.js`:

```js
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
```

If binding `mapProvider` through the captured props proves impractical against the mocked `MapContainer`, change the `MapContainer` mock to assign a stub provider into its `mapProvider` binding on mount instead — the assertion is unchanged either way.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/__tests__/MapExperience.test.js`
Expected: the three pre-existing tests still PASS; the two new ones FAIL — `showRouteMap` is still `true`, and `clearVehicleMarkersMap` was not called.

- [ ] **Step 4: Complete the teardown**

In `src/components/MapExperience.svelte`, add the import:

```js
import { clearVehicleMarkersMap } from '$lib/vehicleUtils';
```

Then replace the framing effect's `else` branch (currently lines 173-186):

```js
} else {
    // Closed (back button or close): tear down the stop overlay.
    if (currentHighlightedStopId !== null) {
        provider.unHighlightMarker(currentHighlightedStopId);
        currentHighlightedStopId = null;
    }
    provider.resetStopEmphasis();
    provider.setBasemapDimmed(false);
    provider.cleanupInfoWindow();
    // Don't wipe vehicle markers a route is drawing: when a route is selected
    // from an open stop sheet, handleRouteSelected has already set
    // currentModal = Modal.ROUTE and added the route's vehicles before this
    // teardown flushes. A normal stop close leaves currentModal null.
    // Everything in this block is scoped to a *plain* stop close. When a route is
    // selected from an open stop sheet, handleRouteSelected has already pushed
    // '/' and set currentModal = Modal.ROUTE, selectedRoute, and isRouteSelected
    // in the same synchronous handler — Svelte coalesces that into one flush, so
    // this branch runs with the route already live. Resetting any of it here
    // would stomp the selection the rider just made (and RouteModal would keep
    // rendering against a null route).
    if (currentModal !== Modal.ROUTE) {
        provider.clearVehicleMarkers();
        // clearVehicleMarkers only detaches the markers from the map. The module
        // -level vehicleMarkersMap still holds them, so the next selection would
        // find stale entries via .has() and update detached markers that never
        // render. RouteMap's onDestroy already pairs these two calls.
        clearVehicleMarkersMap();

        // closePane() short-circuits for the stop case (pushState + return), and
        // the accordion never fires its collapse callback because StopPane is
        // destroyed rather than collapsed. So if the rider had a row expanded,
        // these three are still truthy — which pins mapMode at ROUTE forever and
        // permanently stops markers from loading.
        showRouteMap = false;
        isRouteSelected = false;
        selectedRoute = null;
    }
    // Correct on both paths: a route selection should still drop the previously
    // expanded trip and the previous stop's arrivals.
    selectedTrip = null;
    stopArrivals = null;
}
```

Note `stopArrivals` is declared in Task 8; if this task runs first, declare `let stopArrivals = $state(null);` alongside the other state declarations now and leave it otherwise unused. `resetStopEmphasis` and `setBasemapDimmed` arrive in Tasks 6 and 7 — add them to the test's provider stub now, and if the real providers do not yet have them, guard with `provider.resetStopEmphasis?.()` and `provider.setBasemapDimmed?.(false)` and drop the `?.` in Task 7.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/MapExperience.test.js`
Expected: all five PASS.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/components/MapExperience.svelte src/components/__tests__/MapExperience.test.js
git add src/components/MapExperience.svelte src/components/__tests__/MapExperience.test.js
git commit -m "fix: fully tear down stop state on close

closePane short-circuits for stops and never reset showRouteMap /
isRouteSelected / selectedRoute, so closing a sheet with an arrival row
expanded pinned mapMode at ROUTE and stop markers never returned. Also pair
clearVehicleMarkers with clearVehicleMarkersMap so the module-level map does
not leak detached markers into the next selection."
```

---

## Task 3: Camera-free polyline reveal (P4)

**Files:**

- Modify: `src/lib/Provider/OpenStreetMapProvider.svelte.js:778-873`
- Modify: `src/lib/Provider/GoogleMapProvider.svelte.js` (add a no-op `revealPolylines`)
- Test: `src/tests/lib/OpenStreetMapProvider.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: `revealPolylines({ only = [], duration = 1.2 })` on both providers. `only` is an array of polyline objects; empty means all tracked polylines. OSM animates `stroke-dashoffset` on each polyline and its `_casing`; Google is a no-op returning `undefined`.

**Why:** `_revealPolylinesWithDraw` is OSM-only and reachable only from inside `fitToPolylines`, which hides everything and flies the camera to the route bounds. Stop selection keeps its own `flyTo` framing, so there is no path today that reveals without refitting. It also iterates all polylines, so calling it per-route would re-animate already-drawn routes.

- [ ] **Step 1: Write the failing test**

Add to `src/tests/lib/OpenStreetMapProvider.test.js`:

```js
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

	test('does not move the camera', () => {
		const provider = new OpenStreetMapProvider(vi.fn());
		const line = fakePolyline();
		const flyToBounds = vi.fn();
		provider.map = { hasLayer: () => true, removeLayer: vi.fn(), flyToBounds };
		provider.polylines = [line];

		provider.revealPolylines({ only: [line] });

		expect(flyToBounds).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/lib/OpenStreetMapProvider.test.js -t revealPolylines`
Expected: FAIL — `provider.revealPolylines is not a function`.

- [ ] **Step 3: Extract the public reveal on the OSM provider**

In `src/lib/Provider/OpenStreetMapProvider.svelte.js`, replace `_revealPolylinesWithDraw` with a public method that takes an explicit target list, and have `fitToPolylines` delegate to it.

```js
/**
 * Reveals polylines with a "draw from start to end" animation using the SVG
 * stroke-dashoffset technique, without touching the camera. The direction-arrow
 * decorators are added once the line has finished drawing.
 *
 * @param {{ only?: Array, duration?: number }} [options] `only` limits the
 *   animation to specific polylines — used by the stop-selection layer, whose
 *   routes resolve one at a time and must not re-animate their neighbors.
 *   Omit it to reveal every tracked polyline.
 */
revealPolylines({ only = [], duration = 1.2 } = {}) {
    const targets = only.length ? only : this.polylines;

    targets.forEach((polyline) => {
        if (!polyline) return;
        // The casing is a second, wider stroke drawn underneath. It is deliberately
        // absent from this.polylines (like arrowDecorator) so it can't double-count
        // in fitToPolylines/_getRoutePaths, so reveal it explicitly here.
        [polyline._casing, polyline].forEach((layer) => {
            if (!layer) return;
            if (!this.map.hasLayer(layer)) layer.addTo(this.map);
        });

        const path = polyline._path;
        const addDecorator = () => {
            if (polyline.arrowDecorator && !this.map.hasLayer(polyline.arrowDecorator)) {
                polyline.arrowDecorator.addTo(this.map);
            }
        };

        // SVG renderer only: fall back to an instant reveal otherwise.
        if (!path || typeof path.getTotalLength !== 'function') {
            addDecorator();
            return;
        }

        [polyline._casing, polyline].forEach((layer) => {
            const layerPath = layer?._path;
            if (!layerPath || typeof layerPath.getTotalLength !== 'function') return;
            const length = layerPath.getTotalLength();
            layerPath.style.transition = 'none';
            layerPath.style.strokeDasharray = `${length} ${length}`;
            layerPath.style.strokeDashoffset = `${length}`;
            // Force a reflow so the starting offset is applied before transitioning.
            layerPath.getBoundingClientRect();
            layerPath.style.transition = `stroke-dashoffset ${duration}s ease-in-out`;
            layerPath.style.strokeDashoffset = '0';
        });

        polyline._drawTimeoutId = setTimeout(() => {
            polyline._drawTimeoutId = null;
            // Bail if the polyline was cleared mid-draw (e.g. rapid route switch).
            if (!this.map.hasLayer(polyline)) return;
            // Clear the inline styles so the original stroke (e.g. the dashed
            // pattern used for walking legs) is restored once drawing is done.
            [polyline._casing, polyline].forEach((layer) => {
                const layerPath = layer?._path;
                if (!layerPath) return;
                layerPath.style.transition = '';
                layerPath.style.strokeDasharray = '';
                layerPath.style.strokeDashoffset = '';
            });
            addDecorator();
        }, duration * 1000);
    });
}
```

In `fitToPolylines`, replace the `this._revealPolylinesWithDraw(options.drawDuration ?? 1.2);` call with:

```js
this.revealPolylines({ duration: options.drawDuration ?? 1.2 });
```

Also extend `_setPolylinesVisible` to carry the casing:

```js
_setPolylinesVisible(visible) {
    this.polylines.forEach((polyline) => {
        [polyline, polyline._casing, polyline.arrowDecorator].forEach((layer) => {
            if (!layer) return;
            if (visible) {
                if (!this.map.hasLayer(layer)) layer.addTo(this.map);
            } else if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
    });
}
```

- [ ] **Step 4: Add the Google no-op**

In `src/lib/Provider/GoogleMapProvider.svelte.js`, next to `fitToPolylines`:

```js
/**
 * Provider-parity no-op. Google's Polyline has no SVG path, so the
 * stroke-dashoffset draw-in used by the OSM provider has no analogue; Google
 * routes appear immediately. Kept so callers don't have to branch on provider.
 */
revealPolylines() {}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/OpenStreetMapProvider.test.js src/tests/lib/GoogleMapProvider.test.js`
Expected: PASS, including the pre-existing `fitToPolylines` tests.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/lib/Provider/OpenStreetMapProvider.svelte.js src/lib/Provider/GoogleMapProvider.svelte.js src/tests/lib/OpenStreetMapProvider.test.js
git add src/lib/Provider src/tests/lib/OpenStreetMapProvider.test.js
git commit -m "feat: add camera-free revealPolylines to the map providers

The draw-in reveal was private to the OSM provider and reachable only from
fitToPolylines, which hides every line and flies the camera. Expose it as
revealPolylines({only}) so a caller can animate specific routes as they
resolve, without moving the map or re-animating their neighbors."
```

---

## Task 4: Derive active routes from an arrivals response

**Files:**

- Create: `src/lib/activeRoutes.js`
- Test: `src/lib/__tests__/activeRoutes.test.js` (create)

**Interfaces:**

- Consumes: nothing.
- Produces:

```js
/**
 * @typedef {Object} ActiveRoute
 * @property {string} id          - OBA route id
 * @property {string} shortName
 * @property {number} type        - GTFS route type, for the vehicle glyph
 * @property {string} tripId      - the soonest arrival's trip, used for the shape
 * @property {string|null} gtfsColor - raw hex from references.routes, no '#'
 */
export function activeRoutesFromArrivals(response): ActiveRoute[]
```

Sorted soonest-arrival first. Route order matters: it drives legend order, the graduated stroke weights, and the ring-dot color when a stop is served by more than one route.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/activeRoutes.test.js`:

```js
import { describe, test, expect } from 'vitest';
import { activeRoutesFromArrivals } from '$lib/activeRoutes.js';

function makeResponse(arrivals, routes = []) {
	return {
		data: {
			entry: { stopId: 'stop_1', arrivalsAndDepartures: arrivals },
			references: { routes }
		}
	};
}

describe('activeRoutesFromArrivals', () => {
	test('returns one entry per distinct route, soonest first', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_22',
						tripId: 't_b',
						predicted: true,
						predictedArrivalTime: 2000,
						scheduledArrivalTime: 2000
					},
					{
						routeId: 'r_c',
						tripId: 't_a',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					}
				],
				[
					{ id: 'r_c', shortName: 'C Line', type: 3, color: 'b02a37' },
					{ id: 'r_22', shortName: '22', type: 3, color: 'e0a021' }
				]
			)
		);
		expect(result.map((r) => r.id)).toEqual(['r_c', 'r_22']);
		expect(result[0]).toEqual({
			id: 'r_c',
			shortName: 'C Line',
			type: 3,
			tripId: 't_a',
			gtfsColor: 'b02a37'
		});
	});

	test('keeps the soonest trip when a route has several arrivals', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_c',
						tripId: 't_late',
						predicted: true,
						predictedArrivalTime: 5000,
						scheduledArrivalTime: 5000
					},
					{
						routeId: 'r_c',
						tripId: 't_soon',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					}
				],
				[{ id: 'r_c', shortName: 'C Line', type: 3, color: 'b02a37' }]
			)
		);
		expect(result).toHaveLength(1);
		expect(result[0].tripId).toBe('t_soon');
	});

	// OBA sends predictedArrivalTime: 0 (not null) when there is no real-time
	// prediction. A naive `predictedArrivalTime ?? scheduledArrivalTime` reads
	// that as "arriving at epoch" and sorts it first. This test is the point.
	test('treats predictedArrivalTime 0 as absent rather than as time zero', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_c',
						tripId: 't_unpredicted',
						predicted: false,
						predictedArrivalTime: 0,
						scheduledArrivalTime: 9000
					},
					{
						routeId: 'r_22',
						tripId: 't_predicted',
						predicted: true,
						predictedArrivalTime: 3000,
						scheduledArrivalTime: 3200
					}
				],
				[
					{ id: 'r_c', shortName: 'C Line', type: 3, color: 'b02a37' },
					{ id: 'r_22', shortName: '22', type: 3, color: 'e0a021' }
				]
			)
		);
		expect(result.map((r) => r.id)).toEqual(['r_22', 'r_c']);
	});

	test('picks the soonest trip by scheduled time when nothing is predicted', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_c',
						tripId: 't_late',
						predicted: false,
						predictedArrivalTime: 0,
						scheduledArrivalTime: 9000
					},
					{
						routeId: 'r_c',
						tripId: 't_soon',
						predicted: false,
						predictedArrivalTime: 0,
						scheduledArrivalTime: 4000
					}
				],
				[{ id: 'r_c', shortName: 'C Line', type: 3, color: 'b02a37' }]
			)
		);
		expect(result[0].tripId).toBe('t_soon');
	});

	test('falls back to the arrival routeShortName when the route reference is missing', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_x',
						tripId: 't_x',
						routeShortName: '773',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					}
				],
				[]
			)
		);
		expect(result[0].shortName).toBe('773');
		expect(result[0].gtfsColor).toBeNull();
	});

	test.each([
		['null', null],
		['undefined', undefined],
		['an empty object', {}],
		['a response with no entry', { data: { references: { routes: [] } } }],
		['a response with no arrivals array', { data: { entry: {}, references: { routes: [] } } }]
	])('returns an empty array for %s', (_label, input) => {
		expect(activeRoutesFromArrivals(input)).toEqual([]);
	});

	test('skips arrivals with no routeId', () => {
		const result = activeRoutesFromArrivals(
			makeResponse([{ tripId: 't_a', predicted: true, predictedArrivalTime: 1000 }], [])
		);
		expect(result).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/activeRoutes.test.js`
Expected: FAIL — cannot resolve `$lib/activeRoutes.js`.

- [ ] **Step 3: Implement**

Create `src/lib/activeRoutes.js`:

```js
/**
 * Derives the set of routes a rider can actually board from a stop, from that
 * stop's arrivals-and-departures response.
 *
 * This is deliberately narrower than "routes the stop is signed for": a stop
 * signed "128, 22, 773, C Line" whose 773 has no arrival in the current window
 * yields three routes, not four. A line on the map then means "a bus you can
 * catch from here is running this route now."
 */

/**
 * @typedef {Object} ActiveRoute
 * @property {string} id
 * @property {string} shortName
 * @property {number} type
 * @property {string} tripId
 * @property {string|null} gtfsColor
 */

/**
 * Effective arrival time for ordering.
 *
 * OBA sends `predictedArrivalTime: 0` — not null — when there is no real-time
 * prediction, so `predictedArrivalTime ?? scheduledArrivalTime` would read every
 * unpredicted arrival as "arriving at the epoch" and sort it to the front. This
 * mirrors the guard ArrivalDeparture.svelte already uses to pick its display time.
 * @param {Object} arrival
 * @returns {number}
 */
function effectiveArrivalTime(arrival) {
	return arrival.predicted && arrival.predictedArrivalTime > 0
		? arrival.predictedArrivalTime
		: arrival.scheduledArrivalTime;
}

/**
 * @param {Object} response - an /arrivals-and-departures-for-stop response
 * @returns {ActiveRoute[]} distinct routes, soonest arrival first
 */
export function activeRoutesFromArrivals(response) {
	const arrivals = response?.data?.entry?.arrivalsAndDepartures;
	if (!Array.isArray(arrivals)) return [];

	const routeRefs = new Map(
		(response?.data?.references?.routes ?? []).map((route) => [route.id, route])
	);

	/** @type {Map<string, {arrival: Object, time: number}>} */
	const soonestByRoute = new Map();

	for (const arrival of arrivals) {
		const routeId = arrival?.routeId;
		if (!routeId) continue;

		const time = effectiveArrivalTime(arrival);
		const existing = soonestByRoute.get(routeId);
		if (!existing || time < existing.time) {
			soonestByRoute.set(routeId, { arrival, time });
		}
	}

	return [...soonestByRoute.entries()]
		.sort((a, b) => a[1].time - b[1].time)
		.map(([routeId, { arrival }]) => {
			const ref = routeRefs.get(routeId);
			return {
				id: routeId,
				shortName: ref?.shortName ?? arrival.routeShortName ?? '',
				type: ref?.type ?? 3,
				tripId: arrival.tripId,
				gtfsColor: ref?.color || null
			};
		});
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/activeRoutes.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/lib/activeRoutes.js src/lib/__tests__/activeRoutes.test.js
git add src/lib/activeRoutes.js src/lib/__tests__/activeRoutes.test.js
git commit -m "feat: derive the active route set from a stop's arrivals"
```

---

## Task 5: De-collided route colors

**Files:**

- Modify: `src/lib/colors.js`
- Modify: `src/lib/activeRoutes.js`
- Test: `src/lib/__tests__/activeRoutes.test.js`

**Interfaces:**

- Consumes: `ActiveRoute[]` from Task 4; `mapContrastColor` and `getBrightness` from `$lib/colorUtils`.
- Produces:

```js
/**
 * @typedef {Object} RouteColors
 * @property {string} line     - '#rrggbb', for polylines and vehicle markers
 * @property {string} badgeBg  - 'rrggbb' (no '#'), for RouteBadge `color`
 * @property {string} badgeFg  - 'rrggbb' (no '#'), for RouteBadge `textColor`
 */
export function assignRouteColors(routes, { dark }): Map<string, RouteColors>
export const ROUTE_FALLBACK_PALETTE // in $lib/colors.js
```

`badgeBg` is always `line` without the `#`, so badge and line can never diverge.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/activeRoutes.test.js`:

```js
import { assignRouteColors } from '$lib/activeRoutes.js';
import { ROUTE_FALLBACK_PALETTE } from '$lib/colors.js';

const route = (id, gtfsColor) => ({ id, shortName: id, type: 3, tripId: `t_${id}`, gtfsColor });

function contrast(hexA, hexB) {
	const lum = (hex) => {
		const channels = [1, 3, 5]
			.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
			.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	};
	const [hi, lo] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
	return (hi + 0.05) / (lo + 0.05);
}

describe('assignRouteColors', () => {
	test('keeps a unique GTFS color, contrast-adjusted for the basemap', () => {
		const colors = assignRouteColors([route('r_c', 'b02a37')], { dark: false });
		expect(colors.get('r_c').line).toBe('#b02a37');
		expect(colors.get('r_c').badgeBg).toBe('b02a37');
	});

	test('badgeBg is always the line color without the hash', () => {
		const colors = assignRouteColors([route('r_c', 'b02a37'), route('r_22', 'e0a021')], {
			dark: true
		});
		for (const value of colors.values()) {
			expect(value.badgeBg).toBe(value.line.slice(1));
		}
	});

	test('gives colliding routes distinct colors', () => {
		const colors = assignRouteColors([route('r_22', '4a4a4a'), route('r_128', '4a4a4a')], {
			dark: false
		});
		expect(colors.get('r_22').line).not.toBe(colors.get('r_128').line);
	});

	test('assigns a palette color when the GTFS color is missing or invalid', () => {
		const palette = ROUTE_FALLBACK_PALETTE.map((entry) => entry.light);
		const colors = assignRouteColors([route('r_a', null), route('r_b', 'nonsense')], {
			dark: false
		});
		expect(palette).toContain(colors.get('r_a').line);
		expect(palette).toContain(colors.get('r_b').line);
		expect(colors.get('r_a').line).not.toBe(colors.get('r_b').line);
	});

	test('is stable when the input order changes', () => {
		const routes = [route('r_a', null), route('r_b', null), route('r_c', null)];
		const forward = assignRouteColors(routes, { dark: false });
		const reversed = assignRouteColors([...routes].reverse(), { dark: false });
		for (const { id } of routes) {
			expect(reversed.get(id).line).toBe(forward.get(id).line);
		}
	});

	test('uses the dark palette variant in dark mode', () => {
		const light = assignRouteColors([route('r_a', null)], { dark: false });
		const dark = assignRouteColors([route('r_a', null)], { dark: true });
		expect(dark.get('r_a').line).not.toBe(light.get('r_a').line);
		expect(ROUTE_FALLBACK_PALETTE.map((e) => e.dark)).toContain(dark.get('r_a').line);
	});

	test('picks a readable badge foreground for light backgrounds', () => {
		// #DCE775 (the Olive dark variant) is far too light for white text.
		const colors = assignRouteColors([route('r_a', 'DCE775')], { dark: true });
		const { badgeBg, badgeFg } = colors.get('r_a');
		expect(contrast(`#${badgeBg}`, `#${badgeFg}`)).toBeGreaterThanOrEqual(4.5);
	});

	test('returns an empty map for an empty route list', () => {
		expect(assignRouteColors([], { dark: false }).size).toBe(0);
	});
});

describe('ROUTE_FALLBACK_PALETTE', () => {
	// These guarantees are asserted in the design spec; enforce them here so a
	// future palette edit can't quietly break legibility.
	test('every entry clears 3:1 against its basemap and 4.5:1 against its text', () => {
		for (const { light, dark } of ROUTE_FALLBACK_PALETTE) {
			expect(contrast(light, '#F2F2F0')).toBeGreaterThanOrEqual(3);
			expect(contrast(dark, '#1B1B1B')).toBeGreaterThanOrEqual(3);
			expect(
				Math.max(contrast(light, '#FFFFFF'), contrast(light, '#000000'))
			).toBeGreaterThanOrEqual(4.5);
			expect(Math.max(contrast(dark, '#FFFFFF'), contrast(dark, '#000000'))).toBeGreaterThanOrEqual(
				4.5
			);
		}
	});

	test('entries stay visually distinct within each mode', () => {
		const distance = (a, b) => {
			const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
			const [x, y] = [parse(a), parse(b)];
			return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
		};
		for (const key of ['light', 'dark']) {
			const values = ROUTE_FALLBACK_PALETTE.map((entry) => entry[key]);
			for (let i = 0; i < values.length; i++) {
				for (let j = i + 1; j < values.length; j++) {
					expect(distance(values[i], values[j])).toBeGreaterThan(60);
				}
			}
		}
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/activeRoutes.test.js`
Expected: FAIL — `assignRouteColors` and `ROUTE_FALLBACK_PALETTE` are not exported.

- [ ] **Step 3: Add the palette**

Append to `src/lib/colors.js`:

```js
/**
 * Fallback colors for routes whose GTFS color is missing, invalid, or collides
 * with another route drawn at the same time (real agencies routinely give
 * several routes one generic color, which makes two lines in a shared corridor
 * indistinguishable).
 *
 * Each entry is a light/dark pair because no single hex can clear both a light
 * and a dark basemap — the same reason mapContrastColor adjusts GTFS colors per
 * theme. These values were chosen by computation, not by eye; every one clears
 * 3:1 against its basemap and 4.5:1 against its computed text color, and the
 * closest pair within a mode is 65 units apart in RGB. See the palette tests in
 * src/lib/__tests__/activeRoutes.test.js, which enforce all of that.
 */
export const ROUTE_FALLBACK_PALETTE = [
	{ light: '#C2185B', dark: '#F06292' }, // crimson
	{ light: '#1565C0', dark: '#64B5F6' }, // blue
	{ light: '#2E7D32', dark: '#81C784' }, // green
	{ light: '#E65100', dark: '#FFB74D' }, // orange
	{ light: '#6A1B9A', dark: '#BA68C8' }, // purple
	{ light: '#00695C', dark: '#4DB6AC' }, // teal
	{ light: '#5D4037', dark: '#BCAAA4' }, // brown
	{ light: '#827717', dark: '#DCE775' } // olive
];
```

- [ ] **Step 4: Implement `assignRouteColors`**

Append to `src/lib/activeRoutes.js`:

```js
import { mapContrastColor, getBrightness, hexToRgb } from '$lib/colorUtils.js';
import { ROUTE_FALLBACK_PALETTE } from '$lib/colors.js';

/**
 * @typedef {Object} RouteColors
 * @property {string} line    - '#rrggbb', for polylines and vehicle markers
 * @property {string} badgeBg - 'rrggbb' (no '#'), for RouteBadge `color`
 * @property {string} badgeFg - 'rrggbb' (no '#'), for RouteBadge `textColor`
 */

// Stable index into the fallback palette. Keyed on the route id rather than the
// route's position in the list so a 30s refresh that reorders arrivals doesn't
// change any route's color.
function paletteIndexFor(routeId) {
	let hash = 0;
	for (let i = 0; i < routeId.length; i++) {
		hash = (hash * 31 + routeId.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % ROUTE_FALLBACK_PALETTE.length;
}

// Badge text: the background is no longer the agency's own color, so the
// agency's textColor (chosen for that original hex) may be unreadable against
// it. Pick from the resolved background instead — by true WCAG contrast, NOT by
// getBrightness, which is NTSC-weighted (G .587) where WCAG luminance weights
// green .7152 and red .2126. A brightness threshold fails ~14% of colors,
// including ordinary agency greens/reds/oranges (#009900 -> 3.78:1,
// #ff6600 -> 2.94:1).
//
// Choosing whichever of white/black scores higher is a *structural* guarantee of
// >= 4.58:1 on any background: the worst case is the luminance where the two tie,
// (L+0.05)/0.05 == 1.05/(L+0.05), giving L ~ 0.1791 and a ratio of ~4.58.
function badgeForeground(hex) {
	return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#000000') ? 'ffffff' : '000000';
}

/**
 * Resolves one color per route, used identically by the polyline, the vehicle
 * markers, the legend, and the arrival badge.
 *
 * @param {ActiveRoute[]} routes - in draw order (soonest arrival first)
 * @param {{ dark?: boolean }} options
 * @returns {Map<string, RouteColors>}
 */
export function assignRouteColors(routes, { dark = false } = {}) {
	/** @type {Map<string, RouteColors>} */
	const colors = new Map();
	const taken = new Set();

	const finish = (routeId, line) => {
		taken.add(line.toLowerCase());
		const badgeBg = line.slice(1);
		colors.set(routeId, { line, badgeBg, badgeFg: badgeForeground(line) });
	};

	// Two passes so palette assignment is order-independent: every route that can
	// keep its own GTFS color claims it first, and only then do the leftovers pick
	// from the palette. A single pass would let an early colorless route grab a
	// palette slot that a later route's GTFS color also maps to.
	//
	// The keeper within a color group must be chosen by a data-only rule, NOT by
	// array position. Routes arrive in draw order (soonest arrival first), so two
	// routes with close arrival times swap between 30s polls — and picking the
	// first-seen route as keeper flips BOTH routes' colors on screen with no
	// underlying data change (the loser's fallback depends on what's in `taken` by
	// the time it is processed). Group by resolved color, then let the lowest
	// routeId keep it.
	const needsFallback = [];
	for (const route of routes) {
		const resolved = mapContrastColor(route.gtfsColor, { dark });
		if (resolved && !taken.has(resolved.toLowerCase())) {
			finish(route.id, resolved);
		} else {
			needsFallback.push(route);
		}
	}

	for (const route of needsFallback) {
		const start = paletteIndexFor(route.id);
		let line = null;
		// Linear-probe from the hashed slot to the next unused palette entry.
		for (let offset = 0; offset < ROUTE_FALLBACK_PALETTE.length; offset++) {
			const entry = ROUTE_FALLBACK_PALETTE[(start + offset) % ROUTE_FALLBACK_PALETTE.length];
			const candidate = dark ? entry.dark : entry.light;
			if (!taken.has(candidate.toLowerCase())) {
				line = candidate;
				break;
			}
		}
		// More routes than palette entries: accept a repeat rather than no color.
		if (!line) {
			const entry = ROUTE_FALLBACK_PALETTE[start];
			line = dark ? entry.dark : entry.light;
		}
		finish(route.id, line);
	}

	return colors;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/activeRoutes.test.js`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/lib/activeRoutes.js src/lib/colors.js src/lib/__tests__/activeRoutes.test.js
git add src/lib/activeRoutes.js src/lib/colors.js src/lib/__tests__/activeRoutes.test.js
git commit -m "feat: resolve one de-collided color per active route

Agencies routinely give several routes one generic color, which makes two
lines in a shared corridor indistinguishable. Fall back to a computed
light/dark palette, keyed on route id so colors are stable across refreshes."
```

---

## Task 6: Stop marker emphasis tiers

**Files:**

- Modify: `src/components/map/StopMarker.svelte`
- Test: `src/components/map/__tests__/StopMarker.test.js` (create)

**Interfaces:**

- Consumes: nothing.
- Produces: `StopMarker` accepts `emphasis: 'full' | 'routeDot' | 'muted'` (default `'full'`) and `dotColor: string | null`. `isHighlighted` is unchanged and **wins over `emphasis`** — a highlighted marker always renders the full pin.

- [ ] **Step 1: Write the failing tests**

Create `src/components/map/__tests__/StopMarker.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { describe, test, expect, vi } from 'vitest';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import StopMarker from '../StopMarker.svelte';

const stop = {
	id: 'stop_1',
	name: 'California Ave SW & Fauntleroy Way SW',
	direction: 'N',
	routes: []
};

function renderMarker(props = {}) {
	return render(StopMarker, {
		props: { stop, icon: faBus, onClick: vi.fn(), ...props }
	});
}

describe('StopMarker emphasis', () => {
	test('renders the full pin by default', () => {
		const { container } = renderMarker();
		expect(container.querySelector('.custom-marker')).toBeInTheDocument();
		expect(container.querySelector('.emphasis-dot')).not.toBeInTheDocument();
	});

	test('renders a route-colored ring dot for routeDot', () => {
		const { container } = renderMarker({ emphasis: 'routeDot', dotColor: '#b02a37' });
		const dot = container.querySelector('.emphasis-dot.route-dot');
		expect(dot).toBeInTheDocument();
		expect(dot).toHaveStyle('border-color: #b02a37');
		expect(container.querySelector('.bus-icon')).not.toBeInTheDocument();
	});

	test('renders a quiet gray dot for muted', () => {
		const { container } = renderMarker({ emphasis: 'muted' });
		expect(container.querySelector('.emphasis-dot.muted-dot')).toBeInTheDocument();
		expect(container.querySelector('.bus-icon')).not.toBeInTheDocument();
	});

	// The selected stop is always in the ring-dot set (those are the trips that
	// serve it), so these two props WILL collide. isHighlighted has to win, or the
	// rider's selected stop becomes the least distinguishable thing on the map.
	test('isHighlighted wins over routeDot', () => {
		const { container } = renderMarker({
			emphasis: 'routeDot',
			dotColor: '#b02a37',
			isHighlighted: true
		});
		expect(container.querySelector('.custom-marker.highlight')).toBeInTheDocument();
		expect(container.querySelector('.emphasis-dot')).not.toBeInTheDocument();
	});

	test.each(['full', 'routeDot', 'muted'])(
		'keeps an accessible 32px button in the %s tier',
		(emphasis) => {
			const { container } = renderMarker({ emphasis, dotColor: '#b02a37' });
			const button = screen.getByRole('button', { name: stop.name });
			expect(button).toBeInTheDocument();
			expect(container.querySelector('.marker-hit-area')).toBeInTheDocument();
		}
	);

	test.each(['routeDot', 'muted'])('hides the routes label in the %s tier', (emphasis) => {
		const withRoutes = { ...stop, routes: [{ shortName: 'C' }, { shortName: '22' }] };
		render(StopMarker, {
			props: { stop: withRoutes, icon: faBus, onClick: vi.fn(), showRoutesLabel: true, emphasis }
		});
		expect(screen.queryByText('C, 22')).not.toBeInTheDocument();
	});

	test('shows the routes label in the full tier', () => {
		const withRoutes = { ...stop, routes: [{ shortName: 'C' }, { shortName: '22' }] };
		render(StopMarker, {
			props: {
				stop: withRoutes,
				icon: faBus,
				onClick: vi.fn(),
				showRoutesLabel: true,
				emphasis: 'full'
			}
		});
		expect(screen.getByText('C, 22')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/map/__tests__/StopMarker.test.js`
Expected: FAIL — no `.emphasis-dot`, and the routeDot tier still renders the pin.

- [ ] **Step 3: Branch the template**

In `src/components/map/StopMarker.svelte`, update the props block:

```js
/**
 * @typedef {Object} Props
 * @property {any} stop
 * @property {any} onClick
 * @property {any} icon
 * @property {boolean} [isHighlighted]
 * @property {boolean} [showRoutesLabel]
 * @property {'full'|'routeDot'|'muted'} [emphasis] - Marker prominence,
 *   decided by the map layer from the current selection. `full` is today's pin.
 * @property {string|null} [dotColor] - Ring color for the `routeDot` tier.
 */

/** @type {Props} */
let {
	stop,
	onClick,
	icon,
	isHighlighted = false,
	showRoutesLabel = false,
	emphasis = 'full',
	dotColor = null
} = $props();
```

Add a derived resolution below the existing `routesLabelText` derivation:

```js
// The selected stop is always among the stops served by the drawn routes, so
// `emphasis: 'routeDot'` and `isHighlighted` collide by construction. Highlight
// wins: the stop the rider picked must never be the quietest thing on screen.
const resolvedEmphasis = $derived(isHighlighted ? 'full' : emphasis);
const isFullPin = $derived(resolvedEmphasis === 'full');
```

Replace the markup block (currently lines 71-103) with:

```svelte
<div class="marker-container">
	<!-- The button keeps its 32px box in every tier. Collapsing the *icon* to a
	     dot is the whole point, but collapsing the hit target with it would put
	     the control under the WCAG 2.5.8 minimum and make it unusable on touch. -->
	<button class="marker-hit-area" onclick={onClick} aria-label={stop.name}>
		{#if isFullPin}
			<span class="custom-marker dark:border-[#5a2c2c] {isHighlighted ? 'highlight' : ''}">
				<span class="bus-icon dark:text-white">
					<FontAwesomeIcon {icon} class=" text-black" />
					{#if stop.direction}
						<!-- No class on the caret icon itself: svelte-fontawesome spreads it onto
						     the <svg>, and an element's own rule always beats a color inherited
						     from an ancestor — which would make the .highlight caret tint below
						     dead in dark mode. Let the svg inherit currentColor from this span. -->
						<span class="direction-arrow {stop.direction.toLowerCase()} dark:text-white">
							<FontAwesomeIcon icon={faCaretUp} />
						</span>
					{/if}
				</span>
			</span>
		{:else if resolvedEmphasis === 'routeDot'}
			<span class="emphasis-dot route-dot" style="border-color: {dotColor};"></span>
		{:else if resolvedEmphasis === 'muted'}
			<span class="emphasis-dot muted-dot"></span>
		{/if}
	</button>

	{#if isFullPin && showRoutesLabel && routesLabelText}
		<div
			role="button"
			tabindex="0"
			class="routes-label {isExpanded ? 'expanded' : ''} position-{labelPosition}"
			onclick={toggleRoutesList}
			onkeydown={handleRoutesLabelKeydown}
			aria-expanded={isExpanded}
			aria-label={isExpanded ? 'Collapse route list' : `Show all ${routeNames.length} routes`}
		>
			<span class="label-text">{routesLabelText}</span>
			{#if remainingRoutesCount > 0 && !isExpanded}
				<span class="expand-indicator" title="Click to see all routes">⋯</span>
			{/if}
		</div>
	{/if}
</div>
```

Note the `<span class="sr-only">{stop.name}</span>` is replaced by `aria-label` on the button — the sr-only span inside a flex button interfered with dot centering, and `aria-label` gives the same accessible name in all four tiers.

Update the styles. Replace the `.custom-marker` rule and add the new ones; leave every other rule untouched:

```css
.marker-hit-area {
	@apply h-8 w-8;
	display: flex;
	justify-content: center;
	align-items: center;
	background: none;
	border: none;
	padding: 0;
	position: relative;
}

.marker-hit-area:hover {
	cursor: pointer;
}

.custom-marker {
	@apply h-8 w-8 rounded-md;
	@apply bg-white/80 dark:bg-neutral-200;
	@apply border-2 border-gray-400;
	display: flex;
	justify-content: center;
	align-items: center;
	position: relative;
}

.emphasis-dot {
	border-radius: 50%;
	display: block;
	flex: none;
}

/* "Beads on a string" along the drawn route: reads as a stop on a line the
   rider cares about, without competing with the line itself. */
.route-dot {
	height: 14px;
	width: 14px;
	background: #fff;
	border-width: 2.5px;
	border-style: solid;
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.28);
}

/* Present for spatial context, but recedes. The white halo keeps it legible on
   a dark basemap without adding visual weight. */
.muted-dot {
	height: 9px;
	width: 9px;
	background: #8b93a1;
	opacity: 0.6;
	box-shadow: 0 0 0 2px rgb(255 255 255 / 0.65);
}
```

Also update `.highlight` to tint the caret, which does not exist today:

```css
.highlight {
	@apply border-brand-accent scale-125 drop-shadow-md;
}

/* The caret is otherwise hard-coded black; tint it to match the selected
   marker's brand-accent border. */
.highlight .direction-arrow {
	@apply text-brand-accent;
}

:global(.dark) .highlight .direction-arrow {
	@apply text-brand;
}
```

Because `.direction-arrow` carries `dark:text-white` from the markup, add `!important`-free specificity by keeping these rules after it in the file.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/map/__tests__/StopMarker.test.js`
Expected: all PASS.

- [ ] **Step 5: Verify with the Svelte MCP autofixer**

Call `mcp__svelte__svelte-autofixer` with the full contents of `StopMarker.svelte`. Apply any corrections it reports, then re-run the tests. Call it again to confirm the file is clean.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/components/map/StopMarker.svelte src/components/map/__tests__/StopMarker.test.js
git add src/components/map/StopMarker.svelte src/components/map/__tests__/StopMarker.test.js
git commit -m "feat: add emphasis tiers to StopMarker

A 32px pin carries the same visual weight dimmed or not, so background stops
collapse to dots instead — keeping position, dropping the icon and the caret
clutter. The button keeps its 32px hit area in every tier."
```

---

## Task 7: Provider emphasis, dimming, and casing

**Files:**

- Modify: `src/lib/Provider/OpenStreetMapProvider.svelte.js`
- Modify: `src/lib/Provider/GoogleMapProvider.svelte.js`
- Modify: `src/assets/styles/leaflet-map.css`
- Test: `src/tests/lib/OpenStreetMapProvider.test.js`, `src/tests/lib/GoogleMapProvider.test.js`

**Interfaces:**

- Consumes: `StopMarker`'s `emphasis` / `dotColor` props from Task 6.
- Produces, on **both** providers:

```js
addMarker({ position, stop, isHighlighted, emphasis, dotColor, onClick }); // two new option keys
setStopEmphasis(byStopId, defaultEmphasis, selectedStopId); // Map<stopId, {emphasis, dotColor}>
resetStopEmphasis(); // all markers back to 'full'
setBasemapDimmed(dimmed);
createPolyline(points, { color, casing, pane, weight, withArrow, opacity, dashArray });
```

Panes on OSM: `obaRouteCasing` (z 402), `obaRoute` (403), `obaRoutePromoted` (404).

- [ ] **Step 1: Write the failing tests (OSM)**

Add to `src/tests/lib/OpenStreetMapProvider.test.js`:

```js
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
```

For the casing, add to the same file. The file's existing `makeFakeL(fakeMarker)` helper returns only `{ divIcon, marker }`, so extend it with the polyline pieces `createPolyline` needs — add these keys to `makeFakeL` itself so every existing caller keeps working:

```js
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
```

`createPolyline` decodes with `PolylineUtil.decode`, so mock that module at the top of the file:

```js
vi.mock('polyline-encoded', () => ({
	default: {
		decode: vi.fn(() => [
			[47.6, -122.3],
			[47.61, -122.31]
		])
	}
}));
```

Then:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/OpenStreetMapProvider.test.js`
Expected: FAIL — the new methods and the `casing` option do not exist.

- [ ] **Step 3: Implement on the OSM provider**

Add pane creation at the end of `initMap`, after the maplibre layer is added:

Custom panes give the route layer explicit stacking: every casing below every colored stroke, and the promoted route above its peers. `createPane` does **not** assign a z-index — `.leaflet-pane` sets 400 for all of them — so it must be set here, or the panes tie with `overlayPane` and order only by DOM insertion. The constants come from the new `$lib/mapPanes.js` defined just below.

Put the pane names in a **provider-neutral** module so `StopRoutesLayer` can reference them without importing the OSM provider — importing it would pull Leaflet, MapLibre, and `leaflet.css` into the bundle even on deployments configured for Google.

Create `src/lib/mapPanes.js`:

```js
/**
 * Stacking layers for the stop-selection route overlay.
 *
 * The OSM provider maps these to Leaflet panes (whose z-index it assigns
 * explicitly — createPane does not). The Google provider maps them to Polyline
 * zIndex values. Callers pick a layer by name and stay provider-agnostic.
 *
 * Every casing must render below every colored stroke, or one route's casing
 * paints over its neighbor's line. The promoted layer carries the route whose
 * arrival the rider has expanded.
 */
export const ROUTE_PANE = {
	CASING: 'obaRouteCasing',
	LINE: 'obaRoute',
	PROMOTED: 'obaRoutePromoted'
};

/** Leaflet pane z-indexes. Below markerPane (600) so markers stay on top. */
export const ROUTE_PANE_Z_INDEX = {
	[ROUTE_PANE.CASING]: 402,
	[ROUTE_PANE.LINE]: 403,
	[ROUTE_PANE.PROMOTED]: 404
};
```

and import it in the OSM provider's `initMap`:

```js
import { ROUTE_PANE_Z_INDEX } from '$lib/mapPanes.js';
// ...
for (const [name, zIndex] of Object.entries(ROUTE_PANE_Z_INDEX)) {
	this.map.createPane(name);
	this.map.getPane(name).style.zIndex = String(zIndex);
}
```

Add the emphasis and dim methods next to `highlightMarker`:

```js
/**
 * Applies marker prominence across the map. Called by the map layer whenever the
 * selection or the drawn route set changes.
 *
 * @param {Map<string, {emphasis: string, dotColor: string|null}>} byStopId
 * @param {'full'|'muted'} defaultEmphasis - for stops not in byStopId
 * @param {string|null} selectedStopId - always rendered as the full pin
 */
setStopEmphasis(byStopId, defaultEmphasis = 'full', selectedStopId = null) {
    for (const [stopId, marker] of this.markersMap) {
        // addStopRouteMarker writes plain markers into markersMap on the Google
        // provider; those have no reactive props to mutate.
        if (!marker?.props) continue;

        if (stopId === selectedStopId) {
            marker.props.emphasis = 'full';
            marker.props.dotColor = null;
            continue;
        }

        const tier = byStopId.get(stopId);
        marker.props.emphasis = tier?.emphasis ?? defaultEmphasis;
        marker.props.dotColor = tier?.dotColor ?? null;
    }
}

resetStopEmphasis() {
    for (const marker of this.markersMap.values()) {
        if (!marker?.props) continue;
        marker.props.emphasis = 'full';
        marker.props.dotColor = null;
    }
}

/**
 * Fades the basemap so the colored routes and vehicles carry the map.
 *
 * The MapLibre GL canvas is the only thing in Leaflet's tilePane, so a CSS
 * filter scoped there dims the basemap and nothing else — routes and markers
 * live in overlayPane/markerPane and keep full contrast. The class goes on the
 * container rather than the layer so it survives setTheme's layer rebuild.
 */
setBasemapDimmed(dimmed) {
    if (!browser || !this.map) return;
    this.map.getContainer().classList.toggle('oba-dim-basemap', dimmed);
}
```

Add `emphasis` and `dotColor` to the `$state` literal in `addMarker` (currently line 123). Seed them at creation rather than patching after: `batchAddMarkers` defers `addMarker` into a `requestAnimationFrame`, so a caller that patched emphasis right after would find `markersMap` still empty and leave panned-in stops as full pins.

```js
const props = $state({
	stop: options.stop,
	icon: icon,
	onClick: options.onClick,
	isHighlighted: options.isHighlighted ?? false,
	showRoutesLabel: this.map.getZoom() >= this.showStopsRoutesAtZoom,
	emphasis: options.emphasis ?? 'full',
	dotColor: options.dotColor ?? null
});
```

Extend `createPolyline` for casing and panes. Insert before the colored polyline is created, and pass the pane through to both the polyline and the arrow decorator:

```js
const weight = options.weight || 4;
const pane = options.pane;

// White casing underneath, so the route reads on any basemap tile without a
// halo hack. Created first so it renders below; kept off this.polylines (like
// arrowDecorator) so fitToPolylines/getPolylinesCount/_getRoutePaths don't
// double-count it, and torn down with its polyline.
let casing = null;
if (options.casing) {
	casing = new this.L.Polyline(decodedPolyline, {
		color: '#ffffff',
		weight: weight + 5,
		opacity: 0.95,
		lineCap: 'round',
		lineJoin: 'round',
		...(options.casingPane ? { pane: options.casingPane } : {})
	}).addTo(this.map);
}

const polylineOpts = {
	color: options.color || COLORS.POLYLINE,
	weight,
	opacity: options.opacity ?? 1,
	lineCap: 'round',
	lineJoin: 'round'
};
if (pane) polylineOpts.pane = pane;
if (options.dashArray) {
	polylineOpts.dashArray = options.dashArray;
}
const polyline = new this.L.Polyline(decodedPolyline, polylineOpts).addTo(this.map);
polyline._casing = casing;

this.polylines.push(polyline);
```

In the arrow decorator's `pathOptions`, add the pane — without it, `L.Symbol.arrowHead` builds its polyline in `overlayPane` (400) and every arrow disappears under the casings at 402:

```js
pathOptions: {
    color: arrowColor,
    fill: true,
    fillColor: arrowColor,
    fillOpacity: 0.85,
    ...(pane ? { pane } : {})
}
```

In `removePolyline` and `clearAllPolylines`, remove the casing alongside the arrow decorator — same shape as the existing `arrowDecorator` handling:

```js
if (polyline._casing) {
	polyline._casing.remove();
	polyline._casing = null;
}
```

- [ ] **Step 4: Add the dim CSS**

Append to `src/assets/styles/leaflet-map.css`:

```css
/* Basemap dim for stop selection. Scoped to the tile pane, which holds only the
   MapLibre GL canvas — routes (overlayPane and the oba route panes) and markers
   (markerPane) keep full contrast. Transitioned so selecting a stop doesn't
   snap. */
.leaflet-container.oba-dim-basemap .leaflet-tile-pane {
	filter: saturate(0.55) brightness(1.05) opacity(0.72);
}

.leaflet-container .leaflet-tile-pane {
	transition: filter 220ms ease;
}

@media (prefers-reduced-motion: reduce) {
	.leaflet-container .leaflet-tile-pane {
		transition: none;
	}
}
```

- [ ] **Step 5: Mirror on the Google provider**

Add the same `setStopEmphasis` and `resetStopEmphasis` (identical bodies — they only touch `markersMap` and `marker.props`), and add `emphasis`/`dotColor` to its `$state` literal at line 100.

Google has no panes, so it maps the same layer names to `zIndex` values. Add near the top of the module:

```js
import { ROUTE_PANE } from '$lib/mapPanes.js';

// Google orders polylines by zIndex rather than by pane. Same contract as the
// OSM panes: every casing below every colored stroke, promoted above its peers.
const ROUTE_LAYER_Z_INDEX = {
	[ROUTE_PANE.CASING]: 10,
	[ROUTE_PANE.LINE]: 20,
	[ROUTE_PANE.PROMOTED]: 30
};
```

Then in `createPolyline`, honor `pane`/`casingPane` and draw the casing:

```js
const weight = options.weight || 5;
const zIndex = ROUTE_LAYER_Z_INDEX[options.pane];

if (zIndex !== undefined) {
	polylineOptions.zIndex = zIndex;
}
polylineOptions.strokeWeight = weight;

if (options.casing) {
	polyline._casing = new google.maps.Polyline({
		path,
		geodesic: true,
		strokeColor: '#ffffff',
		strokeOpacity: 0.95,
		strokeWeight: weight + 5,
		zIndex: ROUTE_LAYER_Z_INDEX[options.casingPane] ?? ROUTE_LAYER_Z_INDEX[ROUTE_PANE.CASING],
		map: this.map
	});
}
```

and remove it in `removePolyline` / `clearAllPolylines` with `polyline._casing.setMap(null)`, keeping it out of `this.polylines` exactly as on OSM.

For dimming, both `setTheme` and `setBasemapDimmed` must compose through one place, because `setTheme` replaces `styles` wholesale and would otherwise wipe the dim on the next `themeChange` event (one is dispatched unconditionally at `MapView.svelte:275`):

```js
/**
 * Google replaces the whole `styles` array on setOptions, so theme and dim have
 * to be composed in one place — otherwise a theme toggle silently drops the dim.
 */
_applyStyles() {
    const base = this._darkTheme ? nightModeStyles() : [];
    const dim = this._dimmed
        ? [{ featureType: 'all', elementType: 'all', stylers: [{ saturation: -45 }, { lightness: 25 }] }]
        : [];
    const styles = [...base, ...dim];
    this.map.setOptions({ styles: styles.length ? styles : null });
}

setTheme(theme) {
    this._darkTheme = theme === 'dark';
    this._applyStyles();
}

setBasemapDimmed(dimmed) {
    this._dimmed = dimmed;
    this._applyStyles();
}
```

Initialize `this._darkTheme = false;` and `this._dimmed = false;` in the constructor.

- [ ] **Step 6: Add the matching Google tests**

Mirror the emphasis and casing tests in `src/tests/lib/GoogleMapProvider.test.js`, plus one for the composition bug:

```js
test('a theme change preserves the basemap dim', () => {
	const provider = makeProvider();
	const setOptions = vi.fn();
	provider.map = { setOptions };

	provider.setBasemapDimmed(true);
	provider.setTheme('dark');

	const lastStyles = setOptions.mock.calls.at(-1)[0].styles;
	expect(lastStyles.some((s) => s.stylers?.some((v) => 'saturation' in v))).toBe(true);
});
```

- [ ] **Step 7: Run all provider tests**

Run: `npx vitest run src/tests/lib/OpenStreetMapProvider.test.js src/tests/lib/GoogleMapProvider.test.js`
Expected: all PASS, including pre-existing tests.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/lib/Provider src/tests/lib src/assets/styles/leaflet-map.css
git add src/lib/Provider src/tests/lib src/assets/styles/leaflet-map.css
git commit -m "feat: add stop emphasis, basemap dimming, and polyline casing to both providers

Emphasis is seeded in addMarker rather than patched afterward, because
batchAddMarkers defers marker creation into a rAF and a later patch would miss
stops panned in mid-selection. Route panes get explicit z-indexes (createPane
does not assign one) and the arrow decorator inherits its polyline's pane, or
arrows render under the casings."
```

---

## Task 8: Multi-route vehicle polling

**Files:**

- Modify: `src/lib/vehicleUtils.js`
- Test: `src/lib/__tests__/vehicleUtils.test.js`

**Interfaces:**

- Consumes: `ActiveRoute[]` from Task 4 (uses `.id` and `.type`), `RouteColors` from Task 5.
- Produces:

```js
// BREAKING: was `{references:{trips:[]}, list:[]}` on failure, now null.
export async function fetchVehicles(routeId): Promise<Object|null>

export async function fetchAndUpdateVehiclesForRoutes(
    routes,      // [{ id, type }]
    mapProvider,
    { highlightedTripId = null, colorsByRouteId = new Map(), onCounts = null } = {}
): Promise<number>  // one interval id for all routes
```

`fetchAndUpdateVehicles(routeId, mapProvider, routeType, highlightedTripId, routeColor)` keeps its exact signature and behavior as a wrapper.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/__tests__/vehicleUtils.test.js`:

```js
import { fetchVehicles, fetchAndUpdateVehiclesForRoutes } from '$lib/vehicleUtils.js';

function tripsResponse(routeId, vehicles) {
	return {
		data: {
			references: { trips: vehicles.map((v) => ({ id: v.tripId, routeId })) },
			list: vehicles.map((v) => ({
				status: {
					activeTripId: v.tripId,
					vehicleId: v.vehicleId,
					position: { lat: 47.6, lon: -122.3 },
					predicted: true,
					orientation: 0
				}
			}))
		}
	};
}

function makeProvider() {
	return {
		addVehicleMarker: vi.fn((status) => ({ id: status.vehicleId })),
		updateVehicleMarker: vi.fn(),
		removeVehicleMarker: vi.fn()
	};
}

describe('fetchVehicles failure contract', () => {
	test('returns null when the request fails', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
		expect(await fetchVehicles('route_1')).toBeNull();
	});

	test('returns null for a malformed body', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
		expect(await fetchVehicles('route_1')).toBeNull();
	});

	test('returns the data for a well-formed empty response', async () => {
		global.fetch = vi
			.fn()
			.mockResolvedValue({ ok: true, json: async () => tripsResponse('route_1', []) });
		expect(await fetchVehicles('route_1')).toEqual({ references: { trips: [] }, list: [] });
	});
});

describe('fetchAndUpdateVehiclesForRoutes', () => {
	beforeEach(() => {
		clearVehicleMarkersMap();
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers();

	// The old per-route sweep deleted every marker absent from the single polled
	// route's active set, so three concurrent route polls each wiped the other two.
	test('polling three routes keeps all three routes markers', async () => {
		const provider = makeProvider();
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			return { ok: true, json: async () => tripsResponse(routeId, [{ tripId: `t_${routeId}`, vehicleId: `v_${routeId}` }]) };
		});

		const intervalId = await fetchAndUpdateVehiclesForRoutes(
			[{ id: 'r_a', type: 3 }, { id: 'r_b', type: 3 }, { id: 'r_c', type: 3 }],
			provider
		);
		clearInterval(intervalId);

		expect(provider.addVehicleMarker).toHaveBeenCalledTimes(3);
		expect(provider.removeVehicleMarker).not.toHaveBeenCalled();
	});

	test('removes only the vehicle a route stopped reporting', async () => {
		const provider = makeProvider();
		let secondTick = false;
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			const vehicles =
				routeId === 'r_a' && secondTick ? [] : [{ tripId: `t_${routeId}`, vehicleId: `v_${routeId}` }];
			return { ok: true, json: async () => tripsResponse(routeId, vehicles) };
		});

		const routes = [{ id: 'r_a', type: 3 }, { id: 'r_b', type: 3 }];
		const intervalId = await fetchAndUpdateVehiclesForRoutes(routes, provider);
		secondTick = true;
		await vi.advanceTimersByTimeAsync(30000);
		clearInterval(intervalId);

		expect(provider.removeVehicleMarker).toHaveBeenCalledTimes(1);
	});

	// fetchVehicles used to return an empty list for a failed request, which a
	// scoped sweep would read as "this route has no vehicles" and clear them all.
	test('a failed fetch for one route leaves that routes markers alone', async () => {
		const provider = makeProvider();
		let failSecond = false;
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			if (routeId === 'r_a' && failSecond) return { ok: false, status: 503 };
			return { ok: true, json: async () => tripsResponse(routeId, [{ tripId: `t_${routeId}`, vehicleId: `v_${routeId}` }]) };
		});

		const intervalId = await fetchAndUpdateVehiclesForRoutes(
			[{ id: 'r_a', type: 3 }, { id: 'r_b', type: 3 }],
			provider
		);
		failSecond = true;
		await vi.advanceTimersByTimeAsync(30000);
		clearInterval(intervalId);

		expect(provider.removeVehicleMarker).not.toHaveBeenCalled();
	});

	test('reports a live vehicle count per route', async () => {
		const provider = makeProvider();
		global.fetch = vi.fn(async (url) => {
			const routeId = url.split('/').pop();
			const count = routeId === 'r_a' ? 2 : 1;
			const vehicles = Array.from({ length: count }, (_, i) => ({
				tripId: `t_${routeId}_${i}`,
				vehicleId: `v_${routeId}_${i}`
			}));
			return { ok: true, json: async () => tripsResponse(routeId, vehicles) };
		});
		const onCounts = vi.fn();

		const intervalId = await fetchAndUpdateVehiclesForRoutes(
			[{ id: 'r_a', type: 3 }, { id: 'r_b', type: 3 }],
			provider,
			{ onCounts }
		);
		clearInterval(intervalId);

		const counts = onCounts.mock.calls.at(-1)[0];
		expect(counts.get('r_a')).toBe(2);
		expect(counts.get('r_b')).toBe(1);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/vehicleUtils.test.js`
Expected: FAIL — `fetchAndUpdateVehiclesForRoutes` is not exported, and `fetchVehicles` returns an empty object rather than `null`. **Existing tests asserting the old empty-object failure return will also fail; update them to expect `null`.**

- [ ] **Step 3: Rework `vehicleUtils.js`**

Change `fetchVehicles` to signal failure, and record route ownership per marker:

```js
/**
 * @type {Map<vehicleId, {marker, routeId}>}
 * Keyed by the physical vehicle id. The trips-for-route response can report the
 * same activeTripId for two different vehicles (e.g. the vehicle actually serving
 * the trip plus a second one still parked at the base), so keying by trip id
 * collapsed both into one marker that flipped between their positions on every
 * refresh. Falls back to activeTripId only when a status has no vehicleId.
 * see (https://developer.onebusaway.org/api/where/elements/trip-status)
 *
 * `routeId` records which route owns each marker, so a sweep across several
 * concurrently-polled routes only removes markers belonging to routes it
 * actually fetched.
 */
const vehicleMarkersMap = new Map();

/**
 * @returns {Promise<Object|null>} the trips-for-route payload, or `null` when
 * the request failed or came back malformed.
 *
 * Failure and emptiness must be distinguishable: a caller sweeping stale markers
 * across several routes would otherwise read a 500 as "this route has no
 * vehicles" and delete every marker the route owns.
 */
export async function fetchVehicles(routeId) {
	const response = await fetch(`/api/oba/trips-for-route/${routeId}`);
	if (!response.ok) {
		console.warn('fetchVehicles: request failed', routeId, response.status);
		return null;
	}
	const responseBody = await response.json();
	const data = responseBody.data;
	if (!data?.references?.trips || !Array.isArray(data.list)) {
		console.warn('fetchVehicles: unexpected response structure for route', routeId);
		return null;
	}
	return data;
}
```

Replace `updateVehicleMarkers` and `removeInactiveMarkers` with route-scoped versions and add the batched entry point:

```js
/**
 * Draws/updates the vehicles for one route from an already-fetched payload, and
 * returns the marker keys this route currently owns.
 */
function applyRouteVehicles(data, routeId, mapProvider, routeType, highlightedTripId, routeColor) {
	const activeKeys = new Set();

	for (const trip of data.references.trips) {
		if (!activeTripMap.has(trip.id)) {
			activeTripMap.set(trip.id, trip);
		}
	}

	for (const tripStatus of data.list) {
		const activeTripId = tripStatus?.status?.activeTripId;
		const activeTrip = activeTripMap.get(activeTripId);

		// OBA puts the trip state string on status.status (e.g. SCHEDULED, CANCELED), not on status itself
		if (activeTrip && activeTrip.routeId === routeId && tripStatus.status?.status !== 'CANCELED') {
			const vehicleStatus = tripStatus.status;
			const isHighlighted = highlightedTripId != null && activeTripId === highlightedTripId;
			const markerKey = vehicleStatus.vehicleId || activeTripId;

			activeKeys.add(markerKey);

			const existing = vehicleMarkersMap.get(markerKey);
			if (existing) {
				mapProvider.updateVehicleMarker(
					existing.marker,
					vehicleStatus,
					activeTrip,
					routeType,
					isHighlighted,
					routeColor
				);
				// A physical vehicle can move between routes across a shift; re-stamp
				// ownership so the sweep attributes it to the route reporting it now.
				existing.routeId = routeId;
			} else {
				const marker = mapProvider.addVehicleMarker(
					vehicleStatus,
					activeTrip,
					routeType,
					isHighlighted,
					routeColor
				);
				vehicleMarkersMap.set(markerKey, { marker, routeId });
			}
		}
	}

	return activeKeys;
}

/**
 * Removes markers that are no longer active — but only among routes we actually
 * polled successfully. A route whose fetch failed keeps its markers.
 */
export function removeInactiveMarkers(activeKeys, mapProvider, polledRouteIds = null) {
	for (const [markerKey, entry] of vehicleMarkersMap) {
		if (polledRouteIds && !polledRouteIds.has(entry.routeId)) continue;
		if (!activeKeys.has(markerKey)) {
			mapProvider.removeVehicleMarker(entry.marker);
			vehicleMarkersMap.delete(markerKey);
		}
	}
}

const VEHICLE_POLL_INTERVAL_MS = 30000;

/**
 * Polls several routes' vehicles on one interval.
 *
 * @param {Array<{id: string, type?: number}>} routes
 * @param {Object} mapProvider
 * @param {{highlightedTripId?: string|null, colorsByRouteId?: Map<string,{line:string}>, onCounts?: Function}} [options]
 * @returns {Promise<number>} interval id
 */
export async function fetchAndUpdateVehiclesForRoutes(
	routes,
	mapProvider,
	{ highlightedTripId = null, colorsByRouteId = new Map(), onCounts = null } = {}
) {
	const tick = async () => {
		const results = await Promise.all(
			routes.map((route) =>
				fetchVehicles(route.id).catch((error) => {
					console.error('fetchAndUpdateVehiclesForRoutes: fetch failed', route.id, error);
					return null;
				})
			)
		);

		const activeKeys = new Set();
		const polledRouteIds = new Set();
		const counts = new Map();

		routes.forEach((route, index) => {
			const data = results[index];
			// null means the fetch failed, which is NOT the same as "no vehicles".
			// Leave this route out of the sweep scope so its markers survive.
			if (!data) return;

			polledRouteIds.add(route.id);
			const routeKeys = applyRouteVehicles(
				data,
				route.id,
				mapProvider,
				route.type,
				highlightedTripId,
				colorsByRouteId.get(route.id)?.line
			);
			routeKeys.forEach((key) => activeKeys.add(key));
			counts.set(route.id, routeKeys.size);
		});

		removeInactiveMarkers(activeKeys, mapProvider, polledRouteIds);
		if (onCounts) onCounts(counts);
	};

	try {
		await tick();
	} catch (error) {
		console.error('fetchAndUpdateVehiclesForRoutes: initial tick failed', error);
	}

	return setInterval(() => {
		tick().catch((error) => {
			console.error('fetchAndUpdateVehiclesForRoutes: polling tick failed', error);
		});
	}, VEHICLE_POLL_INTERVAL_MS);
}

/**
 * Single-route wrapper, kept so SearchPane and RouteMap run through the same
 * code path. Signature and behavior are unchanged.
 */
export async function fetchAndUpdateVehicles(
	routeId,
	mapProvider,
	routeType,
	highlightedTripId = null,
	routeColor = undefined
) {
	return fetchAndUpdateVehiclesForRoutes([{ id: routeId, type: routeType }], mapProvider, {
		highlightedTripId,
		colorsByRouteId: routeColor ? new Map([[routeId, { line: routeColor }]]) : new Map()
	});
}
```

Keep `updateVehicleMarkers` exported as a thin single-route wrapper if the existing test file imports it; otherwise remove it and delete those tests.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/vehicleUtils.test.js`
Expected: all PASS.

- [ ] **Step 5: Verify the existing callers still work**

Run: `npx vitest run src/components/search/__tests__/SearchPane.test.js`
Expected: PASS — `fetchAndUpdateVehicles` is unchanged from `SearchPane`'s perspective.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/lib/vehicleUtils.js src/lib/__tests__/vehicleUtils.test.js
git add src/lib/vehicleUtils.js src/lib/__tests__/vehicleUtils.test.js
git commit -m "feat: poll several routes' vehicles on one interval

The old sweep removed every marker absent from the single polled route's active
set, so N concurrent route polls each deleted the other N-1 routes' vehicles.
Scope the sweep to routes that actually fetched successfully, which needs
fetchVehicles to distinguish failure (now null) from a genuinely empty route."
```

---

## Task 9: Plumb arrivals and colors through to the map and the badges

**Files:**

- Modify: `src/components/stops/StopBottomSheet.svelte`
- Modify: `src/components/stops/StopPane.svelte`
- Modify: `src/components/ArrivalDeparture.svelte`
- Modify: `src/components/MapExperience.svelte`
- Test: `src/components/__tests__/ArrivalDeparture.test.js`, `src/components/__tests__/MapExperience.test.js`

**Interfaces:**

- Consumes: `activeRoutesFromArrivals` and `assignRouteColors` from Tasks 4-5.
- Produces: `MapExperience` exposes `stopArrivals`, `activeRoutes` (`ActiveRoute[]`), and `routeColors` (`Map<string, RouteColors>`), passed to `MapContainer` (which spreads `...restProps` into `MapView`) and down the sheet to `RouteBadge`.

- [ ] **Step 1: Write the failing test for the badge**

Add to `src/components/__tests__/ArrivalDeparture.test.js`:

```js
describe('route colors', () => {
	const arrival = {
		routeId: 'r_c',
		routeShortName: 'C Line',
		tripHeadsign: 'Downtown Seattle',
		scheduledArrivalTime: Date.now() + 300000,
		predictedArrivalTime: Date.now() + 300000,
		predicted: true,
		stopSequence: 1
	};

	test('uses the resolved route color for the badge when provided', () => {
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: arrival,
				route: { id: 'r_c', shortName: 'C Line', color: 'b02a37', textColor: 'ffffff' },
				routeColors: { line: '#1565C0', badgeBg: '1565C0', badgeFg: 'ffffff' }
			}
		});
		expect(screen.getByText('C Line')).toHaveStyle('background-color: #1565C0');
		expect(screen.getByText('C Line')).toHaveStyle('color: #ffffff');
	});

	test('falls back to the GTFS color when no resolved color is given', () => {
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: arrival,
				route: { id: 'r_c', shortName: 'C Line', color: 'b02a37', textColor: 'ffffff' }
			}
		});
		expect(screen.getByText('C Line')).toHaveStyle('background-color: #b02a37');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/__tests__/ArrivalDeparture.test.js`
Expected: FAIL — the badge still uses `b02a37`.

- [ ] **Step 3: Thread the prop through the sheet**

In `src/components/ArrivalDeparture.svelte`, add to the props:

```js
let {
	arrivalDeparture,
	includeArrivalDepartureInStatusLabel = true,
	route = null,
	expanded = false,
	// Resolved by the map layer so the badge, the polyline, the vehicle markers,
	// and the legend all use one color per route. mapContrastColor adjusts most
	// GTFS colors for the basemap, so without this the badge and the line would
	// differ for nearly every route in dark mode.
	routeColors = null
} = $props();
```

and where `RouteBadge` is rendered, prefer the resolved values:

```svelte
<RouteBadge
	shortName={routeShortName}
	color={routeColors?.badgeBg ?? route?.color}
	textColor={routeColors?.badgeFg ?? route?.textColor}
/>
```

In `src/components/stops/StopPane.svelte`, accept and forward:

```js
let {
	stop,
	handleUpdateRouteMap = null,
	tripSelected = null,
	showHeroCard = true,
	arrivalsAndDeparturesResponse = $bindable(null),
	loading = $bindable(false),
	routeColors = null
} = $props();
```

```svelte
<ArrivalDeparture
	arrivalDeparture={arrival}
	route={routeById.get(arrival.routeId)}
	routeColors={routeColors?.get(arrival.routeId) ?? null}
	expanded={isActive}
/>
```

In `src/components/stops/StopBottomSheet.svelte`, promote the response to a binding and forward `routeColors`:

```js
let {
	stop,
	closePane,
	tripSelected,
	handleUpdateRouteMap,
	snap = $bindable('half'),
	// Bound up to MapExperience so the map layer can draw the routes behind
	// these arrivals without issuing a second fetch.
	arrivalsAndDeparturesResponse = $bindable(null),
	routeColors = null
} = $props();
```

Remove the local `let arrivalsAndDeparturesResponse = $state(null);` declaration and pass `{routeColors}` into `<StopPane>`.

- [ ] **Step 4: Wire up `MapExperience`**

In `src/components/MapExperience.svelte`, add imports and derivations:

```js
import { activeRoutesFromArrivals, assignRouteColors } from '$lib/activeRoutes.js';
```

```js
// Bound up from StopBottomSheet -> StopPane, so the map draws the routes behind
// the arrivals the rider is actually looking at, with no second fetch.
let stopArrivals = $state(null);
let isDarkMode = $state(false);

// Gate on the stop id, not on truthiness: tapping stop A -> stop B keeps the
// sheet mounted, so `stopArrivals` still holds A's response until B's fetch
// lands. Without this the map would briefly draw A's routes around B's marker.
let arrivalsMatchSelection = $derived(
	stopArrivals?.data?.entry?.stopId != null && stopArrivals.data.entry.stopId === selectedStopId
);
let activeRoutes = $derived(arrivalsMatchSelection ? activeRoutesFromArrivals(stopArrivals) : []);
let routeColors = $derived(assignRouteColors(activeRoutes, { dark: isDarkMode }));
```

Track the theme so colors recompute on toggle:

```js
onMount(() => {
	// ...existing body...
	if (browser) {
		isDarkMode = document.documentElement.classList.contains('dark');
		const onThemeChange = (event) => {
			isDarkMode = event.detail.darkMode;
		};
		window.addEventListener('themeChange', onThemeChange);
		themeChangeHandler = onThemeChange;
	}
});
```

Declare `let themeChangeHandler = null;` alongside the other handler variables and remove the listener in `onDestroy`.

In the framing effect's `if (id)` branch, clear the previous stop's arrivals before framing:

```js
// Stop A -> stop B keeps the sheet mounted, so without this the map would keep
// drawing A's routes, ring dots, and vehicles around B's marker until B's
// arrivals land ~300ms later.
stopArrivals = null;
```

Update the markup to bind and forward:

```svelte
<StopBottomSheet
	stop={selectedStopData}
	{closePane}
	{tripSelected}
	{handleUpdateRouteMap}
	{routeColors}
	bind:arrivalsAndDeparturesResponse={stopArrivals}
	bind:snap={sheetSnap}
/>
```

```svelte
<MapContainer
	{selectedTrip}
	{selectedRoute}
	stop={selectedStopData}
	{handleStopMarkerSelect}
	{isRouteSelected}
	{showRouteMap}
	{initialCoords}
	{activeRoutes}
	{routeColors}
	bind:mapProvider
/>
```

`MapContainer` already spreads `...restProps` into `MapView`, so no change is needed there.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/__tests__ src/components/stops/__tests__`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/components/ArrivalDeparture.svelte src/components/stops src/components/MapExperience.svelte src/components/__tests__
git add src/components src/components/stops
git commit -m "feat: resolve route colors once and share them with map and badges

Arrivals now bind up from StopPane to MapExperience, which derives the active
route set and one color per route, then feeds both the map layer and the
arrival badges. Nulls the response between selections so the map can't draw the
previous stop's routes around the new stop."
```

---

## Task 10: The stop routes layer

**Files:**

- Create: `src/components/map/StopRoutesLayer.svelte`
- Test: `src/components/map/__tests__/StopRoutesLayer.test.js` (create)

**Interfaces:**

- Consumes: `ActiveRoute[]` and `Map<string, RouteColors>` (Tasks 4-5), provider `createPolyline`/`revealPolylines`/`clearAllPolylines` (Tasks 3, 7), `fetchAndUpdateVehiclesForRoutes` (Task 8), `ROUTE_PANE` (Task 7).
- Produces: `routeStopIds = $bindable(new Map())` — `Map<stopId, string>` from stop id to that stop's ring-dot color, consumed by `MapView` in Task 12. Also `liveCounts = $bindable(new Map())` for the legend.

- [ ] **Step 1: Write the failing tests**

Create `src/components/map/__tests__/StopRoutesLayer.test.js`:

```js
import { render } from '@testing-library/svelte';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import StopRoutesLayer from '../StopRoutesLayer.svelte';

vi.mock('$lib/vehicleUtils.js', () => ({
	fetchAndUpdateVehiclesForRoutes: vi.fn().mockResolvedValue(42),
	clearVehicleMarkersMap: vi.fn()
}));
import { fetchAndUpdateVehiclesForRoutes, clearVehicleMarkersMap } from '$lib/vehicleUtils.js';
import { createLayerBindings } from './support/layerBindings.svelte.js';

function makeProvider() {
	return {
		createPolyline: vi.fn(async () => ({ id: 'polyline' })),
		revealPolylines: vi.fn(),
		clearAllPolylines: vi.fn(),
		clearVehicleMarkers: vi.fn()
	};
}

const routes = [
	{ id: 'r_c', shortName: 'C Line', type: 3, tripId: 't_c', gtfsColor: 'b02a37' },
	{ id: 'r_22', shortName: '22', type: 3, tripId: 't_22', gtfsColor: 'e0a021' }
];
const colors = new Map([
	['r_c', { line: '#b02a37', badgeBg: 'b02a37', badgeFg: 'ffffff' }],
	['r_22', { line: '#e0a021', badgeBg: 'e0a021', badgeFg: '000000' }]
]);

function mockShapeFetches({ failRouteId = null } = {}) {
	global.fetch = vi.fn(async (url) => {
		if (url.includes('/trip-details/')) {
			const tripId = url.split('/trip-details/')[1].split('?')[0];
			if (failRouteId && tripId === `t_${failRouteId.replace('r_', '')}`) {
				return { ok: false, status: 500 };
			}
			return {
				ok: true,
				json: async () => ({
					data: {
						entry: { schedule: { stopTimes: [{ stopId: `stop_${tripId}` }] } },
						references: { trips: [{ id: tripId, shapeId: `shape_${tripId}` }] }
					}
				})
			};
		}
		return { ok: true, json: async () => ({ data: { entry: { points: 'encoded' } } }) };
	});
}

describe('StopRoutesLayer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockShapeFetches();
	});

	test('draws one polyline per active route, in its resolved color', async () => {
		const mapProvider = makeProvider();
		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		const usedColors = mapProvider.createPolyline.mock.calls.map(([, options]) => options.color);
		expect(usedColors).toEqual(expect.arrayContaining(['#b02a37', '#e0a021']));
	});

	test('requests casings and skips the status payload it does not need', async () => {
		const mapProvider = makeProvider();
		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalled());
		expect(mapProvider.createPolyline.mock.calls[0][1].casing).toBe(true);
		const tripDetailsUrl = global.fetch.mock.calls
			.map(([url]) => url)
			.find((u) => u.includes('/trip-details/'));
		expect(tripDetailsUrl).toContain('includeStatus=false');
	});

	// $bindable writes land on the parent's reactive state, and $state is a runes
	// macro that only compiles in a .svelte/.svelte.js module — so a plain
	// .test.js can't create the proxy to read back. Use a support harness, the
	// same pattern as the existing support/reactiveStop.svelte.js.
	test('reports the ring-dot stops from the drawn trips', async () => {
		const mapProvider = makeProvider();
		const bindings = createLayerBindings();
		render(StopRoutesLayer, {
			props: {
				mapProvider,
				activeRoutes: routes,
				routeColors: colors,
				get routeStopIds() {
					return bindings.routeStopIds;
				},
				set routeStopIds(value) {
					bindings.routeStopIds = value;
				}
			}
		});

		await vi.waitFor(() => expect(bindings.routeStopIds.size).toBe(2));
		expect(bindings.routeStopIds.get('stop_t_c')).toBe('#b02a37');
	});

	test('drops a route whose shape fetch fails without losing the others', async () => {
		mockShapeFetches({ failRouteId: 'r_22' });
		const mapProvider = makeProvider();
		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1));
		expect(mapProvider.createPolyline.mock.calls[0][1].color).toBe('#b02a37');
	});

	test('starts one vehicle poll for all routes', async () => {
		const mapProvider = makeProvider();
		render(StopRoutesLayer, { props: { mapProvider, activeRoutes: routes, routeColors: colors } });

		await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalledTimes(1));
		expect(fetchAndUpdateVehiclesForRoutes.mock.calls[0][0]).toHaveLength(2);
	});

	test('tears down polylines, vehicles, and the interval on destroy', async () => {
		const mapProvider = makeProvider();
		const { unmount } = render(StopRoutesLayer, {
			props: { mapProvider, activeRoutes: routes, routeColors: colors }
		});
		await vi.waitFor(() => expect(fetchAndUpdateVehiclesForRoutes).toHaveBeenCalled());

		unmount();

		expect(mapProvider.clearAllPolylines).toHaveBeenCalled();
		expect(mapProvider.clearVehicleMarkers).toHaveBeenCalled();
		expect(clearVehicleMarkersMap).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Add the bindings support harness**

Create `src/components/map/__tests__/support/layerBindings.svelte.js`:

```js
// Test-only helper: $state is a runes macro, so it only compiles inside a
// .svelte/.svelte.js module — a plain .test.js can't create the reactive proxy
// a $bindable prop writes back into. Mirrors support/reactiveStop.svelte.js.
export function createLayerBindings() {
	let routeStopIds = $state(new Map());
	let liveCounts = $state(new Map());
	return {
		get routeStopIds() {
			return routeStopIds;
		},
		set routeStopIds(value) {
			routeStopIds = value;
		},
		get liveCounts() {
			return liveCounts;
		},
		set liveCounts(value) {
			liveCounts = value;
		}
	};
}
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/map/__tests__/StopRoutesLayer.test.js`
Expected: FAIL — the component does not exist.

- [ ] **Step 4: Implement the layer**

Create `src/components/map/StopRoutesLayer.svelte`:

```svelte
<!--
    @component
    Draws the routes a rider can actually board from the selected stop, plus the
    live vehicles feeding those arrivals.

    Deliberately narrower than RouteMap, which draws a single trip's shape and
    clears the map first. This layer draws one shape per *route* in the arrivals
    list and owns its own teardown, so a stop selection and a trip expansion can
    coexist.

    @prop {Object} mapProvider
    @prop {ActiveRoute[]} activeRoutes - soonest arrival first; drives draw order
    @prop {Map<string, RouteColors>} routeColors
    @prop {string|null} promotedRouteId - the expanded arrival's route, drawn on top
    @prop {string|null} highlightedTripId - the expanded arrival's trip; its vehicle glows
    @prop {Map<string,string>} routeStopIds - bindable out: stop id -> ring-dot color
    @prop {Map<string,number>} liveCounts - bindable out: route id -> live vehicle count
-->
<script>
	import { onDestroy } from 'svelte';
	import { fetchAndUpdateVehiclesForRoutes, clearVehicleMarkersMap } from '$lib/vehicleUtils.js';
	// From the provider-neutral module, NOT from a provider: importing either
	// provider here would pull its whole map stack into the bundle regardless of
	// which one PUBLIC_OBA_MAP_PROVIDER selects.
	import { ROUTE_PANE } from '$lib/mapPanes.js';

	let {
		mapProvider,
		activeRoutes = [],
		routeColors = new Map(),
		promotedRouteId = null,
		highlightedTripId = null,
		routeStopIds = $bindable(new Map()),
		liveCounts = $bindable(new Map())
	} = $props();

	// Widest route draws first and each subsequent route is a little narrower, so
	// a route underneath shows as a colored fringe either side of the one above
	// it. This is what keeps two routes legible in a shared corridor: all casings
	// live in one pane below all colored strokes, so the fringe isn't covered.
	// A true perpendicular offset would need a zoom-reactive screen-space
	// transform and has no cross-provider primitive — see the design spec.
	const BASE_WEIGHT = 7;
	const MIN_WEIGHT = 4;

	let vehicleIntervalId = null;
	// Incremented per load so a superseded selection's in-flight fetches bail out
	// instead of drawing over the newer one.
	let loadToken = 0;

	function weightFor(index) {
		return Math.max(MIN_WEIGHT, BASE_WEIGHT - index);
	}

	async function fetchRouteShape(route) {
		// includeStatus=false: the endpoint defaults it to true, and we need only
		// the shape id and the stop times.
		const tripResponse = await fetch(`/api/oba/trip-details/${route.tripId}?includeStatus=false`);
		if (!tripResponse.ok) {
			throw new Error(`trip-details ${tripResponse.status} for trip ${route.tripId}`);
		}
		const tripData = await tripResponse.json();

		const tripRef = tripData?.data?.references?.trips?.find((trip) => trip.id === route.tripId);
		const shapeId = tripRef?.shapeId;
		if (!shapeId) {
			throw new Error(`no shapeId for trip ${route.tripId}`);
		}

		const shapeResponse = await fetch(`/api/oba/shape/${shapeId}`);
		if (!shapeResponse.ok) {
			throw new Error(`shape ${shapeResponse.status} for shape ${shapeId}`);
		}
		const shapeData = await shapeResponse.json();

		const stopIds = (tripData?.data?.entry?.schedule?.stopTimes ?? [])
			.map((stopTime) => stopTime.stopId)
			.filter(Boolean);

		return { points: shapeData?.data?.entry?.points, stopIds };
	}

	async function drawRoutes(routes, colors, token) {
		const nextStopIds = new Map();

		await Promise.all(
			routes.map(async (route, index) => {
				const color = colors.get(route.id)?.line;
				let shape;
				try {
					shape = await fetchRouteShape(route);
				} catch (error) {
					// One missing shape degrades the map rather than breaking it: the
					// other routes still draw, and this one is simply absent from the
					// lines, the legend, and the ring dots.
					console.error('StopRoutesLayer: could not load shape', route.id, error);
					return;
				}
				if (token !== loadToken || !shape.points) return;

				const isPromoted = promotedRouteId != null && route.id === promotedRouteId;
				const polyline = await mapProvider.createPolyline(shape.points, {
					color,
					casing: true,
					weight: weightFor(index),
					pane: isPromoted ? ROUTE_PANE.PROMOTED : ROUTE_PANE.LINE,
					casingPane: ROUTE_PANE.CASING
				});
				if (token !== loadToken) return;
				if (!polyline) return;

				// Reveal only this route: its neighbors may already be drawn, and
				// re-animating them on every resolution would look like a glitch.
				mapProvider.revealPolylines({ only: [polyline], duration: 0.8 });

				// First route to claim a stop wins, and routes arrive soonest-first,
				// so a shared stop takes the color of the route arriving next.
				for (const stopId of shape.stopIds) {
					if (!nextStopIds.has(stopId)) nextStopIds.set(stopId, color);
				}
				routeStopIds = new Map(nextStopIds);
			})
		);
	}

	function stopVehiclePolling() {
		if (vehicleIntervalId) {
			clearInterval(vehicleIntervalId);
			vehicleIntervalId = null;
		}
	}

	function teardown() {
		stopVehiclePolling();
		mapProvider.clearAllPolylines();
		mapProvider.clearVehicleMarkers();
		// clearVehicleMarkers only detaches markers; the module-level map would
		// otherwise hand stale entries to the next selection.
		clearVehicleMarkersMap();
	}

	$effect(() => {
		const routes = activeRoutes;
		const colors = routeColors;
		const token = ++loadToken;

		if (!mapProvider || routes.length === 0) return;

		teardown();
		drawRoutes(routes, colors, token);

		fetchAndUpdateVehiclesForRoutes(routes, mapProvider, {
			highlightedTripId,
			colorsByRouteId: colors,
			onCounts: (counts) => {
				if (token === loadToken) liveCounts = counts;
			}
		}).then((intervalId) => {
			// A newer load took over while this poll was starting; don't leak it.
			if (token !== loadToken) {
				clearInterval(intervalId);
				return;
			}
			vehicleIntervalId = intervalId;
		});
	});

	onDestroy(() => {
		loadToken++;
		teardown();
	});
</script>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/map/__tests__/StopRoutesLayer.test.js`
Expected: all PASS.

- [ ] **Step 6: Verify with the Svelte MCP autofixer**

Call `mcp__svelte__svelte-autofixer` with the full contents of `StopRoutesLayer.svelte`. Pay particular attention to whether the `$effect` correctly tracks `activeRoutes`/`routeColors` without also tracking `promotedRouteId` and `highlightedTripId` in a way that redraws every polyline on expansion. Apply corrections, re-run the tests, then call it again to confirm the file is clean.

- [ ] **Step 7: Commit**

```bash
npx prettier --write src/components/map/StopRoutesLayer.svelte src/components/map/__tests__/StopRoutesLayer.test.js
git add src/components/map/StopRoutesLayer.svelte src/components/map/__tests__/StopRoutesLayer.test.js
git commit -m "feat: draw the selected stop's active routes and their vehicles"
```

---

## Task 11: The route legend

**Files:**

- Create: `src/components/map/RouteLegend.svelte`
- Create: `src/components/map/__tests__/RouteLegend.test.js`
- Modify: `src/locales/en.json`

**Interfaces:**

- Consumes: `ActiveRoute[]`, `Map<string, RouteColors>`, `Map<string, number>` live counts.
- Produces: a presentational component; no bindings out.

- [ ] **Step 1: Add the i18n key**

In `src/locales/en.json`, inside the existing `map` object:

```json
"map": {
	"find_my_location": "...existing value, leave unchanged...",
	"routes_shown": "Routes shown",
	"live_vehicle_count": "{count} live"
}
```

Only `en.json` changes — `en` is the synchronous fallback, so the other 24 locales keep working and translations are a follow-up.

- [ ] **Step 2: Write the failing tests**

Create `src/components/map/__tests__/RouteLegend.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { describe, test, expect } from 'vitest';
import RouteLegend from '../RouteLegend.svelte';

const routes = [
	{ id: 'r_c', shortName: 'C Line', type: 3, tripId: 't_c', gtfsColor: 'b02a37' },
	{ id: 'r_22', shortName: '22', type: 3, tripId: 't_22', gtfsColor: 'e0a021' }
];
const colors = new Map([
	['r_c', { line: '#b02a37', badgeBg: 'b02a37', badgeFg: 'ffffff' }],
	['r_22', { line: '#e0a021', badgeBg: 'e0a021', badgeFg: '000000' }]
]);

describe('RouteLegend', () => {
	test('lists one row per drawn route', () => {
		render(RouteLegend, { props: { routes, routeColors: colors, liveCounts: new Map() } });
		expect(screen.getByText('C Line')).toBeInTheDocument();
		expect(screen.getByText('22')).toBeInTheDocument();
	});

	test('colors each swatch with its route color', () => {
		const { container } = render(RouteLegend, {
			props: { routes, routeColors: colors, liveCounts: new Map() }
		});
		const swatches = container.querySelectorAll('.legend-swatch');
		expect(swatches[0]).toHaveStyle('background-color: #b02a37');
	});

	test('shows the live vehicle count when there is one', () => {
		render(RouteLegend, {
			props: { routes, routeColors: colors, liveCounts: new Map([['r_c', 3]]) }
		});
		expect(screen.getByText('3 live')).toBeInTheDocument();
	});

	test('renders nothing when no routes are drawn', () => {
		const { container } = render(RouteLegend, {
			props: { routes: [], routeColors: new Map(), liveCounts: new Map() }
		});
		expect(container.querySelector('.route-legend')).not.toBeInTheDocument();
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/map/__tests__/RouteLegend.test.js`
Expected: FAIL — the component does not exist.

- [ ] **Step 4: Implement**

Create `src/components/map/RouteLegend.svelte`:

```svelte
<!--
    @component
    Names the colors on the map. Two routes in a shared corridor are only
    distinguishable if the rider can map a color back to a route, so this pane
    makes the badge -> line -> vehicle mapping explicit while a stop is selected.

    Desktop only: at phone width the bottom sheet already owns this space, and
    the arrival badges carry the same mapping.
-->
<script>
	import '$lib/i18n.js';
	import { isLoading, t } from 'svelte-i18n';

	let { routes = [], routeColors = new Map(), liveCounts = new Map() } = $props();
</script>

{#if routes.length > 0}
	<div
		class="route-legend pointer-events-auto absolute top-4 right-4 z-30 hidden min-w-44 rounded-lg border border-gray-300 bg-white/95 p-3 shadow-md backdrop-blur-sm md:block dark:border-gray-600 dark:bg-gray-800/95"
	>
		<h2
			class="mb-2 text-[10.5px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
		>
			{$isLoading ? '' : $t('map.routes_shown')}
		</h2>
		<ul class="flex flex-col gap-2">
			{#each routes as route (route.id)}
				<li class="flex items-center gap-2">
					<span
						class="legend-swatch h-1.5 w-5 flex-none rounded-full"
						style="background-color: {routeColors.get(route.id)?.line};"
					></span>
					<span class="text-[13px] font-bold text-gray-900 dark:text-white">{route.shortName}</span>
					{#if liveCounts.get(route.id)}
						<span class="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
							{$isLoading
								? ''
								: $t('map.live_vehicle_count', { values: { count: liveCounts.get(route.id) } })}
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/map/__tests__/RouteLegend.test.js`
Expected: all PASS.

- [ ] **Step 6: Verify with the Svelte MCP autofixer, then commit**

```bash
npx prettier --write src/components/map/RouteLegend.svelte src/components/map/__tests__/RouteLegend.test.js src/locales/en.json
git add src/components/map/RouteLegend.svelte src/components/map/__tests__/RouteLegend.test.js src/locales/en.json
git commit -m "feat: add a route legend to the stop-selection map"
```

---

## Task 12: Wire the layer into MapView

**Files:**

- Modify: `src/components/map/MapView.svelte`
- Test: `src/components/__tests__/MapView.test.js`

**Interfaces:**

- Consumes: everything from Tasks 6-11.
- Produces: the finished feature.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/__tests__/MapView.test.js`:

```js
describe('stop selection layer', () => {
	test('tiers markers when routes are drawn: route stops ring, everything else muted', async () => {
		const mapProvider = makeProvider();
		const { component } = render(MapView, {
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/__tests__/MapView.test.js`
Expected: FAIL — `setStopEmphasis` is never called.

- [ ] **Step 3: Wire it up**

In `src/components/map/MapView.svelte`, add the imports and props:

```js
import StopRoutesLayer from './StopRoutesLayer.svelte';
import RouteLegend from './RouteLegend.svelte';
```

```js
let {
	handleStopMarkerSelect,
	selectedTrip = null,
	selectedRoute = null,
	isRouteSelected = false,
	showRouteMap = false,
	mapProvider = null,
	stop = null,
	initialCoords = null,
	activeRoutes = [],
	routeColors = new Map()
} = $props();

let routeStopIds = $state(new Map());
let liveCounts = $state(new Map());

// The layer only draws once the arrivals belong to this stop, so gate everything
// on there actually being routes. A stop with no arrivals in-window keeps
// today's map exactly — there's no catchable bus to point at, so dots on a
// washed-out basemap would be noise.
let routeLayerActive = $derived(!!stop && activeRoutes.length > 0);

// Ring-dot tier for every stop the drawn routes serve.
let emphasisByStopId = $derived(
	new Map(
		[...routeStopIds].map(([stopId, color]) => [stopId, { emphasis: 'routeDot', dotColor: color }])
	)
);

$effect(() => {
	if (!mapInstance) return;
	if (routeLayerActive) {
		// Non-selected stops collapse to quiet dots so the selected stop and the
		// drawn routes are the only loud things on the map.
		mapInstance.setStopEmphasis(emphasisByStopId, 'muted', stop.id);
		mapInstance.setBasemapDimmed(true);
	} else {
		mapInstance.resetStopEmphasis();
		mapInstance.setBasemapDimmed(false);
	}
});
```

Seed emphasis at marker creation. In `addMarker` (currently line 219), after `shouldHighlight`:

```js
// Seeded here rather than patched after batchAddMarkers, which defers creation
// into a rAF — a later setStopEmphasis() would iterate a markersMap that doesn't
// hold these markers yet, and stops panned in mid-selection would stay full pins.
const tier = routeLayerActive
	? (emphasisByStopId.get(s.id) ?? { emphasis: 'muted', dotColor: null })
	: null;

const markerObj = mapInstance.addMarker({
	position: { lat: s.lat, lng: s.lon },
	stop: s,
	isHighlighted: shouldHighlight,
	emphasis: shouldHighlight ? 'full' : (tier?.emphasis ?? 'full'),
	dotColor: tier?.dotColor ?? null,
	onClick: () => {
		handleStopMarkerSelect(s);
	}
});
```

Update the markup:

```svelte
<div class="map-container">
	<div id="map" bind:this={mapElement}></div>

	{#if stop && activeRoutes.length > 0}
		<StopRoutesLayer
			mapProvider={mapInstance}
			{activeRoutes}
			{routeColors}
			promotedRouteId={selectedRoute?.id ?? null}
			highlightedTripId={selectedTrip?.tripId ?? null}
			bind:routeStopIds
			bind:liveCounts
		/>
	{/if}

	<!-- RouteMap opens with clearAllPolylines() + removeStopMarkers(), which would
	     wipe the stop-selection layer. While a stop is selected, StopRoutesLayer
	     owns the map instead and expansion just promotes a route. -->
	{#if selectedTrip && showRouteMap && !stop}
		<RouteMap mapProvider={mapInstance} tripId={selectedTrip.tripId} currentSelectedStop={stop} />
	{/if}

	<RouteLegend routes={stop ? activeRoutes : []} {routeColors} {liveCounts} />
</div>
```

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Check coverage against the 70% gate**

Run: `npx vitest run --coverage`
Expected: branches, functions, lines, and statements all ≥ 70%. If a new file drags it down, add the missing cases before committing rather than lowering the threshold.

- [ ] **Step 6: Verify with the Svelte MCP autofixer, then commit**

```bash
npx prettier --write src/components/map/MapView.svelte src/components/__tests__/MapView.test.js
git add src/components/map/MapView.svelte src/components/__tests__/MapView.test.js
git commit -m "feat: re-compose the map around the selected stop

Selecting a stop now de-emphasizes every other stop into route-colored or gray
dots, draws the routes behind its arrivals with their live vehicles, dims the
basemap, and names the colors in a legend."
```

---

## Task 13: End-to-end verification

**Files:** none — this is the `/go` exercise step.

- [ ] **Step 1: Boot the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Drive the golden path in a browser**

Use the `example-skills:webapp-testing` skill (Playwright). Watch the console throughout; a clean run has no errors.

- [ ] Select a stop with several routes. Confirm: selected stop keeps the emphasized pin with a brand-accent caret; stops on the drawn routes are ring dots in their route's color; every other stop is a small gray dot; one line per route in the arrivals list, each with a white casing; vehicles in matching colors; the legend lists each route with a live count; the basemap is dimmed.
- [ ] Confirm a route the stop is signed for but which has **no** arrival in-window is **not** drawn.
- [ ] Expand an arrival row. Confirm **stop markers do not vanish** (the P1 regression), the expanded route draws on top, and its vehicle glows amber.
- [ ] Collapse the row, then close the sheet. Confirm every stop returns to a full bus pin, the lines and vehicles are gone, and the basemap is undimmed.
- [ ] Re-open a stop and confirm vehicles appear (the P3 regression — they would be missing if `vehicleMarkersMap` leaked).
- [ ] Tap straight from stop A to stop B. Confirm no A-colored lines or dots ever appear around B.
- [ ] Pan the map with a stop selected. Confirm newly-loaded stops arrive already tiered, not as full pins.
- [ ] Toggle dark mode with a stop selected. Confirm lines, vehicles, badges, and legend all recolor together and stay legible.
- [ ] Open a stop whose routes share a GTFS color. Confirm the lines are distinguishable and each badge matches its line.
- [ ] Search for a route (not a stop) and confirm route search still draws its polyline and vehicles — the `vehicleUtils` regression check.

- [ ] **Step 3: Repeat on the Google provider**

Set `PUBLIC_OBA_MAP_PROVIDER=google` in `.env`, restart, and repeat the golden path. Google has no draw-in reveal by design; everything else should match.

- [ ] **Step 4: Check mobile**

Resize to a phone viewport. Confirm the tiers, lines, vehicles, and dim all apply, the legend is hidden, and panning stays smooth (the OSM dim is a CSS filter over a WebGL canvas — watch for jank).

- [ ] **Step 5: Full check**

```bash
npx prettier --check . && npx eslint . && npx vitest run
```

Expected: all clean.
