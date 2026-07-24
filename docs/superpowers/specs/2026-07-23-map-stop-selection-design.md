# Map Stop Selection: De-emphasized Stops + Active Routes & Vehicles

**Date:** 2026-07-23
**Status:** Approved (design), revised after review
**Reference mockup:** `Map Stop Selection.dc.html` (Claude Design project
`aecacf9f-fdfa-41ba-950c-5922677d07a1`)

> **Revision note.** The first draft assumed stop markers stay mounted while a
> stop is selected. They do not — expanding an arrival row flips `mapMode` to
> `ROUTE` and destroys every marker. That invalidated the central mechanism, and
> the fix (§Prerequisite fixes) is now the first work item. Four other blockers
> and a set of smaller corrections from the same review are folded in below.

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
- **No geometric corridor offset.** The brief asks for a ~2px perpendicular
  offset where routes share a corridor. A true parallel offset is a screen-space
  transform that must be recomputed on every zoom, and there is no cross-provider
  primitive for it (Leaflet would need `leaflet-polylineoffset`; Google has no
  equivalent). Instead we use **graduated stroke weights** — see §Polyline
  styling — which achieves the same legibility goal with no geometry work and
  works identically on both providers. True offset stays a follow-up.
- **No draw-in reveal on Google.** Google's `Polyline` exposes no SVG path, so
  the `stroke-dashoffset` technique has no analogue. Google draws instantly.
  Stated here because the first draft wrongly assumed both providers had it.
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

## Prerequisite fixes

These are corrections to existing behavior that the feature cannot be built on
top of. They land in the same PR, before the feature work.

### P1 — `mapMode` must not leave `NORMAL` while a stop is selected

`MapView.svelte:77-84` calls `clearAllMarkers()` → `clearAllStopMarkers()`
whenever `mapMode !== NORMAL`, which destroys every `StopMarker` and empties
`markersMap`. Expanding an arrival row reaches that state: `StopPane:179-189`
calls `tripSelected` **and** `handleUpdateRouteMap`, which in
`MapExperience:253-260`/`:277` set `selectedTrip`, `isRouteSelected = true`,
`selectedRoute`, and `showRouteMap = true` — and `MapView.svelte:60` turns any
of those into `Modes.ROUTE`.

So the exact interaction §Trip expansion is designed around currently unmounts
every marker, and the 100ms debounce back to `NORMAL` on collapse re-mounts them
fresh at `emphasis: 'full'` over the route lines.

**Fix:** gate the ROUTE branch on there being no selected stop. `MapView`
already receives the stop as a prop:

```js
} else if (!stop && (selectedRoute || isRouteSelected || showRouteMap || selectedTrip)) {
    newMode = Modes.ROUTE;
```

The claim that markers are never destroyed and recreated is **false** in
general — `onDestroy` (`MapView.svelte:292`) and this effect both do it. What is
true after this fix is narrower and sufficient: markers survive for the lifetime
of a stop selection.

### P2 — closing the sheet with a row expanded strands the map

`closePane()` (`MapExperience.svelte:211-214`) short-circuits for the stop case
(`if (stopSheetOpen) { pushState('/', {}); return; }`) and never resets
`showRouteMap`, `isRouteSelected`, or `selectedRoute`. The framing effect's
`else` branch (`:173-186`) clears only `selectedTrip`. The accordion's collapse
callback never fires, because `StopPane` is destroyed rather than collapsed.

After expand → close, those three stay truthy, `mapMode` sticks at `ROUTE`
forever, `clearAllMarkers()` keeps running, and `debouncedLoadMarkers`
early-returns (`MapView.svelte:157`). No stop markers return until a full
navigation.

This is a **pre-existing bug**, not one we introduce, but the feature surfaces
it on every close. **Fix:** reset `showRouteMap = false`, `isRouteSelected = false`,
`selectedRoute = null` alongside `selectedTrip = null` in the framing effect's
`else` branch.

### P3 — `clearVehicleMarkersMap()` is missing from stop teardown

`vehicleMarkersMap` is module-scoped (`vehicleUtils.js:17`).
`mapProvider.clearVehicleMarkers()` removes markers from the map but leaves the
module map full of detached references; the next selection finds them via
`.has(markerKey)` and calls `updateVehicleMarker` on dead markers, so those
vehicles never appear. `RouteMap.svelte:31-33` calls both. The stop teardown at
`MapExperience.svelte:184` calls only the first.

**Fix:** add `clearVehicleMarkersMap()` there. This is the brief's "respect
existing cleanup on deselect so nothing leaks between selections."

### P4 — a camera-free polyline reveal

`_revealPolylinesWithDraw` exists only on the OSM provider and is reachable only
from inside `fitToPolylines` (`OpenStreetMapProvider.svelte.js:858`), which hides
every polyline and flies the camera to their bounds. We keep the existing stop
`flyTo` framing, so there is no path today that reveals without refitting. It
also iterates `this.polylines` wholesale, so calling it per-route as shapes
resolve would re-animate every already-drawn route.

**Fix:** extract a public `revealPolylines({ only, duration })` on the OSM
provider that animates exactly the polylines passed to it (plus their
`_casing`) and never touches the camera; `fitToPolylines` delegates to it with
`only` omitted, so its behavior is unchanged. Google gets a no-op — see
Non-Goals.

## Current State (for reference)

Line references verified against the tree at `d16dfbb`.

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
  `marker.props` in place. This is the channel emphasis uses.
- **`markersMap` is polluted on Google.** `GoogleMapProvider.addStopRouteMarker`
  (`:217`) does `markersMap.set(stop.id, marker)` with a bare
  `google.maps.Marker` that has no `.props`, and can overwrite the real
  `StopMarker` entry for the same stop id. The OSM provider does not do this
  (`:260-291` uses `stopMarkers`). Any `markersMap` iteration must guard on
  `marker?.props`, as `updateMarkersRouteLabelVisibility` (`:192`) already does.
- **`RouteMap` draws one trip and clears everything first.**
  `RouteMap.svelte:43` calls `clearAllPolylines()` + `removeStopMarkers()` on
  load, and its `onDestroy` repeats the teardown. It mounts only when
  `selectedTrip && showRouteMap` (`MapView.svelte:302`).
- **`fetchVehicles` cannot report failure.** `vehicleUtils.js:19-32` returns
  `{ references: { trips: [] }, list: [] }` for both a failed request and a
  malformed body — byte-identical to a route with genuinely zero active
  vehicles.
- **`createPolyline` already models attached sub-layers.** The OSM provider
  hangs `polyline.arrowDecorator` off the polyline and tears it down in
  `removePolyline` and `clearAllPolylines`. The white casing follows this
  pattern. `arrowDecorator` is correctly excluded from `this.polylines`; the
  casing must be too, or `fitToPolylines`, `getPolylinesCount`, and
  `_getRoutePaths` all double-count.
- **The arrow decorator lands in `overlayPane`.** `L.Symbol.arrowHead` builds an
  `L.polyline` from `pathOptions`, and `createPolyline` (`:652-668`) passes no
  `pane` — so arrows render at z-index 400, **below** any custom route pane.
- **Leaflet's `createPane` does not set a z-index.** It stamps
  `leaflet-<name>-pane` and `.leaflet-pane { z-index: 400 }` applies, so every
  custom pane ties with `overlayPane` and orders only by DOM insertion. The
  z-index must be assigned explicitly. Each pane does get its own SVG renderer
  (`Map.getRenderer` → `_getPaneRenderer`), and each `Polyline` keeps its own
  `_path`, so the `stroke-dashoffset` technique survives the pane split.
  `markerPane` is 600, so 402/403/404 sit below all markers.
- **The MapLibre GL basemap renders into Leaflet's `tilePane`.** Confirmed in
  `node_modules/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js:23`. So a
  CSS filter scoped to `.leaflet-tile-pane` dims the basemap and nothing else.
- **The Google map is created without a `mapId`** (`src/lib/googleMaps.js:49`),
  so `map.setOptions({ styles })` still applies. JSON styling is not deprecated
  (cloud-based styling is), and it affects only basemap features — `Polyline`,
  `Marker`, and the `OverlayView` that hosts `StopMarker` are untouched.
- **`GoogleMapProvider.setTheme` replaces styles wholesale** (`:486-489`), so
  any dim styler it doesn't know about is destroyed on the next `themeChange`
  — one of which is dispatched unconditionally at `MapView.svelte:275-276`.
- **`RouteBadge` takes hex without `#`.** `RouteBadge.svelte:12` does
  `` `#${color}` ``. Any override must follow the same convention or normalize
  at the boundary.
- **Unpredicted arrivals carry `predictedArrivalTime: 0`, not `null`.**
  `ArrivalDeparture.svelte:74` guards with `arrivalDeparture.predicted && predicted > 0`.

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
// Distinct routes present in the arrivals list, each with its representative trip.
// Routes signed at the stop but with no arrival in-window are excluded.
activeRoutesFromArrivals(response) -> [{ id, shortName, type, tripId, gtfsColor }]

// id -> { line: '#rrggbb', badgeBg: 'rrggbb', badgeFg: 'ffffff' | '000000' }
assignRouteColors(routes, { dark }) -> Map<string, RouteColors>
```

One object shape flows everywhere: `activeRoutesFromArrivals` emits `id`/`type`
so its output feeds `fetchAndUpdateVehiclesForRoutes` directly without a
remapping step.

**Representative trip.** Dedupe `routeId` across
`response.data.entry.arrivalsAndDepartures`, keeping the soonest arrival per
route. The comparison must mirror `ArrivalDeparture`'s own predicate, because
OBA sends `0` rather than `null` for an absent prediction and `??` would sort
every unpredicted arrival to the front:

```js
const bestTime = (a) =>
	a.predicted && a.predictedArrivalTime > 0 ? a.predictedArrivalTime : a.scheduledArrivalTime;
```

We sort on **arrival** time throughout, including at terminals where
`ArrivalDeparture` displays departure time (`:54-62`). One ordering for the
legend and the layer; the list keeps its own display rule.

This is what keeps the map honest: a line on the map means a bus you can
actually catch from this stop is running that route now. In the mockup's stop,
773 is signed but has no arrival in-window, so it is never drawn.

**Color.** `assignRouteColors` runs each route's GTFS color through
`mapContrastColor(gtfsColor, { dark })`. Two cases fall back:

- **Collision.** Real Metro 22 and 128 share a generic color; two identical
  lines in one corridor are unreadable.
- **Missing color.** `mapContrastColor` returns `null` for absent or invalid
  input.

Both fall back to `ROUTE_FALLBACK_PALETTE` in `src/lib/colors.js`. Because a
single hex cannot clear both a light and a dark basemap, each entry is a
light/dark pair, mirroring what `mapContrastColor` does for GTFS colors. These
eight were chosen by computation, not by eye — every entry clears 3:1 against
both basemaps and 4.5:1 against its own computed foreground, and the closest
pair in either mode is 65 units apart in RGB:

| Name    | Light     | Dark      |
| ------- | --------- | --------- |
| Crimson | `#C2185B` | `#F06292` |
| Blue    | `#1565C0` | `#64B5F6` |
| Green   | `#2E7D32` | `#81C784` |
| Orange  | `#E65100` | `#FFB74D` |
| Purple  | `#6A1B9A` | `#BA68C8` |
| Teal    | `#00695C` | `#4DB6AC` |
| Brown   | `#5D4037` | `#BCAAA4` |
| Olive   | `#827717` | `#DCE775` |

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

**`stopArrivals` must be nulled on _both_ selection transitions**, not just on
close. Tapping stop A → stop B keeps `StopBottomSheet` mounted (`stopSheetOpen`
stays true; only `stop` changes), so without an explicit reset the map would
draw A's routes, A's ring dots, and A's vehicles around B's marker for the
~300ms until B's fetch resolves. The framing effect nulls it in the `if (id)`
branch as well as the `else` branch.

Belt and braces, because a stale-but-non-null value is still possible mid-fetch:
`StopRoutesLayer` mounts only when
`stopArrivals?.data?.entry?.stopId === selectedStopId`, not on truthiness.

Two consequences worth stating rather than discovering:

- A `bind:` write-back does **not** reset on unmount — the parent keeps the last
  value written. That is exactly why the explicit null is required. Because
  effects run after DOM updates, the sheet unmounts _before_ the framing effect
  fires, so there is no write-back race.
- Making the prop bindable means `MapExperience` can now push values _down_ into
  `StopPane`. The null-on-deselect travels to `StopPane`'s `routeById`
  derivation (`:175`) and blanks badge colors for one frame, while
  `arrivalsAndDepartures` (`:48`, a separate `$state`) keeps the rows rendered.
  Acceptable; noted so it isn't mistaken for a bug.

### Badge color

`ArrivalDeparture` gains an optional `routeColors` prop (the `RouteColors` entry
for its route), forwarded to `RouteBadge` as `color` and `textColor`.

It is applied **unconditionally**, not only to de-collided routes. This corrects
the first draft: `mapContrastColor` is not the identity function — in dark mode
it lightens anything below 180 brightness by 20–50%, and in light mode it darkens
anything above 200 brightness by 45%. Applying it to the line but not the badge
would leave badge and line different hexes for essentially every route in dark
mode, which is the precise ambiguity this feature exists to remove.

Because the background is no longer the GTFS color, the GTFS `textColor` (chosen
for the original hex) can go unreadable against it. `assignRouteColors` therefore
returns `badgeFg` computed from `getBrightness()` on the resolved background
rather than forwarding `route.textColor`. Values are returned hex-without-`#` to
match `RouteBadge`'s contract; the `#`-prefixed `line` is the map's form. One
conversion point, in `assignRouteColors`, named explicitly.

### Change 1 — Marker emphasis tiers

`StopMarker.svelte` gains:

- `emphasis: 'full' | 'routeDot' | 'muted' | 'hidden'`, default `'full'`
- `dotColor: string | null` — the route color for `routeDot`

`isHighlighted` **stays as-is** and remains the sole signal for "this is the
selected stop." Emphasis decides the marker's _shape_; `isHighlighted` decides
whether the pin is emphasized. `highlightMarker`/`unHighlightMarker` keep working
unchanged.

**The two props have different owners** — `isHighlighted` is written by
`MapExperience`'s framing effect (`:159-161`), `emphasis` by `MapView` — so they
can disagree, and in the obvious implementation they always would: the ring-dot
set is the union of stops across the fetched trips, and the selected stop is
always in that union, since those are the trips that serve it. It would render as
a plain ring dot with no highlight, no glyph, and no caret — the selected stop
becoming the least distinguishable thing on screen.

The invariant lives in one place rather than at every call site:
`setStopEmphasis(byStopId, defaultEmphasis, selectedStopId)` forces `'full'` for
`selectedStopId` inside the provider. A component test asserts that
`emphasis: 'routeDot'` + `isHighlighted: true` never renders as a dot.

| Tier       | Which stops                                        | Rendering                                                                                                      |
| ---------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `full`     | all stops when nothing selected; the selected stop | Today's pin. With `isHighlighted`, the existing `.highlight` (`scale-125 border-brand-accent drop-shadow-md`). |
| `routeDot` | stops served by a drawn route, minus the selected  | 14px white-filled circle, 2.5px border in `dotColor`, small drop shadow. No glyph, no caret.                   |
| `muted`    | every other stop on screen                         | ~9px solid `#8b93a1` at 60% opacity with a thin white halo.                                                    |
| `hidden`   | (unused at `STOP_TREATMENT: 'dots'`)               | Button retained and focusable; the inner dot is not drawn. Not "renders nothing" — see a11y below.             |

Why dots rather than dimming: a 32px pinned icon carries the same visual weight
dimmed or not — shape and size dominate opacity. Collapsing to a dot removes the
_icon_ and keeps only _position_, which is all a background stop needs to
contribute. It also removes the caret clutter, and it lets ringed route-dots
read as beads on a string along each polyline.

**Accessibility.** The `<button>` keeps its `h-8 w-8` (32px) box in **every**
tier, with a transparent background; the dot is a centered inner `<span>`. A 9px
button would be well under the 24px WCAG 2.5.8 target size, and worse on touch.
Every tier keeps the `sr-only` stop name and the same `onClick`, so keyboard
order and screen-reader output are unchanged. The `routes-label` chip renders for
`full` only.

**The brand-accent caret tint is new work, not existing.** `.highlight`
(`StopMarker.svelte:126-128`) is exactly `scale-125 border-brand-accent
drop-shadow-md`; the caret is hard-coded `color: #000` (`:139-143`) with
`dark:text-white` on the icon (`:81`). There is no `.highlight .direction-arrow`
rule. Adding one needs a dark-mode variant checked against the
`dark:bg-neutral-200` marker background.

**Emphasis is seeded at creation, not patched afterward.** `batchAddMarkers`
(`MapView.svelte:206-217`) defers `addMarker` into a `requestAnimationFrame`, so
a synchronous `setStopEmphasis()` after it would iterate a `markersMap` that does
not yet hold the new markers — stops panned into view mid-selection would arrive
as full pins and stay that way. Instead, `emphasis` and `dotColor` join the
`addMarker(options)` contract and the initial `$state({…})` literal in both
providers, and `MapView.addMarker` (`:219`) looks the stop up in the current tier
map the same way it already computes `shouldHighlight` (`:230`).

Seeding both keys in the initial literal also avoids relying on Svelte tracking
_added_ properties on an existing proxy. That does work, but `mount()` effects
do not flush synchronously and the fragility is unnecessary.

New provider methods on both providers:

```js
setStopEmphasis(byStopId, defaultEmphasis, selectedStopId);
resetStopEmphasis();
```

Both iterate `markersMap`, skip entries without `.props` (Google's
`addStopRouteMarker` pollution), and mutate `marker.props` — the same reactive
channel `updateMarkersRouteLabelVisibility` already uses in production.

### Change 2 — Routes and vehicles

New `src/components/map/StopRoutesLayer.svelte`, sibling to `RouteMap.svelte`,
mounted by `MapView` when the stop-id guard above passes.

**Shapes, per route:** `/api/oba/trip-details/{tripId}?includeStatus=false` →
`shapeId` + `schedule.stopTimes`, then `/api/oba/shape/{shapeId}` → encoded
points → `createPolyline(points, { color, casing: true, pane })`. Fetches run in
parallel across routes. `includeStatus=false` (the endpoint defaults it to
`true`, `+server.js:9`) halves the payload — we need only the shape and the stop
times.

Per-trip shapes rather than `stops-for-route` because the trip's shape is the
single direction the rider can actually board, and its `stopTimes` gives the
ring-dot set for free — the stops a catchable bus will actually serve.

**Load token.** A token per selection, following `SearchPane.handleRouteClick`'s
`routeLoadToken` pattern; a superseded load returns without touching the map.

**Ring-dot set:** the union of `stopIds` across the fetched trips, each mapped to
its route's color, **minus the selected stop**. A stop served by more than one
drawn route takes the color of the route whose arrival is soonest.

**Polyline styling:**

- **White casing underneath.** Each route draws twice: a ~9–10px white stroke,
  then the colored stroke on top. The line then reads on any basemap tile without
  a halo hack. The casing hangs off the polyline as `polyline._casing`, is torn
  down by `removePolyline` and `clearAllPolylines`, and is **not** pushed into
  `this.polylines`.
- **Graduated stroke weights** in place of a geometric offset. Routes draw
  back-to-front with decreasing weight (7px, 6px, 5px…, floor 4px), so a route
  underneath shows as a colored fringe on either side of the one above it.
  Because all casings live in one pane below all colored strokes, the fringe is
  not covered by the upper route's casing. This is what makes coincident routes
  legible; see Non-Goals for why not a true offset.
- **Rounded joins and caps** on both strokes.
- **Z-order.** OSM creates three custom panes — `obaRouteCasing` (402),
  `obaRoute` (403), `obaRoutePromoted` (404) — **assigning `style.zIndex`
  explicitly**, since `createPane` does not. All sit below `markerPane` (600).
  The arrow decorator's `pathOptions` must carry the same `pane` as its polyline,
  or arrows render at 400 and disappear under every casing. Google uses `zIndex`
  on the polyline options.
- **Draw-in reveal** via the new camera-free `revealPolylines({ only })` from P4,
  called per route as its shape resolves. OSM only.
- **Direction arrows stay on** (`withArrow` keeps its `true` default). With
  `animateFlow` false there is no other direction cue on the line, and we draw
  one direction per route, so the existing `polylineDecorator` arrows earn their
  place. A deliberate divergence from the mockup, which has none.

The repo's `getTotalLength()` reveal is kept rather than the brief's
`pathLength="100"`. They are equivalent, except that Leaflet rewrites the `d`
attribute on zoom, so a zoom during the ~1.2s reveal leaves a stale
`strokeDasharray`. `pathLength` would be immune. Keeping the existing approach
for consistency with `_revealPolylinesWithDraw`; the staleness is pre-existing
and cosmetic.

**Vehicles:** `generateVehicleIcon.js` is reused unchanged — white circle,
2px route-colored stroke, route-type glyph, direction arrow snapped to 8 compass
points, and the existing `PUBLIC_COLOR_VEHICLE_HIGHLIGHT` amber glow for the
highlighted trip. Positions animate via `animateMarker.js`.

**Legend:** new `src/components/map/RouteLegend.svelte`, rendered by `MapView`
top-right (opposite the sheet), visible only while a stop is selected. Each row
is a color swatch + route short name + live-vehicle count. Needs one new i18n
key, `map.routes_shown`; `en.json` already has a `map` namespace and `en` is the
sync fallback, so the other 24 locales are unaffected and translations are
follow-up, not blocking.

**Basemap dim:** new `setBasemapDimmed(boolean)` on both providers. A shared DOM
overlay is not viable — a sibling `<div>` over `#map` cannot slot between
Leaflet's internal panes, so it would dim the routes and markers too.

- **OSM:** toggle a class on the map container; CSS applies a
  saturate/brightness/opacity filter to `.leaflet-tile-pane`. The class sits on
  the container rather than the layer, so it survives `setTheme`'s MapLibre layer
  rebuild (`:607-613`).
- **Google:** `setOptions({ styles })` with a desaturate/lighten styler. Because
  `setTheme` (`:486-489`) replaces styles wholesale, both it and
  `setBasemapDimmed` must funnel through a single private `_applyStyles()` that
  composes theme + dim from stored state, or a theme toggle silently wipes the
  dim.

### Vehicle polling for N routes

This is the one place the existing code is actively wrong for the new use, not
merely insufficient. `removeInactiveMarkers` sweeps **every** entry in the
module-level `vehicleMarkersMap` that is absent from the single polled route's
`activeKeys`. Three concurrent per-route polls would each delete the other two
routes' markers on every tick.

`vehicleUtils.js` gains:

```js
fetchAndUpdateVehiclesForRoutes(routes, mapProvider, { highlightedTripId, onCounts });
// routes: the activeRoutesFromArrivals shape -> single interval id
```

It fetches all routes in parallel and **scopes the sweep to the routes that
actually succeeded**. Distinguishing failure from emptiness requires a contract
change, because today they are identical:

- `fetchVehicles` returns `null` on a failed request or malformed body, and
  `{ references: { trips: [] }, list: [] }` only for a well-formed empty
  response. **This is a breaking change to an exported, tested function**
  (`src/lib/__tests__/vehicleUtils.test.js`) and must be updated there. The
  wrapper `fetchAndUpdateVehicles` keeps its signature and behavior.
- The sweep scope is built from the successful routes only, so a route whose
  fetch failed keeps its markers rather than having them read as "all gone."

Each entry becomes `{ marker, routeId }` so ownership is explicit. `markerKey` is
`vehicleId || activeTripId` (`:64`), and a physical vehicle can legitimately move
between routes across a shift, so an entry whose `routeId` changes is re-keyed
rather than orphaned.

`onCounts(Map<routeId, number>)` feeds the legend's live counts.

The existing single-route `fetchAndUpdateVehicles` becomes a thin wrapper over
the new function, so `SearchPane` and `RouteMap` keep working through one code
path rather than two divergent ones.

### Trip expansion

When the rider expands an arrival row, the multi-route layer **stays**. The
expanded row's route moves to the `obaRoutePromoted` pane and its vehicle takes
the amber highlight glow; the other routes stay drawn at normal weight. This
reads as focus rather than replacement, and matches the brief's "primary route on
top."

`RouteMap` must not mount while a stop is selected — its `loadRouteData` opens
with `clearAllPolylines()` + `removeStopMarkers()`, which would wipe the layer.
Its mount condition (`MapView.svelte:302`) becomes
`selectedTrip && showRouteMap && !stop`. `RouteMap` is otherwise untouched and
keeps serving route-search selection.

Note this is **separate from** P1: the mount guard stops `RouteMap` from
drawing, while P1 stops `mapMode` from destroying the markers. Both are required;
neither substitutes for the other.

## State Model

| State                  | Stops                                                                     | Routes                        | Vehicles                              | Basemap |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------- | ------------------------------------- | ------- |
| No selection (default) | all `full`                                                                | none                          | none                                  | normal  |
| Stop selected          | selected = `full` + highlighted; route stops = `routeDot`; rest = `muted` | one polyline per active route | one per active trip, colored by route | dimmed  |
| Stop + row expanded    | unchanged                                                                 | expanded route promoted       | expanded trip's vehicle glows amber   | dimmed  |

Selecting a stop keeps the existing `flyTo` framing. Deselecting clears
polylines and casings, vehicle markers, `vehicleMarkersMap` (P3), the poll
interval, `stopArrivals`, the dim, and the stranded route flags (P2), and
restores all markers to `full`.

## Error Handling

- **A shape fetch fails.** That route is dropped from the layer, the legend, and
  the ring-dot set; the other routes draw normally. Logged, not surfaced —
  matching how `SearchPane` already skips an undecodable polyline segment.
- **No arrivals, or arrivals still loading.** The layer draws nothing, stops stay
  `full`, and the basemap stays undimmed. All three flip together once there is a
  real route set to tier against, so the map never shows a screen of gray dots on
  a washed-out basemap with no lines to justify them. A stop with genuinely zero
  arrivals therefore keeps today's map exactly — which is correct: there is no
  catchable bus to point at.
- **Selection changes mid-fetch.** The load token above, plus the stop-id mount
  guard. Note that switching stops while a row is expanded also enters the
  framing effect's teardown branch (`:130-148`), which clears polylines and
  vehicles — correct here, since it is tearing down the previous stop's layer,
  and the token prevents the superseded fetch from redrawing.
- **A vehicle poll fails for one route.** Handled by the `null`-on-failure
  contract above: that route is excluded from the sweep scope and its markers are
  left alone.

## Testing

Unit (Vitest, `npx vitest run` — `npm run test` hangs in non-TTY):

- `activeRoutes.js`: dedupe by `routeId`; soonest-trip selection when a route has
  several arrivals; **`predictedArrivalTime: 0` does not sort first** (this case
  passes under the naive `??` and is the point of the test); exclusion of signed
  routes with no arrival; empty and malformed responses.
- `assignRouteColors`: collision de-collision; missing/invalid GTFS color; the
  same `routeId` yielding the same color across reordered inputs; light vs dark;
  `badgeFg` flipping to black on light backgrounds. Plus a palette test asserting
  every entry's contrast ratios and the minimum pairwise separation, so the
  guarantees in this document are enforced rather than asserted.
- `vehicleUtils`: markers for route A survive a tick that also polls B and C; a
  route dropping a vehicle removes only that marker; **a failed fetch for one
  route leaves its markers intact while a genuinely empty one clears them**; a
  vehicle moving between routes is re-keyed, not orphaned; the single-route
  wrapper keeps its current behavior.

Component:

- `StopMarker` (net-new file — no test exists today): each tier renders its
  expected shape; `routeDot` uses `dotColor`; the 32px button, `sr-only` name,
  and `onClick` are present in **every** tier; `routes-label` renders for `full`
  only; `emphasis: 'routeDot'` + `isHighlighted: true` renders as the highlighted
  pin, not a dot.
- Extend the existing `src/tests/lib/OpenStreetMapProvider.test.js` and
  `GoogleMapProvider.test.js` for `setStopEmphasis` (including the
  `marker.props`-less Google entry), `resetStopEmphasis`, `setBasemapDimmed`
  (including surviving a `setTheme` call), casing creation and teardown, pane
  z-index assignment, and `revealPolylines({ only })`. This is the cheapest
  coverage win and it directly tests the `$state` mutation channel everything
  depends on.

Regression tests for the two prerequisite fixes, since both are behavioral and
cheap to assert:

- `MapView`: with `stop` and `selectedTrip` both set, `clearAllStopMarkers` is
  not called.
- `MapExperience`: after expand-then-`closePane`, `showRouteMap`,
  `isRouteSelected`, and `selectedRoute` are all cleared.

Coverage note: `vite.config.js` sets `all: true` with a global 70% threshold and
no `include`, so **every new file counts whether or not it has a test**.
`StopRoutesLayer.svelte` and `RouteLegend.svelte` need at least smoke coverage or
they will drag the global number down on their own.

Manual (the `/go` end-to-end pass): select a stop and confirm the tiers, lines,
vehicles, legend, and dim; expand a row and confirm promotion plus the amber glow
**and that stop markers do not vanish**; collapse, then close, and confirm full
restoration with no leaked interval, polyline, or module-map entry; tap straight
from stop A to stop B and confirm no cross-contamination; pan mid-selection and
confirm newly-loaded stops arrive already tiered; toggle dark mode with a stop
selected; repeat the pass on a stop whose routes share a GTFS color, and again
with `PUBLIC_OBA_MAP_PROVIDER=google`.

## Risks

- **Two prerequisite fixes touch shared map state.** P1 and P2 change `mapMode`
  and teardown for every consumer, not just stop selection. Route search, the
  route modal, and the trip planner all need a manual pass.
- **The `vehicleUtils` rework changes an exported contract.** `fetchVehicles`
  returning `null` on failure is a breaking change with existing tests.
  `fetchAndUpdateVehicles` stays a compatible wrapper, but `SearchPane` and
  `RouteMap` vehicles need a manual regression check.
- **Request volume on multi-route stops.** 2 requests per route per selection,
  parallel and one-shot; `includeStatus=false` reduces payload but not count. A
  downtown stop with 8 routes is 16 requests. Mitigation if it bites: cap the
  drawn routes at the soonest N, which the legend already makes legible.
- **Vehicle path-snapping degrades with N routes.** `_getRoutePaths` feeds
  `animateMarker`'s `buildRoutePath`, which picks the shape minimizing combined
  endpoint distance across **all** drawn polylines. In a shared corridor a
  vehicle can snap to a neighbor route's shape. Pre-existing logic, newly
  exposed; worth watching in the manual pass.
- **OSM dim is a CSS filter over a WebGL canvas**, which forces a filtered
  composite per frame during pan/zoom. Needs a mobile perf check.
- **Google provider parity is thinner than OSM.** Dimming uses a different
  mechanism, and there is no draw-in reveal. Needs its own manual pass.
- **Badge override applies only where the map resolves colors.** A route shows
  its resolved color on `/map/stops/:id` and its GTFS color on `/stops/:id`.
  Inherent to resolving color from the map's active-route set, and preferred over
  de-colliding globally against routes that aren't on screen.

## Mobile

The tiering, routes, vehicles, and dim are viewport-independent and apply on
mobile as they do on desktop. The legend is desktop-only (`md:` and up) — at
phone width the bottom sheet already occupies the space, and the badge colors in
the arrivals list carry the same mapping.
