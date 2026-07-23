# Shareable `/map/stops/{id}` deep links — design

## Problem

When a rider taps a stop on the map, the app calls `pushState('/stops/${stop.id}')`
(shallow) and flies to the stop. That URL **collides** with the standalone stop page
at `src/routes/stops/[stopID]/+page.svelte`, so reloading or sharing the link renders
the full-page standalone detail view — **not** the map with the stop open and framed.

We want a dedicated URL, `/map/stops/{stop_id}`, that:

1. Is pushed onto history when a stop is opened on the map.
2. When opened directly (cold load / share), reopens the same stop on the map, zoomed
   in and framed exactly as an in-app marker tap would frame it.

## Decisions (settled during brainstorming)

- **Two distinct URLs.** `/map/stops/{id}` = map view with the stop sheet open (marker
  taps + sharing). `/stops/{id}` stays the standalone full-page detail, still reached via
  the sheet's "View Details" button. `/stops/{id}/schedule` unchanged.
- **Cold load = instant, pre-centered.** A direct `/map/stops/{id}` load boots the map
  already centered on the stop at zoom 16 (with the mobile 25% offset), sheet already
  open. No fly animation on cold load.
- **Route-group layout owns the map.** `/` and `/map/stops/{id}` live under a `(map)`
  route group whose `+layout.svelte` owns the map, so navigating between them keeps the
  map mounted (no re-init).
- **Marker tap = instant (shallow `pushState`).** A tap pushes the URL + history entry
  using the stop object the marker already carries — no server round-trip. Cold
  loads/shares use a server `load`.
- **Close = `pushState('/')`** (shallow, matches today's behavior). Simpler than
  `history.back()` and never risks leaving the site on a cold-loaded share. Tradeoff:
  after close, the Back button reopens the stop.

## Environment notes

- SvelteKit **2.8.4** — use `$page.state` from `$app/stores` (the `$app/state`
  `page.state` API needs 2.12+). Matches the existing `import { page } from '$app/stores'`
  in the current page.
- `MapContainer` already accepts an `initialCoords={{ lat, lng }}` prop that flows to
  `MapView.initMap()` — the hook for pre-centering on cold loads.
- `flyTo(lat, lon, zoom, { offsetY })` already supports the mobile vertical offset (added
  in the "lift selected stop above the mobile bottom sheet" change on this branch).

## Route structure

```
src/routes/
├ (map)/
│  ├ +layout.svelte              ← owns the map shell + shared UI (persists across /)
│  ├ +page.svelte                ← "/"  (idle map, no stop selected)
│  └ map/stops/[stopID]/
│     ├ +page.server.js          ← load: fetch the stop (cold loads / shares)
│     └ +page.svelte             ← minimal; the sheet is rendered by the layout
├ stops/[stopID]/                ← UNCHANGED standalone detail page
│  ├ +page.server.js
│  ├ +page.svelte
│  └ schedule/+page.svelte
└ +layout.svelte                 ← root layout, unchanged
```

`/` ↔ `/map/stops/{id}` share the `(map)/+layout.svelte` segment, so navigating between
them keeps the map mounted.

The current ~400-line `src/routes/+page.svelte` body moves into the layout. To keep it
focused and testable, extract it into `$components/MapExperience.svelte` (the map + sheet
+ handlers) that `(map)/+layout.svelte` renders once. The child `+page.svelte` files are
minimal — the layout renders the sheet based on the URL.

## Source of truth: which stop is open

The selected stop is derived from the URL, which unifies both entry paths:

```js
// in the layout / MapExperience
import { page } from '$app/stores';

let selectedStopId   = $derived(stopIdFromPath($page.url.pathname));   // null on "/"
let selectedStopData = $derived($page.state?.stopData ?? $page.data?.stopData ?? null);
let stopSheetOpen    = $derived(selectedStopId != null);
```

- **Marker tap** → data comes from `$page.state.stopData` (pushed, no fetch).
- **Cold load / share** → data comes from `$page.data.stopData` (server load).
- Deriving `selectedStopId` from the **pathname** (not `$page.params`) is what lets
  shallow `pushState` and real navigation share one code path: shallow routing updates
  `$page.url` but **not** `$page.params` (no navigation occurs).

`stopIdFromPath(pathname)` parses `/map/stops/<id>` → `<id>` (decodeURIComponent),
returns `null` otherwise. Lives in `$lib` and is unit-tested.

The other modals (route / all-routes / trip-planner) stay on local `currentModal` state
as today — only the **stop** case becomes URL-backed. An effect keeps them mutually
exclusive: when `selectedStopId` becomes non-null, clear route/trip state (mirrors the
cleanup block in today's `handleStopMarkerSelect`).

## Data flow

### Marker tap (instant, no fetch)

```js
function handleStopMarkerSelect(stopData) {
  // …existing route/polyline/vehicle cleanup…
  pushState(`/map/stops/${stopData.id}`, { stopData });   // URL + history entry, no fetch
  // …highlight marker, analytics (reportStopViewed), loadSurveys — as today…
}
```

`stop`/`currentModal === STOP` local state is replaced by the derived
`selectedStopData`/`stopSheetOpen`.

### Cold load / share (server load)

`map/stops/[stopID]/+page.server.js` mirrors the existing standalone loader but returns
the stop **entry**, normalized to the shape the marker provides, so `selectedStopData` is
uniform across both paths:

```js
import oba, { handleOBAResponse } from '$lib/obaSdk.js';

export async function load({ params }) {
  const res  = await oba.stop.retrieve(params.stopID);
  const body = await handleOBAResponse(res, 'stop').json();
  return { stopData: body.data.entry };   // { id, lat, lon, name, routeIds/routes, … }
}
```

Arrivals continue to be fetched client-side by `StopPane` (unchanged), so the loader
stays light. During implementation, confirm the exact fields `StopBottomSheet`/`StopPane`
read and normalize the loader output to match the marker's stop object (routes,
direction, etc.).

## Map positioning

A single effect drives framing, reusing the existing `offsetY`:

- **Cold load** → `MapContainer` gets `initialCoords` from `$page.data.stopData` (zoom
  16), so the map boots centered on the stop. Then one
  `flyTo(lat, lon, 16, { animate: false, offsetY })` applies the mobile 25% lift with no
  visible motion.
- **Marker tap / in-app selection** → `flyTo(lat, lon, 16, { offsetY })` **animates**,
  exactly as today.

`offsetY` is `MOBILE_STOP_MAP_OFFSET_Y` (0.25) below the `md` breakpoint, else 0 — desktop
uses the side-panel sheet and needs no offset. Note: `initialCoords` currently carries
only `{ lat, lng }`; extend it (or the map init) to accept a zoom so cold loads frame at
zoom 16, or apply the zoom via the follow-up instant `flyTo`.

## Close & back/forward

- **Close button (`closePane`)** → `pushState('/')` (shallow). `selectedStopId` derives to
  null → sheet closes, map stays put. Keeps existing polyline/marker/interval cleanup.
- **Back / forward** → history pops update `$page.url` / `$page.state`, so the sheet opens
  and closes automatically. This is the core benefit of shallow routing.

## Types & SSR

- Add an `App.PageState` interface to the currently-empty `src/app.d.ts` for type-safe
  `pushState` / `page.state`:

  ```ts
  declare global {
    namespace App {
      interface PageState {
        stopData?: { id: string; lat: number; lon: number; name: string; [k: string]: unknown };
      }
    }
  }
  export {};
  ```

- The stop route SSRs `stopData`, so shared links get a correct `<title>` / meta and the
  sheet header renders before hydration.
- Shallow-routing caveat (from the SvelteKit docs): `page.state` is empty during SSR and
  on the first landing page until the user navigates. This is why cold loads read
  `$page.data.stopData` (server load) rather than `page.state`.

## Testing

- **Unit**: `stopIdFromPath` (matches `/map/stops/{id}`, decodes, returns null otherwise);
  loader returns a normalized stop entry.
- **Component**: layout/`MapExperience` renders the sheet when `$page.url` is
  `/map/stops/{id}` (via `$page` mock) and hides it on `/`; `handleStopMarkerSelect` calls
  `pushState` with `{ stopData }`; `closePane` calls `pushState('/')`.
- **E2E (Playwright, mobile viewport)**: cold-load `/map/stops/{id}` → sheet open + stop
  framed ~25% from top; tap a marker → URL updates to `/map/stops/{id}` + sheet opens
  instantly (no fetch); browser Back closes the sheet. Reuses the mobile-viewport harness
  from the offset fix.

## Out of scope

- URL-backing the route / all-routes / trip-planner modals (stay local state).
- Changing or removing the standalone `/stops/{id}` detail page.
- Server-side fetching of arrivals for the cold-load sheet (client fetch is retained).

## Dependencies / sequencing

This feature reuses the `flyTo(..., { offsetY })` offset added on the current branch
(`fnf4`). Branch the implementation from that work (or land it first) so `offsetY` is
available.
