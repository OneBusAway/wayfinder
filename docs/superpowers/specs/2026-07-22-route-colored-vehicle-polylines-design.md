# Route-Colored Trip Polylines & Vehicle Markers

**Date:** 2026-07-22
**Status:** Approved (design)

## Problem

In the trip-details map view (the selected-trip view opened from a stop's
arrival card), the route polyline and the live vehicle markers (bus icon +
circle outline + direction arrow) always render in a hardcoded blue. Blue tells
the rider nothing about which route they're looking at, and it's visually
disconnected from the route-colored badges shown elsewhere in the app.

We want the polyline and the vehicle icon (arrow + circle outline) to render in
the route's brand color, while staying legible against both the light basemap
and the dark-mode/night map tiles.

## Goal

In `RouteMap` (the trip-details map, `src/components/map/RouteMap.svelte`):

- Draw the selected trip's polyline in the route's brand color.
- Draw the trip's live vehicle markers (arrow + circle outline) in the same
  route color.
- Draw the polyline's direction arrows in a darkened shade of the route color.
- Keep every color legible via a contrast/dark-mode adjustment.
- Preserve existing fallbacks: missing route color → today's blue; non-predicted
  ("realtime off") vehicles → today's gray.

## Non-Goals

- The route-overview polyline drawn from `SearchPane` stays blue for now.
- Trip-planner legs are unchanged (they already pass their own leg colors).
- Live recolor on a theme *toggle* without a redraw or vehicle poll. This
  matches today's behavior — the current blue polyline is drawn once and does
  not recolor when the user flips dark mode; vehicle markers pick up the new
  theme on their next 30s poll.
- Route `textColor` and the vehicle icon's white interior are untouched.

## Current State (for reference)

- `RouteMap.svelte:59` calls `mapProvider.createPolyline(shapePoints)` with no
  options → falls back to `COLORS.POLYLINE` (`#359ff7`, blue).
- Vehicle icon SVG: `src/lib/MapHelpers/generateVehicleIcon.js` —
  `createVehicleIconSvg(orientation, color = '#007BFF', routeType, highlighted)`.
  The direction arrow, the circle outline, **and the bus glyph itself** are
  painted with `color` (the group `<g stroke fill>` at `generateVehicleIcon.js:62`);
  only the circle interior stays white. So route-coloring tints the whole icon,
  not just the outline — expected and desirable. The `color` default is a JS
  **default parameter**, so it fires only for `undefined`, **not `null`** (see
  C1 below).
- Both providers' `addVehicleMarker`/`updateVehicleMarker` leave `color`
  `undefined` for real-time vehicles (→ blue default) and only set it to
  `COLORS.VEHICLE_REAL_TIME_OFF` (`#808080`, gray) when `!vehicle.predicted`.
- `createPolyline(shape, options)` already accepts `{ color, withArrow, weight,
  opacity, dashArray }` in both providers. The line uses `options.color ||
  COLORS.POLYLINE`; the **direction arrows** hardcode
  `COLORS.POLYLINE_ARROW_STROKE` / `COLORS.POLYLINE_ARROW_FILL` regardless of
  `options.color`.
- Route color source of truth: OBA `references.routes[].color` (hex **without**
  `#`). The trip-details endpoint (`/api/oba/trip-details/[tripId]`) that
  `RouteMap` already fetches returns the OBA reference bundle, which
  conventionally includes `references.routes` (confirmed by the arrivals fixture
  `references.routes[].{id,color,textColor}` in `obaData.js`). RouteMap today
  only reads `references.trips`/`references.stops`, so this is a new read —
  **verify against a live trip-details response** and fixture `references.routes`
  in the RouteMap test. The join is `route.id === routeId`, where `routeId` comes
  from `references.trips[].routeId` (OBA `1_xxxx` id convention).
- Map goes dark in dark mode in both providers (`GoogleMapProvider.setTheme` →
  `nightModeStyles()`; `OpenStreetMapProvider.setTheme` → OpenFreeMap `dark`
  tile style). Current theme is readable synchronously via
  `document.documentElement.classList.contains('dark')`.

## Design

### 1. Legibility helper — `mapContrastColor(rawColor, { dark })`

New pure function in `src/lib/colorUtils.js`, alongside the existing
`adjustColorForDarkMode`, `darkenColor`, `lightenColor`, and `getBrightness`.

Signature: `mapContrastColor(rawColor, { dark } = {})`

Behavior:

1. Normalize `rawColor`: accept an OBA hex string with or without a leading `#`
   (e.g. `"0A4EA2"` → `#0a4ea2`). Return `null` for missing, blank, or invalid
   input so callers keep their existing default color. **Callers must treat this
   `null` correctly — see C1.**
2. **Dark mode** (`dark === true`): return `adjustColorForDarkMode(hex)`. That
   helper already lightens dark colors (mixing with white) so they read against
   dark/night tiles, and leaves already-bright colors unchanged.
3. **Light mode** (`dark` falsy): if the color is very bright
   (`getBrightness(rgb)` above a threshold — start at **200**, tunable), darken
   it with `darkenColor(hex, amount)` (start at **0.45**, tunable) so pale
   colors (white, pale yellow) stay visible on the light basemap. Otherwise
   return the normalized color unchanged.

   Constant notes:
   - `getBrightness` returns 0–255 (luminance). At threshold **200**, only
     near-white/yellow/gold get darkened (white 255, yellow ≈226, gold ≈203),
     while cyan ≈178 and bright green ≈149 pass through — sensible for real
     transit palettes. This is deliberately more conservative than the **180**
     "bright" cutoff `adjustColorForDarkMode` uses internally; they are *not* the
     same constant.
   - `darkenColor` mixes toward pure black, amount 0–1 (`#ffffff, 0.5 → #808080`).
     At **0.3**, `#ffffff → #b3b3b3` (brightness ≈179) — still a faint gray on
     the near-white light basemap (OSM `positron`), so start higher at **0.45**
     (`#ffffff → ~#8c8c8c`) for the pale-on-light case that motivates this branch.

Purity: the function does **not** read the DOM. Callers read the `dark` flag
from `document.documentElement.classList.contains('dark')` and pass it in — this
keeps the helper trivially testable and matches the pure style of the
surrounding color utils.

### 2. `RouteMap.svelte`

In `loadRouteData`, after resolving `routeId` from the trip references:

- Resolve the route: `tripData?.data?.references?.routes?.find((r) => r.id === routeId)`.
- Compute the shared color once:
  `const dark = document.documentElement.classList.contains('dark');`
  `const routeColor = mapContrastColor(route?.color, { dark });`
- Polyline: `await mapProvider.createPolyline(shapePoints, { color: routeColor });`
  (`null` is fine here — both providers use `options.color || COLORS.POLYLINE`,
  so `null` correctly falls back to blue.)
- Vehicles: pass the same color into the poll, **coalescing `null` → `undefined`**
  so the vehicle icon's default parameter fires (see C1):
  `fetchAndUpdateVehicles(routeId, mapProvider, undefined, tripId, routeColor ?? undefined)`.

Both the polyline and the vehicle icons therefore use the identical
contrast-adjusted color, so a pale route is treated consistently in both places.

### C1. `null` route color must not reach the vehicle icon

`mapContrastColor` returns `null` for a missing/invalid color. The **polyline**
path is null-safe (`options.color || COLORS.POLYLINE`), but the **vehicle icon**
is not: `createVehicleIconSvg`'s `color = '#007BFF'` is a JS default parameter,
so a `null` slips past it and produces `<g stroke="null" fill="null">` — an
invalid paint that renders a **black bus glyph with no arrow/circle outline**, a
regression from today's blue. Guard on **both** sides so neither path can pass
`null` to the icon:

- RouteMap coalesces when threading to vehicles: `routeColor ?? undefined` (above).
- The provider snippet (§4) also coalesces defensively: `let color = routeColor || undefined;`.

### 3. Plumbing — `src/lib/vehicleUtils.js`

Add a trailing optional `routeColor` parameter (default `undefined`) threaded
through:

- `fetchAndUpdateVehicles(routeId, mapProvider, routeType, highlightedTripId, routeColor)`
- `updateVehicleMarkers(routeId, mapProvider, routeType, highlightedTripId, routeColor)`
- passed into `mapProvider.addVehicleMarker(...)` and
  `mapProvider.updateVehicleMarker(...)`.

Defaulting to `undefined` keeps the other caller (`SearchPane`) unchanged and
its vehicles blue.

### 4. Providers — `GoogleMapProvider` & `OpenStreetMapProvider`

`addVehicleMarker` and `updateVehicleMarker` take a trailing `routeColor`
parameter and use it as the icon's base color, preserving the gray override:

```js
let color = routeColor || undefined; // null/'' → createVehicleIconSvg blue default (C1)
if (!vehicle.predicted) {
    color = COLORS.VEHICLE_REAL_TIME_OFF; // realtime-off stays gray
}
const vehicleIconSvg = createVehicleIconSvg(vehicle?.orientation, color, routeType, isHighlighted);
```

Polyline direction arrows: in `createPolyline`, when `options.color` is
provided, draw the arrows in a darkened shade of it
(`darkenColor(options.color, ~0.25)`) instead of the hardcoded
`COLORS.POLYLINE_ARROW_STROKE`/`_FILL`. When no color is provided, fall back to
the current blue arrow constants — no visual change to existing callers.
Provider-specific detail (they differ — match them deliberately):

- **OSM** uses a PolylineDecorator that already sets both `color` and
  `fillColor` (`OpenStreetMapProvider…:619–627`) — set both to the darkened
  shade.
- **Google** builds a `Symbol` that today sets **only** `strokeColor`
  (`GoogleMapProvider…:556–561`). `FORWARD_CLOSED_ARROW` is a *filled* shape, and
  an unset `fillColor` inherits the host polyline's (non-darkened) line color —
  producing a two-tone arrow that wouldn't match OSM. So set **both**
  `strokeColor` **and** `fillColor` (with `fillOpacity: 1`) to the darkened
  shade on the Google symbol.
- **Dark mode caveat:** in dark mode the shared `routeColor` is already
  *lightened* by `adjustColorForDarkMode`, then darkened 25% for the arrow —
  which can pull a mid-brightness arrow toward low contrast against dark tiles.
  Tune the arrow-darken amount per theme (smaller or skipped in dark mode) if it
  reads poorly.

`createPolyline`'s signature is unchanged (it already accepts `{ color }`).

### 5. Testing

- **`colorUtils` tests** (`src/tests/lib/colorUtils.test.js`): `mapContrastColor`
  — missing/blank/invalid → `null`; leading-`#` and bare-hex both normalize;
  dark mode lightens a dark color; light mode darkens a near-white color; light
  mode passes a mid-brightness color through unchanged.
- **Provider tests** (`GoogleMapProvider.test.js`, `OpenStreetMapProvider.test.js`):
  a route color passed to `addVehicleMarker` reaches `createVehicleIconSvg`
  (these tests already mock `createVehicleIconSvg` as a `vi.fn` and assert on its
  args, so this is a direct extension); the gray override still wins for a
  non-predicted vehicle; **a `null` route color for a *predicted* vehicle still
  yields the blue-default icon (no `null` paint reaches `createVehicleIconSvg`)**
  (C1 regression guard). The `createPolyline`-arrow assertions (line colored,
  arrows darkened, Google `fillColor` set) are **net-new scaffolding** — no
  existing provider test exercises `createPolyline`, so they require new mocks:
  Google's `SymbolPath.FORWARD_CLOSED_ARROW` + `geometry.encoding.decodePath`;
  OSM's `L.polylineDecorator` + `L.Symbol.arrowHead`. Budget for this or defer
  the arrow assertions to manual verification if the mock cost outweighs value.
- **`vehicleUtils` tests** (`src/lib/__tests__/vehicleUtils.test.js`):
  `routeColor` is forwarded as the 5th positional arg to
  `addVehicleMarker`/`updateVehicleMarker` (extends the existing positional-arg
  assertions, e.g. the `call[3]` highlight check → new `call[4]`).
- **RouteMap test:** use a trip-details fixture whose `data.references.routes`
  contains the trip's route with a `color`, and assert `createPolyline` receives
  the contrast-adjusted color. (The current `mockTripDetailsData` fixture is only
  the `entry` and has no `references.routes` — extend it.)

Run with `npx vitest run` (not `npm run test`, which hangs in non-TTY).

## Risks / Notes

- Threshold/darken constants (brightness > 200 and darken 0.45 for light-mode
  legibility; ~0.25 for arrows) are first-pass values; tune against real regional
  route colors and per theme (see the dark-mode arrow caveat in §4).
- Vehicle markers recompute color only on the 30s poll, so a mid-view theme
  toggle leaves them stale until the next poll — acceptable and consistent with
  the polyline's draw-once behavior.
