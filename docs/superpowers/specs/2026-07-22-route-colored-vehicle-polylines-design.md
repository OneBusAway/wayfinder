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
  The arrow and circle outline use `color`; the circle interior is white.
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
  `RouteMap` already fetches includes `data.references.routes`.
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
   input so callers keep their existing default color.
2. **Dark mode** (`dark === true`): return `adjustColorForDarkMode(hex)`. That
   helper already lightens dark colors (mixing with white) so they read against
   dark/night tiles, and leaves already-bright colors unchanged.
3. **Light mode** (`dark` falsy): if the color is very bright
   (`getBrightness(rgb)` above a threshold — start at **200**, tunable), darken
   it with `darkenColor(hex, amount)` (start at **0.3**, tunable) so pale
   colors (white, pale yellow) stay visible on the light basemap. Otherwise
   return the normalized color unchanged.

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
  (`null` → provider's blue default.)
- Vehicles: pass the same color into the poll:
  `fetchAndUpdateVehicles(routeId, mapProvider, undefined, tripId, routeColor)`.

Both the polyline and the vehicle icons therefore use the identical
contrast-adjusted color, so a pale route is treated consistently in both places.

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
let color = routeColor; // undefined → createVehicleIconSvg blue default
if (!vehicle.predicted) {
    color = COLORS.VEHICLE_REAL_TIME_OFF; // realtime-off stays gray
}
const vehicleIconSvg = createVehicleIconSvg(vehicle?.orientation, color, routeType, isHighlighted);
```

Polyline direction arrows: in `createPolyline`, when `options.color` is
provided, draw the arrows in a darkened shade of it
(`darkenColor(options.color, ~0.25)`) instead of the hardcoded
`COLORS.POLYLINE_ARROW_STROKE`/`_FILL`. When no color is provided, fall back to
the current blue arrow constants — no visual change to existing callers. Applies
to both providers (Google's `Symbol` arrow stroke; OSM's PolylineDecorator
`pathOptions` color/fillColor).

`createPolyline`'s signature is unchanged (it already accepts `{ color }`).

### 5. Testing

- **`colorUtils` tests** (`src/tests/lib/colorUtils.test.js`): `mapContrastColor`
  — missing/blank/invalid → `null`; leading-`#` and bare-hex both normalize;
  dark mode lightens a dark color; light mode darkens a near-white color; light
  mode passes a mid-brightness color through unchanged.
- **Provider tests** (`GoogleMapProvider.test.js`, `OpenStreetMapProvider.test.js`):
  a route color passed to `addVehicleMarker` reaches `createVehicleIconSvg`; the
  gray override still wins for a non-predicted vehicle; `createPolyline` with a
  `color` option colors the line and darkens the arrows.
- **`vehicleUtils` tests** (`src/lib/__tests__/vehicleUtils.test.js`):
  `routeColor` is forwarded to `addVehicleMarker`/`updateVehicleMarker`.

Run with `npx vitest run` (not `npm run test`, which hangs in non-TTY).

## Risks / Notes

- Threshold/darken constants (200 / 0.3 for light-mode legibility; ~0.25 for
  arrows) are first-pass values; tune against real regional route colors.
- Vehicle markers recompute color only on the 30s poll, so a mid-view theme
  toggle leaves them stale until the next poll — acceptable and consistent with
  the polyline's draw-once behavior.
