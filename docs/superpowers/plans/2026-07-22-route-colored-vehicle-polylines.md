# Route-Colored Trip Polylines & Vehicle Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the selected trip's map polyline and its live vehicle markers in the route's brand color (contrast-adjusted for light/dark map tiles) instead of hardcoded blue, in the trip-details map (`RouteMap`).

**Architecture:** Add two pure color helpers to `src/lib/colorUtils.js` (`mapContrastColor` for legibility, `polylineArrowColor` for arrows). `RouteMap` resolves the route color once from the trip-details data it already fetches, and threads it into `createPolyline` (already accepts `{ color }`) and into the vehicle poll. The vehicle color is plumbed through `vehicleUtils` into both map providers as a new trailing param; each provider keeps its existing gray override for non-predicted vehicles.

**Tech Stack:** SvelteKit 5 (runes), Vitest, Google Maps JS API + Leaflet map providers.

## Global Constraints

- Test runner: **`npx vitest run <path>`** — do NOT use `npm run test` (hangs in non-TTY).
- Route color from OBA is hex **without** a leading `#` (e.g. `"0A4EA2"`); helpers must accept both forms.
- `mapContrastColor` returns **`null`** for missing/invalid color. The polyline path is null-safe (`options.color || COLORS.POLYLINE`); the vehicle-icon path is **not** (`createVehicleIconSvg`'s `color = '#007BFF'` default fires only for `undefined`), so `null` must be coalesced to `undefined` before it can reach the icon.
- Non-predicted (`!vehicle.predicted`) vehicles keep rendering gray (`COLORS.VEHICLE_REAL_TIME_OFF`) — the route color must never override that.
- Scope is `RouteMap` only. Do not touch `SearchPane` or trip-planner polylines.
- Follow existing Prettier/lint style (tabs, single quotes). Run `npm run format` before committing if unsure.

---

### Task 1: `mapContrastColor` legibility helper

**Files:**

- Modify: `src/lib/colorUtils.js` (add export near `adjustColorForDarkMode`, end of file)
- Test: `src/tests/lib/colorUtils.test.js`

**Interfaces:**

- Consumes: existing `hexToRgb`, `rgbToHex`, `getBrightness`, `darkenColor`, `adjustColorForDarkMode` (all in `colorUtils.js`).
- Produces: `mapContrastColor(rawColor, { dark = false } = {}) → string | null` — normalized `#rrggbb`, contrast-adjusted; `null` when `rawColor` is missing/invalid.

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/lib/colorUtils.test.js`. First add `mapContrastColor` to the existing import block at the top of the file:

```js
import {
	hexToRgb,
	rgbToHex,
	mixColors,
	generatePalette,
	darkenColor,
	lightenColor,
	getBrightness,
	adjustColorForDarkMode,
	mapContrastColor
} from '$lib/colorUtils.js';
```

Then add this `describe` block inside the top-level `describe('colorUtils', ...)`:

```js
describe('mapContrastColor', () => {
	test('returns null for missing or invalid input', () => {
		expect(mapContrastColor(undefined)).toBeNull();
		expect(mapContrastColor(null)).toBeNull();
		expect(mapContrastColor('')).toBeNull();
		expect(mapContrastColor('not-a-hex')).toBeNull();
	});

	test('normalizes bare and #-prefixed hex to lowercase #rrggbb in light mode', () => {
		expect(mapContrastColor('0A4EA2')).toBe('#0a4ea2');
		expect(mapContrastColor('#0A4EA2')).toBe('#0a4ea2');
	});

	test('passes a mid/dark color through unchanged in light mode', () => {
		// #0a4ea2 brightness ≈ 67, well under the 200 threshold
		expect(mapContrastColor('#0a4ea2', { dark: false })).toBe('#0a4ea2');
	});

	test('darkens a near-white color in light mode so it stays visible', () => {
		const out = mapContrastColor('#ffffff', { dark: false });
		expect(out).not.toBe('#ffffff');
		expect(getBrightness(hexToRgb(out))).toBeLessThan(200);
	});

	test('darkens bright yellow in light mode', () => {
		// #ffff00 brightness ≈ 226, over threshold
		const out = mapContrastColor('#ffff00', { dark: false });
		expect(getBrightness(hexToRgb(out))).toBeLessThan(getBrightness(hexToRgb('#ffff00')));
	});

	test('lightens a dark color in dark mode so it reads on dark tiles', () => {
		const out = mapContrastColor('#0a4ea2', { dark: true });
		expect(getBrightness(hexToRgb(out))).toBeGreaterThan(getBrightness(hexToRgb('#0a4ea2')));
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/colorUtils.test.js -t mapContrastColor`
Expected: FAIL — `mapContrastColor is not a function` / `is not exported`.

- [ ] **Step 3: Implement `mapContrastColor`**

Append to `src/lib/colorUtils.js` (after `adjustColorForDarkMode`):

```js
/**
 * Resolves an OBA route color into a map-legible hex color.
 * - Returns null for missing/invalid input so callers keep their own default.
 * - Dark mode: lightens dark colors (via adjustColorForDarkMode) so they read
 *   against dark/night map tiles.
 * - Light mode: darkens very-bright colors (white, pale yellow) so they stay
 *   visible on the near-white light basemap.
 *
 * The 200 brightness threshold is deliberately more conservative than the 180
 * "bright" cutoff adjustColorForDarkMode uses internally — they are not the
 * same constant.
 * @param {string} rawColor - OBA hex, with or without a leading '#'
 * @param {{ dark?: boolean }} [opts]
 * @returns {string | null} Normalized, contrast-adjusted '#rrggbb', or null
 */
export function mapContrastColor(rawColor, { dark = false } = {}) {
	const rgb = hexToRgb(rawColor);
	if (!rgb) return null;

	const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

	if (dark) {
		return adjustColorForDarkMode(hex);
	}

	// Light mode: pull pale colors down so they don't vanish on the light basemap.
	if (getBrightness(rgb) > 200) {
		return darkenColor(hex, 0.45);
	}

	return hex;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/colorUtils.test.js -t mapContrastColor`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorUtils.js src/tests/lib/colorUtils.test.js
git commit -m "feat: add mapContrastColor helper for legible route colors on the map"
```

---

### Task 2: `polylineArrowColor` arrow helper

**Files:**

- Modify: `src/lib/colorUtils.js` (add `import { COLORS } from './colors.js';` at top; add export)
- Test: `src/tests/lib/colorUtils.test.js`

**Interfaces:**

- Consumes: existing `darkenColor`; `COLORS.POLYLINE_ARROW_STROKE` from `src/lib/colors.js`.
- Produces: `polylineArrowColor(lineColor) → string` — a darker shade of `lineColor`, or the default blue arrow color when `lineColor` is falsy.

Note: `colors.js` has no imports, so importing it into `colorUtils.js` introduces no circular dependency.

- [ ] **Step 1: Write the failing tests**

Add `polylineArrowColor` to the import block in `src/tests/lib/colorUtils.test.js` (alongside `mapContrastColor`), and add this `describe` inside `describe('colorUtils', ...)`:

```js
describe('polylineArrowColor', () => {
	test('returns the default blue arrow color when no line color is given', () => {
		expect(polylineArrowColor(undefined)).toBe('#21649b'); // COLORS.POLYLINE_ARROW_STROKE
		expect(polylineArrowColor(null)).toBe('#21649b');
		expect(polylineArrowColor('')).toBe('#21649b');
	});

	test('returns a darker shade of the line color', () => {
		const out = polylineArrowColor('#359ff7');
		expect(out).not.toBe('#359ff7');
		expect(getBrightness(hexToRgb(out))).toBeLessThan(getBrightness(hexToRgb('#359ff7')));
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/colorUtils.test.js -t polylineArrowColor`
Expected: FAIL — `polylineArrowColor is not a function`.

- [ ] **Step 3: Implement `polylineArrowColor`**

At the top of `src/lib/colorUtils.js`, under the file's doc comment, add the import:

```js
import { COLORS } from './colors.js';
```

Append the function (near `mapContrastColor`):

```js
/**
 * Color for a polyline's direction arrows. Darkens the line color so the arrows
 * stay distinct against the line; falls back to the default blue arrow color
 * when the line has no route color.
 * @param {string} lineColor - The polyline's resolved color (hex), or falsy
 * @returns {string} Arrow hex color
 */
export function polylineArrowColor(lineColor) {
	return lineColor ? darkenColor(lineColor, 0.25) : COLORS.POLYLINE_ARROW_STROKE;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/colorUtils.test.js -t polylineArrowColor`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorUtils.js src/tests/lib/colorUtils.test.js
git commit -m "feat: add polylineArrowColor helper for route-colored map arrows"
```

---

### Task 3: Thread `routeColor` through vehicleUtils

**Files:**

- Modify: `src/lib/vehicleUtils.js:34-90` (`updateVehicleMarkers`), `:101-120` (`fetchAndUpdateVehicles`)
- Test: `src/lib/__tests__/vehicleUtils.test.js`

**Interfaces:**

- Consumes: nothing from earlier tasks (pure plumbing).
- Produces:

  - `fetchAndUpdateVehicles(routeId, mapProvider, routeType, highlightedTripId = null, routeColor = undefined)`
  - `updateVehicleMarkers(routeId, mapProvider, routeType, highlightedTripId = null, routeColor = undefined)`
  - forwards `routeColor` as the **5th positional arg** to `mapProvider.addVehicleMarker(vehicleStatus, activeTrip, routeType, isHighlighted, routeColor)` and the **6th positional arg** to `mapProvider.updateVehicleMarker(marker, vehicleStatus, activeTrip, routeType, isHighlighted, routeColor)`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/__tests__/vehicleUtils.test.js` inside `describe('updateVehicleMarkers', ...)`:

```js
test('forwards routeColor as the 5th arg to addVehicleMarker', async () => {
	await updateVehicleMarkers('route-1', provider, undefined, 'trip-1', '#0a4ea2');
	for (const call of provider.addVehicleMarker.mock.calls) {
		expect(call[4]).toBe('#0a4ea2');
	}
});

test('forwards routeColor as the 6th arg to updateVehicleMarker', async () => {
	// First pass creates markers, second pass updates them.
	await updateVehicleMarkers('route-1', provider, undefined, 'trip-1', '#0a4ea2');
	await updateVehicleMarkers('route-1', provider, undefined, 'trip-1', '#0a4ea2');
	expect(provider.updateVehicleMarker).toHaveBeenCalled();
	for (const call of provider.updateVehicleMarker.mock.calls) {
		expect(call[5]).toBe('#0a4ea2');
	}
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/vehicleUtils.test.js -t routeColor`
Expected: FAIL — `call[4]`/`call[5]` are `undefined` (routeColor not forwarded yet).

- [ ] **Step 3: Implement the plumbing**

In `src/lib/vehicleUtils.js`, update `updateVehicleMarkers` signature and its two provider calls:

```js
export async function updateVehicleMarkers(
	routeId,
	mapProvider,
	routeType,
	highlightedTripId = null,
	routeColor = undefined
) {
```

Change the `updateVehicleMarker` call (currently lines ~70-76) to:

```js
mapProvider.updateVehicleMarker(
	marker,
	vehicleStatus,
	activeTrip,
	routeType,
	isHighlighted,
	routeColor
);
```

Change the `addVehicleMarker` call (currently lines ~78-83) to:

```js
const marker = mapProvider.addVehicleMarker(
	vehicleStatus,
	activeTrip,
	routeType,
	isHighlighted,
	routeColor
);
```

Update `fetchAndUpdateVehicles` signature and both `updateVehicleMarkers` calls:

```js
export async function fetchAndUpdateVehicles(
	routeId,
	mapProvider,
	routeType,
	highlightedTripId = null,
	routeColor = undefined
) {
	try {
		await updateVehicleMarkers(routeId, mapProvider, routeType, highlightedTripId, routeColor);
	} catch (error) {
		console.error('fetchAndUpdateVehicles: initial fetch failed', routeId, error);
	}

	return setInterval(async () => {
		try {
			await updateVehicleMarkers(routeId, mapProvider, routeType, highlightedTripId, routeColor);
		} catch (error) {
			console.error('fetchAndUpdateVehicles: polling update failed', routeId, error);
		}
	}, 30000);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/vehicleUtils.test.js`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/vehicleUtils.js src/lib/__tests__/vehicleUtils.test.js
git commit -m "feat: thread routeColor through vehicle marker updates"
```

---

### Task 4: Apply route color to vehicle icons in both providers

**Files:**

- Modify: `src/lib/Provider/GoogleMapProvider.svelte.js:338` (`addVehicleMarker`), `:388` (`updateVehicleMarker`)
- Modify: `src/lib/Provider/OpenStreetMapProvider.svelte.js:351` (`addVehicleMarker`), `:417` (`updateVehicleMarker`)
- Test: `src/tests/lib/GoogleMapProvider.test.js`, `src/tests/lib/OpenStreetMapProvider.test.js`

**Interfaces:**

- Consumes: `routeColor` (5th arg to `addVehicleMarker`, 6th to `updateVehicleMarker`) from Task 3; `createVehicleIconSvg(orientation, color, routeType, highlighted)` (color default `#007BFF` fires only for `undefined`).
- Produces: both providers pass `routeColor || undefined` as the icon `color` for predicted vehicles; gray override unchanged.

- [ ] **Step 1: Write the failing tests (Google)**

Add to `src/tests/lib/GoogleMapProvider.test.js`. Reuse the existing `makeGoogleMarkerMock`/`setupGoogleMaps` helpers and import the mocked `createVehicleIconSvg`:

```js
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';

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
```

- [ ] **Step 2: Run the Google tests to verify they fail**

Run: `npx vitest run src/tests/lib/GoogleMapProvider.test.js -t "route color"`
Expected: FAIL — icon called with `undefined` color (route color not applied yet); non-predicted still passes but the predicted/null cases fail.

- [ ] **Step 3: Implement in GoogleMapProvider**

In `src/lib/Provider/GoogleMapProvider.svelte.js`, update `addVehicleMarker` signature (line 338) and its color block (lines 341-344):

```js
	addVehicleMarker(vehicle, activeTrip, routeType, isHighlighted = false, routeColor = undefined) {
		if (!this.map) return null;

		let color = routeColor || undefined; // null/'' → createVehicleIconSvg blue default
		if (!vehicle.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}
```

Update `updateVehicleMarker` signature (line 388) and its color block (lines 400-403):

```js
	updateVehicleMarker(marker, vehicleStatus, activeTrip, routeType, isHighlighted = false, routeColor = undefined) {
		if (!this.map || !marker) return;

		const current = marker.getPosition();
		animateMarkerTo(
			marker,
			{ lat: current.lat(), lng: current.lng() },
			{ lat: vehicleStatus.position.lat, lng: vehicleStatus.position.lon },
			(lat, lng) => marker.setPosition({ lat, lng }),
			{ routePaths: this._getRoutePaths() }
		);

		let color = routeColor || undefined; // null/'' → createVehicleIconSvg blue default
		if (!vehicleStatus.predicted) {
			color = COLORS.VEHICLE_REAL_TIME_OFF;
		}
```

- [ ] **Step 4: Run the Google tests to verify they pass**

Run: `npx vitest run src/tests/lib/GoogleMapProvider.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing tests (OSM)**

Add to `src/tests/lib/OpenStreetMapProvider.test.js`, reusing the existing `makeFakeL`/`fakeMarker` setup pattern and importing the mocked `createVehicleIconSvg`:

```js
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon';

describe('addVehicleMarker — route color', () => {
	let provider;

	beforeEach(() => {
		provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(fakeMarker);
		provider.map = {};
		createVehicleIconSvg.mockClear();
	});

	const VEHICLE = { position: { lat: 47.6, lon: -122.3 }, predicted: true, orientation: 90 };

	test('passes the route color to the icon for a predicted vehicle', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3, false, '#0a4ea2');
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, '#0a4ea2', 3, false);
	});

	test('gray override still wins for a non-predicted vehicle', () => {
		provider.addVehicleMarker(
			{ ...VEHICLE, predicted: false },
			{ tripHeadsign: 'Northgate' },
			3,
			false,
			'#0a4ea2'
		);
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, '#808080', 3, false);
	});

	test('null route color falls back to the icon default', () => {
		provider.addVehicleMarker(VEHICLE, { tripHeadsign: 'Northgate' }, 3, false, null);
		expect(createVehicleIconSvg).toHaveBeenCalledWith(90, undefined, 3, false);
	});
});
```

> Note: check the top of `OpenStreetMapProvider.test.js` for the exact names of the `makeFakeL` / `fakeMarker` helpers and the `VEHICLE` constant already defined there; reuse them rather than redeclaring if they exist at the needed scope.

- [ ] **Step 6: Run the OSM tests to verify they fail**

Run: `npx vitest run src/tests/lib/OpenStreetMapProvider.test.js -t "route color"`
Expected: FAIL — icon called with `undefined` for the predicted/null cases.

- [ ] **Step 7: Implement in OpenStreetMapProvider**

In `src/lib/Provider/OpenStreetMapProvider.svelte.js`, update `addVehicleMarker` (line 351) and `updateVehicleMarker` (line 417) exactly as in the Google provider — append `, routeColor = undefined` to each signature and change each `let color;` to:

```js
let color = routeColor || undefined; // null/'' → createVehicleIconSvg blue default
```

(keep the existing `if (!vehicle.predicted) { color = COLORS.VEHICLE_REAL_TIME_OFF; }` / `if (!vehicleStatus.predicted) ...` block directly below unchanged).

- [ ] **Step 8: Run the OSM tests to verify they pass**

Run: `npx vitest run src/tests/lib/OpenStreetMapProvider.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/Provider/GoogleMapProvider.svelte.js src/lib/Provider/OpenStreetMapProvider.svelte.js src/tests/lib/GoogleMapProvider.test.js src/tests/lib/OpenStreetMapProvider.test.js
git commit -m "feat: render route color on vehicle icons in both map providers"
```

---

### Task 5: Route-color the polyline arrows in both providers

**Files:**

- Modify: `src/lib/Provider/GoogleMapProvider.svelte.js:10` (import), `:555-561` (arrow symbol)
- Modify: `src/lib/Provider/OpenStreetMapProvider.svelte.js:12` (import), `:613-627` (arrow decorator)

**Interfaces:**

- Consumes: `polylineArrowColor(lineColor)` from Task 2; the existing `options.color` param of `createPolyline`.
- Produces: both providers draw arrows in `polylineArrowColor(options.color)`. Google sets **both** `strokeColor` and `fillColor` (the filled `FORWARD_CLOSED_ARROW` otherwise inherits the un-darkened line color); OSM sets `color` and `fillColor` on the decorator.

Note: the arrow wiring is verified through the pure `polylineArrowColor` unit tests (Task 2) plus manual verification in Task 6. No provider `createPolyline` test exists today, and adding one requires net-new Google `geometry.encoding.decodePath` / OSM `polylineDecorator` + `Symbol.arrowHead` mocks — out of proportion to the one-line color change. Do not add those mocks in this task.

- [ ] **Step 1: Update GoogleMapProvider imports**

In `src/lib/Provider/GoogleMapProvider.svelte.js`, add `polylineArrowColor` to the color import (line 10 currently imports `COLORS` from `$lib/colors`; add a new import line):

```js
import { polylineArrowColor } from '$lib/colorUtils';
```

- [ ] **Step 2: Update the Google arrow symbol**

Replace the `arrowSymbol` block (currently lines ~555-561) inside `createPolyline`:

```js
if (withArrow) {
	const arrowColor = polylineArrowColor(options.color);
	const arrowSymbol = {
		path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
		scale: 2,
		strokeColor: arrowColor,
		strokeWeight: 3,
		fillColor: arrowColor,
		fillOpacity: 1
	};

	icons.push({
		icon: arrowSymbol,
		offset: '100%',
		repeat: '50px'
	});
}
```

- [ ] **Step 3: Update OpenStreetMapProvider imports**

In `src/lib/Provider/OpenStreetMapProvider.svelte.js`, add:

```js
import { polylineArrowColor } from '$lib/colorUtils';
```

- [ ] **Step 4: Update the OSM arrow decorator**

Replace the `arrowDecorator` `pathOptions` (currently lines ~619-627) inside `createPolyline`:

```js
const arrowColor = polylineArrowColor(options.color);
const arrowDecorator = this.L.polylineDecorator(polyline, {
	patterns: [
		{
			offset: 0,
			repeat: 125,
			symbol: this.L.Symbol.arrowHead({
				pixelSize: 12,
				pathOptions: {
					color: arrowColor,
					fill: true,
					fillColor: arrowColor,
					fillOpacity: 0.85
				}
			})
		}
	]
}).addTo(this.map);
```

- [ ] **Step 5: Verify existing provider tests still pass**

Run: `npx vitest run src/tests/lib/GoogleMapProvider.test.js src/tests/lib/OpenStreetMapProvider.test.js`
Expected: PASS (no regressions; arrow color has no dedicated test by design).

- [ ] **Step 6: Commit**

```bash
git add src/lib/Provider/GoogleMapProvider.svelte.js src/lib/Provider/OpenStreetMapProvider.svelte.js
git commit -m "feat: darken polyline direction arrows to a shade of the route color"
```

---

### Task 6: Wire route color into RouteMap

**Files:**

- Modify: `src/components/map/RouteMap.svelte:40-100` (`loadRouteData`)

**Interfaces:**

- Consumes: `mapContrastColor` (Task 1); `createPolyline(shape, { color })` (existing); `fetchAndUpdateVehicles(routeId, mapProvider, routeType, highlightedTripId, routeColor)` (Task 3).
- Produces: the visible feature — polyline and vehicles rendered in the route's contrast-adjusted color.

There is no `RouteMap` component test today; the color logic is already unit-tested (Task 1), so this task is verified by build + manual check (Step 4).

- [ ] **Step 1: Import the helper**

At the top `<script>` of `src/components/map/RouteMap.svelte`, add:

```js
import { mapContrastColor } from '$lib/colorUtils';
```

- [ ] **Step 2: Resolve the route color and pass it to the polyline**

In `loadRouteData`, after `const routeId = moreTripData?.routeId;` (line 52), add:

```js
const route = tripData?.data?.references?.routes?.find((r) => r.id === routeId);
const dark = document.documentElement.classList.contains('dark');
const routeColor = mapContrastColor(route?.color, { dark });
```

Change the `createPolyline` call (line 59) from:

```js
await mapProvider.createPolyline(shapePoints);
```

to:

```js
await mapProvider.createPolyline(shapePoints, { color: routeColor });
```

(`routeColor` may be `null`; the providers fall back to blue via `options.color || COLORS.POLYLINE`.)

- [ ] **Step 3: Pass the route color into the vehicle poll**

Change the `fetchAndUpdateVehicles` call (line 95) from:

```js
currentIntervalId = await fetchAndUpdateVehicles(routeId, mapProvider, undefined, tripId);
```

to (coalescing `null → undefined` so the vehicle icon default fires — see Global Constraints):

```js
currentIntervalId = await fetchAndUpdateVehicles(
	routeId,
	mapProvider,
	undefined,
	tripId,
	routeColor ?? undefined
);
```

- [ ] **Step 4: Verify — build, lint, and manual check**

Run:

```bash
npx vitest run src/tests/lib/colorUtils.test.js src/lib/__tests__/vehicleUtils.test.js src/tests/lib/GoogleMapProvider.test.js src/tests/lib/OpenStreetMapProvider.test.js
npm run lint
```

Expected: all tests PASS; lint clean.

Manual check (`npm run dev`): open a stop, expand an arrival card to show the trip on the map, and confirm:

- the polyline renders in the route's color (not blue) with darker arrows;
- the live vehicle icon(s) render in the same color;
- a vehicle with realtime off still renders gray;
- toggle dark mode + reload: colors stay legible on the dark tiles;
- a route with no color still renders the blue default (no black/blank icon).

- [ ] **Step 5: Commit**

```bash
git add src/components/map/RouteMap.svelte
git commit -m "feat: render RouteMap polyline and vehicles in the route color"
```

---

## Self-Review

**Spec coverage:**

- §1 legibility helper → Task 1. ✅
- §2 RouteMap resolves route + passes to polyline & vehicles → Task 6. ✅
- §3 vehicleUtils plumbing → Task 3. ✅
- §4 provider vehicle color (null-safe, gray override) → Task 4; arrow color (Google fill + OSM, darkened) → Tasks 2 + 5. ✅
- C1 null-safety guard (both RouteMap coalesce + provider `routeColor || undefined`) → Tasks 6 + 4, with a regression test in Task 4. ✅
- §5 testing (helper tests, provider route-color/gray/null tests, vehicleUtils forwarding) → Tasks 1–4; RouteMap manual verification → Task 6. ✅

**Placeholder scan:** No TBD/TODO; every code step shows real code and exact commands.

**Type consistency:** `mapContrastColor(rawColor, { dark })→string|null`, `polylineArrowColor(lineColor)→string`, and the `routeColor` positional args (5th on `addVehicleMarker`, 6th on `updateVehicleMarker`) are consistent across Tasks 1–6. Gray constant `#808080` (`COLORS.VEHICLE_REAL_TIME_OFF`) and default arrow `#21649b` (`COLORS.POLYLINE_ARROW_STROKE`) match `src/lib/colors.js`.
