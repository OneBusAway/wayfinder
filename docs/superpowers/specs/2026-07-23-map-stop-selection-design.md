# Map Stop Selection: De-emphasized Stops + Active Routes & Vehicles

**Date:** 2026-07-23
**Status:** Approved (design)
**Reference mockup:** `Map Stop Selection.dc.html` (Claude Design project
`aecacf9f-fdfa-41ba-950c-5922677d07a1`)

## Problem

When a rider selects a stop today, the map does two things poorly.

**Every stop looks equally important.** The viewport stays full of identical
white bus-pin markers (`StopMarker.svelte`: `h-8 w-8 rounded-md`, 2px gray-400
border, black `fa-bus` glyph, direction caret). Nothing on the map reflects
_which_ stop the rider just picked, so the selected stop is lost in a field of
look-alikes. Every marker also draws its own direction caret, so a screenful of
carets points in every direction at once.

**The arrivals list and the map are disconnected.** The sheet lists real-time
arrivals for routes C, 22, and 128, but the map shows none of those routes'
paths and none of the vehicles behind those predictions. The rider can read
"C Line — 7 min" and still have no idea where that bus is or which way it's
coming from.

## Goal

On stop selection, re-compose the map around the selection:

1. **De-emphasize every other stop**, so the selected stop and the active routes
   are the only loud things on the map.
2. **Draw the routes served by the current arrivals list**, plus the live
   position of every vehicle feeding those arrivals, each colored by route.

Deselecting (sheet close button, Escape, or back) restores today's default map:
all stops back to full bus markers, no route lines, no vehicles.

## Non-Goals

- **No new environment variables.** The mockup exposes `stopTreatment`,
  `showVehicles`, `dimBasemap`, and `animateFlow` as per-deployment props. We
  ship the chosen values as module constants instead (see Settings). Promoting
  any of them to `PUBLIC_*` config later is a small, additive change.
- **No directional flow animation.** `animateFlow` is off, so the dashed white
  overlay stroke in the mockup is not built at all.
- **The standalone `/stops/[stopID]` page is unchanged.** It has no map, so it
  gets no route layer and no color de-collision.
- **Route-search selection is unchanged.** `SearchPane`'s route click and
  `RouteModal` keep their current behavior and their current blue polylines.
- **No new stop-marker interaction.** Dots click through to the same
  `handleStopMarkerSelect` as the full pins.

## Settings

Module constants, not configuration. Values chosen by the maintainer:

| Setting          | Value    | Effect                                                    |
| ---------------- | -------- | --------------------------------------------------------- |
| `STOP_TREATMENT` | `'dots'` | Non-route stops collapse to quiet gray dots.              |
| `SHOW_VEHICLES`  | `true`   | Live vehicles are drawn for every active route.           |
| `DIM_BASEMAP`    | `true`   | Basemap gets a faint wash while the route layer is drawn. |

`STOP_TREATMENT` is written as a switch over `'dots' | 'faded' | 'hidden'` so
the two unused treatments stay one constant away, but only `'dots'` is exercised
and only `'dots'` is tested.

`animateFlow` gets no constant at all. It is `false`, the flow-dash overlay is
not built, and a dead constant guarding code that doesn't exist would be worse
than its absence. It is recorded in Non-Goals instead.

## Current State (for reference)

- **Selection lives in `page.state`.** `MapExperience.svelte:87` derives
  `selectedStopData` from `$page.state?.stopData`; a marker tap sets it via
  shallow `pushState`. The framing effect at `MapExperience.svelte:107` reacts
  to it and calls `provider.highlightMarker(id)`.
- **Arrivals do not reach the map.** `StopPane.svelte` owns
  `arrivalsAndDeparturesResponse` as `$bindable`, and `StopBottomSheet.svelte:28`
  binds it into a local `$state` and stops there. `MapExperience` never sees it.
- **Stop markers carry reactive props.** Both providers mount `StopMarker` with
  a `$state` props object and keep the marker in `markersMap`
  (`OpenStreetMapProvider.svelte.js:123`, `GoogleMapProvider.svelte.js:100`).
  `highlightMarker` and `updateMarkersRouteLabelVisibility` already mutate
  `marker.props` in place. This is the channel emphasis will use — markers are
  never destroyed and recreated.
- **`MapView` clears all markers outside NORMAL mode.** The effect at
  `MapView.svelte:77` calls `clearAllMarkers()` whenever `mapMode !== NORMAL`.
  A stop selection does _not_ change `mapMode` (it sets no `selectedRoute`), so
  stop markers stay on screen throughout — which is what makes tiering possible.
- **`RouteMap` draws one trip and clears everything first.**
  `RouteMap.svelte:43` calls `clearAllPolylines()` + `removeStopMarkers()` on
  load, and its `onDestroy` repeats the teardown. It mounts only when
  `selectedTrip && showRouteMap` (`MapView.svelte:302`).
- **`vehicleUtils.js` is a module singleton with a global sweep.**
  `vehicleMarkersMap` is module-scoped, and `removeInactiveMarkers`
  (`vehicleUtils.js:95`) deletes **every** marker whose key is absent from the
  single polled route's `activeKeys`. See Risks.
- **`createPolyline` already models attached sub-layers.** The OSM provider
  hangs `polyline.arrowDecorator` off the polyline and tears it down in
  `removePolyline` and `clearAllPolylines`. The white casing follows this exact
  pattern.
- **The MapLibre GL basemap renders into Leaflet's `tilePane`.** Confirmed in
  `node_modules/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js:23`. So a
  CSS filter scoped to `.leaflet-tile-pane` dims the basemap and nothing else.
- **The Google map is created without a `mapId`** (`src/lib/googleMaps.js:49`),
  so `map.setOptions({ styles })` still applies.
- **`RouteBadge` takes hex without `#`.** `RouteBadge.svelte:12` does
  `` `#${color}` ``. Any override must follow the same convention or normalize
  at the boundary.

## Architecture

### One color resolution, two consumers

Route color must be identical across the polyline, the vehicle markers, the
legend, and the arrival badge — otherwise the badge-to-line mapping the whole
feature depends on is ambiguous. Resolving it inside the map layer and pushing
it back into the sheet would be circular, so resolution moves **above both** into
`MapExperience`, which already holds the selected stop and (after the binding
change below) the arrivals.

New pure module `src/lib/activeRoutes.js`:

```js
// Distinct routes present in the arrivals list, each with the soonest trip.
// Routes signed at the stop but with no arrival in-window are excluded.
activeRoutesFromArrivals(response) -> [{ routeId, shortName, tripId, route }]

// routeId -> '#rrggbb', de-collided.
assignRouteColors(routes, { dark }) -> Map<string, string>
```

`activeRoutesFromArrivals` dedupes `routeId` across
`response.data.entry.arrivalsAndDepartures`, keeping the earliest
`predictedArrivalTime ?? scheduledArrivalTime` per route as the representative
trip, and joins `data.references.routes` for the GTFS color and type. This is
what keeps the map honest: a line on the map means a bus you can actually catch
from this stop is running that route now. In the mockup's stop, 773 is signed
but has no arrival in-window, so it is never drawn.

`assignRouteColors` runs each route's GTFS color through
`mapContrastColor(route.color, { dark })`. Two failure cases get a fallback:

- **Collision.** Real Metro 22 and 128 share a generic color; two identical
  lines in one corridor are unreadable.
- **Missing color.** `mapContrastColor` returns `null` for absent or invalid
  input.

Both fall back to a new `ROUTE_FALLBACK_PALETTE` in `src/lib/colors.js`: a set
of distinct hues, each chosen to stay legible on both the light and dark
basemaps **and** to clear 4.5:1 against white badge text. Because the palette
entries satisfy both constraints directly, they are used verbatim — no dark-mode
adjustment — so the badge and the line are guaranteed to be the same hex.

Assignment is deterministic: hash `routeId` to a palette index, then linear-probe
to the next unused entry. Keyed on the id rather than list position, so the color
does not jump when a 30s refresh reorders the arrivals.

`MapExperience` computes both as `$derived` from `stopArrivals` and the current
theme, and passes the result down two paths:

- **Map side** → `MapContainer` → `MapView` → `StopRoutesLayer`
- **Sheet side** → `StopBottomSheet` → `StopPane` → `ArrivalDeparture` →
  `RouteBadge`

### Getting arrivals to the map

`StopBottomSheet` promotes its local `arrivalsAndDeparturesResponse` to
`$bindable(null)`, and `MapExperience` binds it into new
`let stopArrivals = $state(null)`. `StopPane` is untouched — it already exposes
the binding. No second fetch, and the map and sheet can never disagree about
which arrivals are current.

`stopArrivals` resets to `null` when the selection clears, in the same branch of
the framing effect that runs the existing teardown.

### Badge color override

`ArrivalDeparture` gains an optional `colorOverride` prop, forwarded to
`RouteBadge` as `color`. **It is only set for routes whose color we assigned** —
that is, de-collided or previously colorless routes. A route with a unique GTFS
color passes `null` and renders exactly as it does today, so existing badge text
contrast and `textColor` handling are untouched.

The value is passed hex-without-`#` to match `RouteBadge`'s existing contract;
`activeRoutes.js` returns `#rrggbb` (what the map wants), so the sheet side
strips the `#` at the prop boundary. One conversion point, named explicitly.

### Change 1 — Marker emphasis tiers

`StopMarker.svelte` gains:

- `emphasis: 'full' | 'routeDot' | 'muted' | 'hidden'`, default `'full'`
- `dotColor: string | null` — the route color for `routeDot`

`isHighlighted` **stays as-is** and remains the sole signal for "this is the
selected stop." Emphasis decides the marker's _shape_; `isHighlighted` decides
whether the pin is emphasized. The selected stop is always
`emphasis: 'full', isHighlighted: true`, so there is exactly one source of truth
for selection and `highlightMarker`/`unHighlightMarker` keep working unchanged.

| Tier       | Which stops                                        | Rendering                                                                                                                                 |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `full`     | all stops when nothing selected; the selected stop | Today's pin. With `isHighlighted`, the existing `.highlight` (`scale-125 border-brand-accent drop-shadow-md`), caret tinted brand-accent. |
| `routeDot` | stops served by a drawn route                      | 14px white-filled circle, 2.5px border in `dotColor`, small drop shadow. No glyph, no caret.                                              |
| `muted`    | every other stop on screen                         | ~9px solid `#8b93a1` at 60% opacity with a thin white halo.                                                                               |
| `hidden`   | (unused at `STOP_TREATMENT: 'dots'`)               | Renders nothing.                                                                                                                          |

Why dots rather than dimming: a 32px pinned icon carries the same visual weight
dimmed or not — shape and size dominate opacity. Collapsing to a dot removes the
_icon_ and keeps only _position_, which is all a background stop needs to
contribute. It also removes the caret clutter, and it lets ringed route-dots
read as beads on a string along each polyline.

**Accessibility:** every tier including `muted` renders a real `<button>` with
the `sr-only` stop name and the same `onClick`. Collapsing to a dot is a visual
change only — keyboard order, screen-reader output, and hit targets are
preserved. The `routes-label` chip renders for `full` only.

New provider methods on both providers:

```js
setStopEmphasis(byStopId, defaultEmphasis); // Map<stopId, {emphasis, dotColor}>
resetStopEmphasis(); // everything back to 'full'
```

Both iterate `markersMap` and mutate `marker.props`, the same reactive channel
`updateMarkersRouteLabelVisibility` already uses. `MapView` calls
`setStopEmphasis` when the active-route stop set changes and after
`batchAddMarkers` (stops panned into view mid-selection must arrive already
tiered, not as full pins that then collapse).

### Change 2 — Routes and vehicles

New `src/components/map/StopRoutesLayer.svelte`, sibling to `RouteMap.svelte`,
mounted by `MapView` when a stop is selected and arrivals have loaded.

**Shapes, per route:** `/api/oba/trip-details/{tripId}` → `shapeId` +
`schedule.stopTimes`, then `/api/oba/shape/{shapeId}` → encoded points →
`createPolyline(points, { color, casing: true })`. Fetches run in parallel across
routes. Cost is 2 requests × N routes; a 4-route stop is 8 requests, issued once
per selection, not per poll.

Per-trip shapes rather than `stops-for-route` because the trip's shape is the
single direction the rider can actually board, and its `stopTimes` gives the
ring-dot set for free — the stops a catchable bus will actually serve.

**Ring-dot set:** the union of `stopIds` across the fetched trips, each mapped to
its route's color. A stop served by more than one drawn route takes the color of
the route whose arrival is soonest.

**Polyline styling:**

- **White casing underneath.** Each route draws twice: a ~9–10px white stroke,
  then the ~5–5.5px colored stroke on top. The line then reads on any basemap
  tile without a halo hack. The casing hangs off the polyline as
  `polyline._casing` and is torn down by `removePolyline` and
  `clearAllPolylines`, exactly as `arrowDecorator` already is.
- **Rounded joins and caps** on both strokes.
- **Z-order.** OSM creates three custom panes — `obaRouteCasing` (402),
  `obaRoute` (403), `obaRoutePromoted` (404) — all below `markerPane` (600), so
  every casing sits under every colored stroke and the promoted route sits above
  its peers. Google uses `zIndex` on the polyline options.
- **Draw-in reveal.** The providers' existing `_revealPolylinesWithDraw` already
  animates `stroke-dashoffset`; it is extended to drive the casing in sync so
  the two strokes reveal together.
- **Direction arrows stay on** (`withArrow` keeps its `true` default). With
  `ANIMATE_FLOW: false` there is no other direction cue on the line, and we draw
  one direction per route, so the existing `polylineDecorator` arrows earn their
  place. This is a deliberate divergence from the mockup, which has none.

**Vehicles:** `generateVehicleIcon.js` is reused unchanged — white circle,
2px route-colored stroke, route-type glyph, direction arrow snapped to 8 compass
points, and the existing `PUBLIC_COLOR_VEHICLE_HIGHLIGHT` amber glow for the
highlighted trip. Positions animate via `animateMarker.js`.

**Legend:** new `src/components/map/RouteLegend.svelte`, rendered by `MapView`
top-right (opposite the sheet), visible only while a stop is selected. Each row
is a color swatch + route short name + live-vehicle count. Needs one new i18n
key, `map.routes_shown`; route names come from existing data.

**Basemap dim:** new `setBasemapDimmed(boolean)` on both providers. A shared DOM
overlay is not viable — a sibling `<div>` over `#map` cannot slot between
Leaflet's internal panes, so it would dim the routes and markers too.

- **OSM:** toggle a class on the map container; CSS applies a
  saturate/brightness/opacity filter to `.leaflet-tile-pane`, which holds the
  MapLibre GL canvas and nothing else.
- **Google:** `setOptions({ styles })` with a desaturate/lighten styler appended
  to the current theme styles.

### Vehicle polling for N routes

This is the one place the existing code is actively wrong for the new use, not
merely insufficient. `removeInactiveMarkers` sweeps **every** entry in the
module-level `vehicleMarkersMap` that is absent from the single polled route's
`activeKeys`. Three concurrent per-route polls would each delete the other two
routes' markers on every tick, and the vehicles would flicker in and out.

`vehicleUtils.js` gains:

```js
fetchAndUpdateVehiclesForRoutes(routes, mapProvider, { highlightedTripId, onCounts });
// routes: [{ id, type, color }] -> single interval id
```

It fetches all routes in parallel, unions their `activeKeys`, and **scopes the
sweep to the routes actually polled** by recording the owning `routeId` alongside
each marker. `onCounts(Map<routeId, number>)` feeds the legend's live counts.

The existing single-route `fetchAndUpdateVehicles` becomes a thin wrapper over
the new function, so `SearchPane` and `RouteMap` keep working through one code
path rather than two divergent ones. Its signature and behavior are unchanged.

### Trip expansion

When the rider expands an arrival row, the multi-route layer **stays**. The
expanded row's route moves to the `obaRoutePromoted` pane (drawn above its
peers) and its vehicle takes the amber highlight glow; the other routes stay
drawn at normal weight. This reads as focus rather than replacement, and matches
the brief's "primary route on top."

`RouteMap` therefore must not mount while a stop is selected — its
`loadRouteData` opens with `clearAllPolylines()` + `removeStopMarkers()`, which
would wipe the layer. `MapView` already receives the selected stop as its `stop`
prop, so its mount condition (`MapView.svelte:302`) becomes
`selectedTrip && showRouteMap && !stop`. `RouteMap` is otherwise untouched and
keeps serving route-search selection.

## State Model

| State                  | Stops                                                                     | Routes                        | Vehicles                              | Basemap |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------- | ------------------------------------- | ------- |
| No selection (default) | all `full`                                                                | none                          | none                                  | normal  |
| Stop selected          | selected = `full` + highlighted; route stops = `routeDot`; rest = `muted` | one polyline per active route | one per active trip, colored by route | dimmed  |
| Stop + row expanded    | unchanged                                                                 | expanded route promoted       | expanded trip's vehicle glows amber   | dimmed  |

Selecting a stop keeps the existing `flyTo` framing. Deselecting clears
polylines and casings, vehicle markers, the poll interval, `stopArrivals`, and
the dim, and restores all markers to `full` — reusing the teardown already in
`MapExperience`'s framing effect and `closePane`.

## Error Handling

- **A shape fetch fails.** That route is dropped from the layer, the legend, and
  the ring-dot set; the other routes draw normally. Logged, not surfaced — a
  missing line degrades the map rather than breaking it, matching how
  `SearchPane` already skips an undecodable polyline segment.
- **No arrivals, or arrivals still loading.** The layer draws nothing, stops stay
  `full`, and the basemap stays undimmed. All three flip together once there is a
  real route set to tier against, so the map never shows a screen of gray dots on
  a washed-out basemap with no lines to justify them. A stop with genuinely zero
  arrivals therefore keeps today's map exactly — which is correct: there is no
  catchable bus to point at.
- **Selection changes mid-fetch.** A load token per selection, following the
  `routeLoadToken` pattern already in `SearchPane.handleRouteClick` — a
  superseded load returns without touching the map.
- **A vehicle poll fails for one route.** Already handled: `fetchVehicles`
  returns an empty result and warns. The scoped sweep must treat a failed route
  as "no data this tick" and leave its markers alone, rather than reading the
  empty result as "all gone" and clearing them.

## Testing

Unit (Vitest, `npx vitest run` — `npm run test` hangs in non-TTY):

- `activeRoutes.js`: dedupe by `routeId`; soonest-trip selection when a route has
  several arrivals; predicted-vs-scheduled time fallback; exclusion of signed
  routes with no arrival; empty and malformed responses.
- `assignRouteColors`: collision de-collision; missing/invalid GTFS color; the
  same `routeId` yielding the same color across reordered inputs; light vs dark.
- `vehicleUtils.fetchAndUpdateVehiclesForRoutes`: markers for route A survive a
  tick that also polls B and C; a route dropping a vehicle removes only that
  marker; a failed fetch for one route leaves its markers intact; the
  single-route wrapper keeps its current behavior.

Component:

- `StopMarker`: each emphasis tier renders its expected shape; `routeDot` uses
  `dotColor`; the `sr-only` name and the button are present in **every** tier;
  `routes-label` renders for `full` only.

Manual (the `/go` end-to-end pass): select a stop and confirm the tiers, the
lines, the vehicles, the legend, and the dim; expand a row and confirm promotion
plus the amber glow; close and confirm full restoration with no leaked interval
or polyline; pan mid-selection and confirm newly-loaded stops arrive already
tiered; repeat on a stop whose routes share a GTFS color.

## Risks

- **The `vehicleUtils` rework touches live code paths.** `SearchPane` and
  `RouteMap` both call `fetchAndUpdateVehicles`. Keeping it as a wrapper with an
  unchanged signature contains the blast radius, but route-search vehicles need
  a manual regression check, not just unit tests.
- **Request volume on multi-route stops.** 2 requests per route on every
  selection. Parallel and one-shot, but a downtown stop with 8 routes is 16
  requests. If this proves heavy, the mitigation is a per-selection cap on routes
  drawn (soonest N), which the legend already makes legible.
- **Google provider parity is less exercised than OSM.** Dimming in particular
  uses a different mechanism per provider. `PUBLIC_OBA_MAP_PROVIDER=google`
  needs its own manual pass.
- **Badge override applies only in the map view.** A de-collided route shows its
  assigned color on `/map/stops/:id` and its GTFS color on `/stops/:id`. This is
  inherent to resolving color from the map's active-route set, and is preferred
  over de-colliding globally against routes that aren't on screen.

## Mobile

The tiering, routes, vehicles, and dim are viewport-independent and apply on
mobile as they do on desktop. The legend is desktop-only (`md:` and up) — at
phone width the bottom sheet already occupies the space, and the badge colors in
the arrivals list carry the same mapping.
