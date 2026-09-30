# GTFS-Flex (on-demand) core support — Design

Date: 2026-09-29
Branch: `feat/gtfs-flex-core` (off `develop` 05141a7)

## Problem

OneBusAway servers built on maglev now serve GTFS-Flex data through a new `/api/ondemand`
namespace, plus an `onDemandServiceIds` pointer on stops and routes in `/api/where`. The iOS
(OneBusAway/onebusaway-ios#1462, #1464) and Android (OneBusAway/onebusaway-android#2343, #2346)
apps already show on-demand (demand-responsive transit) zones, service hours and booking
deadlines. Wayfinder shows none of it:

- a rider looking at a map of a flex-served area sees no zones;
- a stop served only by an on-demand service shows "no arrivals" and nothing else;
- there is no way to learn how, or by when, to book a ride.

## Goal

A rider on a Wayfinder deployment whose OBA server supports `/api/ondemand` can:

1. see on-demand zones on the map;
2. learn from a stop that on-demand service is available there;
3. open a service and read its hours, where it goes, and how and by when to book.

A deployment whose server has no `/api/ondemand` behaves exactly as it does today.

## Sources of truth

- **API contract:** maglev `testdata/openapi-ondemand.yml` (not in the upstream OBA OpenAPI spec).
- **Booking-deadline algorithm:** wiki _GTFS-Flex Support_ §2.5, as refined by §6 of maglev
  `docs/superpowers/specs/2026-09-24-gtfs-flex-implementation-design.md`. Both are summarised
  normatively in §5 below.
- **Shared test vectors:** maglev `testdata/flex-booking-vectors.json` (22 vectors), mirrored
  byte for byte into `src/tests/fixtures/flex-booking-vectors.json`.
- **UX rules:** the DRT UI design shared by iOS and Android (`2026-09-26-drt-ui-design.md` in
  both repos), §2.5–2.6 and §3.6, adapted for the web as described here.
- **Reference implementation:** iOS `OBAKitCore/Models/OnDemand/` (`BookingDeadlineEvaluator`,
  `OnDemandBookingResolution`, `OnDemandAvailability`, `OnDemandServiceSummary`). Where this
  spec is silent on a detail of the evaluator or availability model, match iOS.

## Scope

**In scope (this spec, one PR):**

- the data layer (proxies, server support detection, models);
- the pure booking and availability logic;
- polygon drawing in all three map providers;
- the zones layer;
- the stop card;
- the service detail sheet and its route.

**Deferred to a phase-2 spec:**

- the dock (zone card and docked bar);
- the overlap picker;
- the address check for dropped pins and search results;
- the trip-planner "On-demand options" fallback;
- region-level labelled zone pins;
- a zone layer toggle;
- the agency services list;
- nearest-edge geometry and full-geometry fetches;
- flex legs in OTP itineraries.

**Inherited rulings:**

- No service-kind badge or subtitle; show the name only (R10).
- Containment comes only from the server. Simplified geometry is display-only.
- Booking deadlines are computed on the client with the device clock and the agency timezone,
  never from the envelope's `currentTime`.
- Booking messages are shown verbatim.
- Absent `eligibility` shows nothing.
- No env feature flag: support is detected at runtime.

## 1. Architecture

Logic lives on the client in pure modules, behind thin server proxies (approach A):

```
maglev /api/ondemand/*  ←  SvelteKit proxies (src/routes/api/oba/ondemand/**)  ←  browser
                               │ key, validation, support detection, agency filter
                               ▼
                         src/lib/onDemand/*.js   (pure: models, deadlines, availability, hours, colors, zoom)
                         src/lib/onDemand/onDemandState.svelte.js   (reactive shared state)
                               ▼
      OnDemandZonesLayer.svelte · OnDemandStopCard.svelte · OnDemandServiceSheet.svelte
```

Status is computed on the rider's device because it has to change at the deadline instant
without another round trip, and because iOS and Android are structured the same way, so the
rulings and vectors carry over one to one.

## 2. Data layer

### 2.1 Proxies

These follow the raw-fetch pattern of `api/oba/surveys` and `api/oba/alerts`: build the URL
with `buildURL(PUBLIC_OBA_SERVER_URL, path, {key: PRIVATE_OBA_API_KEY, …})`, validate query
parameters the way `arrivals-and-departures-for-stop/[id]/+server.js` does, and return 400
with a message for bad input.

| Wayfinder route                               | Upstream                                  | Parameters                                                                           |
| --------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /api/oba/ondemand/services-for-location` | `api/ondemand/services-for-location.json` | `lat`, `lon` (required); either `radius`, or `latSpan` + `lonSpan`; `geometryDetail` |
| `GET /api/oba/ondemand/service/[id]`          | `api/ondemand/service/{id}.json`          | `geometryDetail`                                                                     |

- `geometryDetail` must be `none`, `simplified` or `full`. Anything else is a 400. When it is
  absent, the proxy doesn't send it, so the server default applies.
- Span parameters must be positive finite numbers; the radius must be in `(0, 20000]`.
- The `[id]` segment is URI-encoded when forwarded.
- The upstream fetch lives in `src/lib/onDemand/upstream.js`, so the SSR page load (§4.3) and
  the proxies share it: `fetchOnDemand(path, params) → {status, body}`.
- Successful responses are passed through unchanged (`json(body)`), except for the agency
  filter below.

**Agency filter.** When `PRIVATE_OBA_AGENCY_FILTER` is set:

- services-for-location removes list entries whose `agencyId` is not in the filter;
- service/[id] returns 404 for such a service.

`filterStops` in `$lib/agencyFilter.js` also keeps a stop when any of its `onDemandServiceIds`
belongs to a target agency, using the same agency-prefix convention as `routeBelongsToAgency`.
Without this, flex-only stops, which have no `routeIds`, would disappear from filtered
deployments.

### 2.2 Server support detection

`src/lib/onDemand/serverSupport.js` holds one process-wide verdict for the deployment's OBA
server: `supported`, `unsupported` or `unknown`.

- **What counts as unsupported:** an upstream reply to **services-for-location** that is
  - HTTP 404;
  - a 2xx whose body isn't JSON, or is JSON without a numeric `code` field (stock maglev
    serves its HTML SPA here);
  - an envelope with `code: 404`.
- **Recording the verdict:**
  - An unsupported reply records `unsupported` with a timestamp.
  - Any 2xx envelope with `code: 200` records `supported`.
  - An `unsupported` verdict older than one hour is treated as `unknown`, so the next request
    probes again and a server upgrade is picked up without a restart.
- **While the verdict is `unsupported`,** both proxies answer
  `501 {error: 'ondemand_unsupported'}` without calling upstream.
- **A 404 from `service/[id]`** is an ordinary not-found (`404 {error: 'not_found'}`) and
  never changes the verdict. A 2xx non-envelope from `service/[id]` (the stock maglev SPA)
  does record `unsupported`, so a cold `/map/ondemand/[id]` load redirects home.
- **Any other upstream failure** is transient: network errors, 5xx, and envelope codes other
  than 200 or 404. The proxy returns `502 {error: 'upstream_error'}`, and the verdict is
  unchanged.
- **Testing:** the module exports `resetOnDemandSupportForTesting()`.

### 2.3 Models

`src/lib/onDemand/models.js` has pure parse functions with JSDoc typedefs in the style of
`$lib/types.js`:

- `parseServiceList(body)` → `{services, references, outOfRange}`
- `parseServiceEntry(body)` → `{service, references}`

Parsing never throws on well-formed JSON:

- **Unknown enum values** become `'unknown'`: `serviceKind`, `matchReason`, and `bookingType`
  when it is outside 0–2.
- **Missing arrays** become `[]`. That covers `rules`, `calendarIds`, `stopIds`, `days`,
  `exceptedDates`, and each of the ten reference keys.
- **Missing optional scalars** become `null`.

A service is joined with its references so later code needs no lookups:

- `service.agency`, from `references.agencies`, where `timezone` lives;
- `service.route`, from `references.routes` when `routeId` is set;
- maps from id to object for `serviceAreas`, `locationGroups`, `bookingRules`, `calendars`
  and `stops`.

`onDemandServiceIds(entity)` returns the entity's `onDemandServiceIds`, or `[]` when it is
absent, for any stop or route object.

**Passthrough check.** The existing SDK-backed stop, stops-for-location and arrivals proxies
already pass unknown fields through; the SDK returns the raw body. The plan verifies this with
a test that `onDemandServiceIds` survives `stops-for-location` and `stop/[id]`.

### 2.4 Client state

`src/lib/onDemand/onDemandState.svelte.js` exports one `$state` object and some functions:

- `onDemandState.support`: `'unknown' | 'supported' | 'unsupported'`.
  - Any proxy reply of 501 sets `unsupported`; any 200 sets `supported`.
  - Once `unsupported`, every flex surface hides for the rest of the page session, and no more
    ondemand requests are made.
- `fetchServicesForViewport({lat, lon, latSpan, lonSpan})`:
  - calls services-for-location with `geometryDetail=simplified`;
  - caches results for 10 minutes in a `Map` keyed by `lat,lon,latSpan,lonSpan`, each rounded
    to 2 decimals;
  - returns `{services, references}` or `null` (unsupported or failed).
- `fetchService(id, geometryDetail)`:
  - caches results for 10 minutes in a `Map` keyed by `id|geometryDetail`;
  - a `simplified` entry satisfies a `none` request, and nothing else substitutes;
  - returns the parsed entry, `{notFound: true}`, or `null` (unsupported or failed).
- Concurrent identical requests share one in-flight promise.
- `resetOnDemandStateForTesting()`.

## 3. Map zones

### 3.1 Provider polygon API

All three providers gain the same methods:

```js
createPolygon(geometry, { color, fillOpacity, weight, opacity, halo, interactive, onClick }) → handle
setPolygonStyle(handle, { color, fillOpacity, weight, opacity, halo })
removePolygon(handle)
clearAllPolygons()
```

- `geometry` is GeoJSON `Polygon` or `MultiPolygon` in `[lon, lat]` order. Holes are
  supported: every ring after the first in each polygon is a hole.
- `halo` is optional: `{weight, opacity}`. It draws a wider translucent stroke of the same
  colour underneath.
- `interactive: false` means the polygon never captures pointer events.
- Polygons are tracked in `this.polygons`, never in `this.polylines`, so `clearAllPolylines`,
  `fitToPolylines`, `getPolylinesCount` and route paths never touch zones.

**Per provider.** Each provider draws polygons below every route line:

- **OSM:** `L.polygon(latLngRings)` on a new `ZONE_PANE` (z-index 401) registered in
  `$lib/mapPanes.js` and created alongside the route panes. The halo is a second polygon with
  `fill: false`, drawn first.
- **Google:** `google.maps.Polygon({paths})` with `zIndex` below `ROUTE_LAYER_Z_INDEX` values.
  The halo is a second `Polygon` with `fillOpacity: 0`, `clickable: false`.
- **ArcGIS:** `Polygon` plus `SimpleFillSymbol` graphics in a new `zonesLayer`
  `GraphicsLayer`, inserted first in `Map.layers`. `Polygon.js` and `SimpleFillSymbol.js` join
  the lazy-import list. The halo is a second graphic with a transparent fill and a wider
  outline. Clicks are resolved through the existing `hitTest` path when `interactive` is set.

`destroy()` clears polygons on every provider.

### 3.2 Zoom level

`src/lib/onDemand/zones.js`:

```js
zoneLevel({north, south}) → 'street' | 'region' | 'hidden'
visibleHeightKm = (north − south) × 111.32
street: ≤ 4 km; region: ≤ 65 km; hidden: otherwise
```

These are Android's thresholds. The web map, like MapLibre, has no map-point unit.

### 3.3 Colours

`src/lib/onDemand/colors.js`:

```js
assignZoneColors(services) → Map<serviceId, '#rrggbb'>
```

1. Work through services in id order.
2. Each service's base colour is its route's `color` (normalised to `#rrggbb`), else the brand
   green `#78aa36`.
3. When a base colour has already been assigned in this set, the service takes the next
   palette colour not yet used: `#3b82f6`, `#d97706`, `#7c3aed`, `#db2777`, `#0891b2`,
   `#65a30d`. When those run out, it keeps its base colour.

### 3.4 `OnDemandZonesLayer.svelte`

A renderless component, like `StopRoutesLayer`, mounted by `MapView.svelte` with the map
provider and `mapMode`.

**When it runs**

- It runs on map idle through the existing 300 ms debounced move/zoom callback, and once after
  the map loads.
- In any mode other than `NORMAL`, or when `onDemandState.support === 'unsupported'`, it
  removes its polygons and does nothing else.
- It computes `zoneLevel(getBoundingBox())`. At `hidden`, it removes its polygons and makes no
  fetch.

**Fetching and diffing**

- Otherwise it calls `fetchServicesForViewport` with the bbox centre and spans.
- It keeps a `Map<serviceId, handle[]>`.
  - A service is drawn when it has at least one area in `references.serviceAreas` with
    `geometry` that is referenced by any rule's `fromIds` or `toIds`.
  - Services that are no longer returned are removed.
  - Services already drawn are restyled, not redrawn.
- A result that arrives after a newer request was issued is discarded.

**Styling**

Colours come from `assignZoneColors` over the current service set.

| Level  | Fill | Stroke          | Halo                | Interactive                       |
| ------ | ---- | --------------- | ------------------- | --------------------------------- |
| region | 0.2  | 2 px, opacity 1 | none                | yes: click opens the detail sheet |
| street | 0    | 4 px, opacity 1 | 10 px, opacity 0.25 | no                                |

**Highlight.** When `onDemandState.highlighted` is set (by the detail sheet, to the service
object it loaded):

- that service is drawn with stroke weight +2;
- the others are drawn at opacity 0.6 (stroke and fill scaled);
- the highlighted service is drawn even when the current viewport fetch didn't return it,
  using the geometry the sheet loaded;
- it stays drawn even when the map is zoomed out past region level, so the selected service
  is never invisible.

## 4. Stop card and detail sheet

### 4.1 `OnDemandStopCard.svelte`

This is rendered in `StopPane.svelte` right after `ServiceAlerts`, so it appears on the map
stop sheet and on `/stops/[stopID]`.

**When it shows and what it fetches**

- It shows when `onDemandServiceIds(stop)` is non-empty and support is not `unsupported`.
- It fetches `fetchService(id, 'none')` for every id concurrently, keyed on the sorted id set.
  An `$effect` re-runs only when that key changes, so the 30 s arrivals poll never refetches.
  A superseded load is ignored.
- Failed or not-found services are dropped silently. When none load, the card doesn't render.
  The card never shows an error.

**Content**

- Heading "On-demand service".
- One row per service:
  - the name, with the status line (§5.3) underneath in muted text;
  - the row links to the service's detail sheet (§4.2);
  - an optional trailing `tel:` link when the contact booking rule has a phone number.
- Rows are sorted with `sortServices` (§5.4).

**Empty arrivals.** When there are no arrivals in the window and the card has at least one
row, `StopPane` replaces its empty-arrivals text with "No scheduled departures here. On-demand
service is available."

### 4.2 `OnDemandServiceSheet.svelte`

**Opening it**

- **Route:** `src/routes/(map)/map/ondemand/[serviceId]/+page.server.js` and `+page.svelte`,
  mirroring `(map)/map/stops/[stopID]`.
- **Opening in the app:** a zone click or a stop-card row calls
  `pushState(onDemandServicePath(id), {onDemandServiceId: id})`. `onDemandServicePath` lives
  in `$lib/urls.js` beside `mapStopPath`.
- **From the standalone `/stops/[id]` page:** the card rows are plain links to
  `/map/ondemand/[id]`.
- **Where it renders:** `MapExperience.svelte` gains an `OnDemandServiceSheet` branch in its
  pane chain, built on `navigation/BottomSheet.svelte`. It is selected when
  `$page.state.onDemandServiceId`, or the route param after a cold load, is set.
- **Closing:** returns to `/` the same way the stop sheet does.

**On open**

The sheet:

1. loads `fetchService(id, 'simplified')`;
2. sets `onDemandState.highlighted` to the loaded service;
3. fits the map to the service's area bboxes with the existing fit padding helper, once per
   service id, as soon as both the service and the map provider are available (on a cold
   load the provider arrives after the service).

On close, it clears the highlight.

**Sections, in order.** A section is omitted when its data is empty.

1. **Header**
   - The name, and the close button.
   - The tags row: exactly one booking tag, "No notice needed" (real-time), "Same-day booking"
     or "Advance booking".
   - The description, when present.
   - The status line when the tier is 1 or 2, or when it is 5 with status `closed`.
   - A primary action:
     - "Call {phone}" (`tel:`) when the contact booking rule has a phone number;
     - otherwise "Book online" (`bookingUrl`);
     - otherwise none.
2. **Promoted deadline row**, only when the tier is 3. This is the full booking line: "Book by
   {deadline} for a ride on {travel date}", "Booking opens {instant}", or "Closed".
3. **Where**, shown when the service has more than one area or any rule has `toIds ≠ fromIds`.
   - "Service area" lists the names of the `fromIds` areas and groups. When none are named,
     it reads "{n} zones".
   - "Drop-off" lists the names of the `toIds` members, resolved against `serviceAreas`, then
     `locationGroups`, then `stops`. It appears only when `toIds` differs from `fromIds` in
     some rule.
4. **When**: rows from `hoursRows(service)` (§5.5).
5. **How to book**
   - The booking line (§5.2).
   - "Open agency website" when `url` exists.
   - "More information" when the contact booking rule's `infoUrl` exists and differs from
     `url`.
6. **Footnote**: the contact booking rule's `message`, `pickupMessage` and `dropOffMessage`,
   verbatim, one per line.

- **Not found** (404 or agency-filtered): "This on-demand service is not available in this
  region."
- **Load failure:** a retry button.
- **Unsupported server:** the sheet closes and returns to `/`.

**Refresh.** A timer re-evaluates availability at `nextChangeInstant + 1 s`, and again on
`visibilitychange` to visible. The service is not refetched.

The **contact booking rule** is the pickup booking rule of the first rule that has one, else
the first booking rule in references. This matches iOS `contactBookingRule`.

### 4.3 Cold load

`+page.server.js` calls `loadServiceEntry(id, 'simplified')`, the same upstream path as the
service proxy, with the same support detection.

- It returns `{onDemandServiceId, onDemandEntry}`, where `onDemandEntry` is the service
  envelope, or null when the service was not found or the load failed.
- On unsupported, it redirects to `/` instead of returning.

`+page.svelte` seeds `fetchService`'s cache from `onDemandEntry`. The sheet itself derives
not-found from its own load: with a null entry nothing is seeded, the sheet fetches, and a 404
shows the not-found message.

## 5. Pure logic (`src/lib/onDemand/`)

All of this uses `Temporal` from `temporal-polyfill`, which Wayfinder already depends on.
"Now" is always `Temporal.Now.instant()`, injected as a parameter so tests can fix it.

### 5.1 `bookingDeadline.js` (normative)

```
anchor(D, tz)       = ZonedDateTime(D 12:00 in tz) − 12 h        // DST-safe service-day anchor
instant(D, hms, tz) = anchor(D, tz) + hms                         // hms may exceed 24:00:00

evaluateBooking(rule, bookingRule, D, now, tz, calendarsById)
  → { state: 'notYetOpen'|'open'|'closedForDate'|'unknown', cutoffInstant, openInstant }
```

- **Null booking rule id:** when `rule.pickupBookingRuleId` is null, the result is `open` with
  a null cutoff and a null open instant.
- **Unresolvable booking rule:** when the id is non-null but absent from `bookingRules`, or its
  `bookingType` is outside 0–2, the result is `unknown`.
- `latestPickup = instant(D, rule.endPickupTime ?? '24:00:00')`.

**By booking type**

- **Type 0:**
  - `cutoff = latestPickup`; `open = null`.
  - Fields GTFS forbids for type 0 are ignored.
- **Type 1:**
  - A null `priorNoticeDurationMin` gives `unknown`.
  - `cutoff = latestPickup − durationMin minutes`.
  - `open`:
    - `instant(D, startPickupTime ?? 00:00) − durationMax` when `durationMax` is set;
    - else `instant(D − startDay civil days, startTime ?? 00:00)` when `startDay` is set;
    - else null.
- **Type 2:**
  - A null `priorNoticeLastDay` gives `unknown`.
  - `cutoff = instant(countBack(D, lastDay, cal), lastTime ?? '00:00:00')`.
  - `open = instant(countBack(D, startDay, cal), startTime ?? 00:00)` when `startDay` is set,
    else null.
  - `cal` is `priorNoticeCalendarId`, which is honoured only for type 2 and applies to both
    counts.

**`countBack(D, n, calId)`**

- `n = 0` gives D.
- A null `calId`, or one absent from `references.calendars`, gives D − n civil days. The
  absent case matches iOS.
- Otherwise it steps back day by day, counting only days on which that calendar is active,
  and returns the n-th. The count fails, making the result `unknown`, when:
  - it passes the calendar's `startDate`;
  - the calendar has no active days or has an unparseable `startDate`;
  - completing it would need more than 400 days of walking.

**State:** `notYetOpen` when `now < open`; `closedForDate` when `now > cutoff`; otherwise
`open`.

**`nextBookableServiceDate(rule, bookingRule, now, tz, calendarsById)`** is the earliest date
D′ that meets all of these:

- it is on or after the agency-local today;
- it is no later than the latest `endDate` among the rule's calendars;
- one of the rule's calendars is active on it;
- `evaluateBooking(D′).state === 'open'`.

Dates that evaluate to `unknown` are skipped. When there is no such date, the result is null.

**Calendar activity.** A calendar is active on D when:

- `startDate ≤ D ≤ endDate`;
- D's weekday is in `days`;
- D is not in `exceptedDates`.

**Conformance:** `src/tests/lib/onDemand/bookingDeadline.test.js` runs every vector in
`flex-booking-vectors.json`. It checks `state` and `nextBookableServiceDate` exactly, and
checks `cutoffInstant` and `openInstant` as equal instants. The vector file's per-vector
`timezone` overrides the top-level one.

### 5.2 `bookingResolution.js`

This is a port of iOS `OnDemandBookingResolution.resolve`.

**Per rule:**

- If the pickup booking rule id is non-null and unresolvable, the whole service resolves to
  `unknown`.
- Otherwise the rule's service dates are walked, starting at the agency-local today and
  continuing to the rule's last `endDate` (capped at 400 days):
  - the first `open` date makes the rule **bookable**, keeping that date's evaluation;
  - `notYetOpen` dates record the first open instant seen;
  - `unknown` dates mark the rule as having seen unknown.

**Across rules:**

- The bookable candidate with the earliest travel date wins, with ties going to the earliest
  cutoff:
  - `bookBy(cutoff, travelDate)`, or
  - `noNoticeRequired` when its cutoff is null.
- Otherwise the earliest not-yet-open instant gives `opensAt(instant)`.
- Otherwise `unknown` if any rule saw unknown, else `closed`.
- A service with no rules resolves to `unknown`.

`nextChangeInstant` is the earliest of these that falls after now:

- the bookable cutoffs;
- the not-yet-open instants;
- the next agency-local midnight.

**Rendered booking line:**

| Resolution         | English                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| `bookBy`           | "Book by {deadline} for a ride on {travelDate}"                           |
| `opensAt`          | "Booking opens {instant}"                                                 |
| `noNoticeRequired` | "No advance booking required"                                             |
| `closed`           | "Booking has closed for upcoming service"                                 |
| `unknown`          | "This agency has not published a booking deadline. Contact them to book." |

The **deadline** is rendered as "today 5:00 PM", "tomorrow 5:00 PM" or "yesterday …" when it
is within ±1 day of the agency-local today; otherwise as a medium date and short time. The
**travel date** is weekday plus month and day, e.g. "Wed, Mar 11". Both are formatted in the
agency timezone with the active locale through `Intl.DateTimeFormat`.

### 5.3 `availability.js`

This is a port of DRT UI §2.5 and iOS `OnDemandAvailability`:
`evaluateAvailability(service, now) → {status, tier, bookingTier, nextBookableServiceDate,
nextChangeInstant, resolution, timeZone, today}`. `resolution` is the booking resolution
(§5.2) the booking line is formatted from; `today` is the agency-local date.

**Timezone.** The timezone is `service.agency.timezone`. When it is missing or invalid, the
status is `unknown`, the tier is 5, and there is no `nextChangeInstant`.

**Terms**

- A rule is **active on D** when any of its calendars is active on D.
- The **pickup window** on D is
  `[instant(D, startPickupTime ?? 00:00), instant(D, endPickupTime ?? 24:00))`.
- **`runningNow`**: a rule active on today or yesterday has a window containing now.
- **`runningUntil`**: the latest end among those windows. It is null when that end abuts the
  start of a window on the next active day, so the copy reads "Open".
- **`nextRunStart`**: the earliest window start after now, over rules active from yesterday
  through today + 400.
- **`bookingTier`**: taken from the pickup booking types of rules active on the first date on
  which any rule is active. A null id counts as real-time, and a dangling id is skipped. The
  least demanding type wins: `realTime` < `sameDay` < `advance`.
- **`bookableNow`**: some rule whose window contains now evaluates to `open` for the service
  date that owns that window.

**`status`** is the first match:

1. `bookingTier === advance`:
   - `bookBy(cutoff, travelDate)` when the resolution is `bookBy`;
   - `bookingOpens(instant)` when it is `opensAt`;
   - `closed` when it is `closed`;
   - otherwise `unknown`.
2. `runningNow && bookableNow`: `openNow(runningUntil)`.
3. `nextRunStart` exists: `opensAt(nextRunStart)`. If today's booking cutoff has passed while
   a same-day service is still running, it is `opensAt` the next booking opening instead
   (ruling I4).
4. No rule is active through today + 400: `closed`.
5. Otherwise: `unknown`.

**`tier`** is the first match:

- 1 when the status is `openNow`;
- 5 when the status is `closed` or `unknown`, or when the service-level
  `nextBookableServiceDate` (the minimum over rules) is null;
- 2 when `nextBookableServiceDate` is today;
- otherwise 3.

Tier 4 (eligibility) is never produced in v1.

**Tag**: `bookingTagKey(bookingTier)` gives "No notice needed" for `realTime`, "Same-day
booking" for `sameDay`, or "Advance booking" for `advance`.

**`nextChangeInstant`**: the earliest of `runningUntil`, `nextRunStart`, the resolution's
`nextChangeInstant` and the next agency-local midnight that falls after now.

**Status copy** (`formatStatus`)

| Status           | English                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| `openNow(until)` | "Open now · until {time}" on the detail sheet, "Open · until {time}" on stop-card rows |
| `openNow(null)`  | "Open"                                                                                 |
| `opensAt`        | "Opens {relative day + time}"                                                          |
| `bookingOpens`   | "Booking opens {instant}"                                                              |
| `bookBy`         | "Book by {deadline}"                                                                   |
| `closed`         | "Closed"                                                                               |
| `unknown`        | nothing                                                                                |

### 5.4 Sorting

`sortByAvailability(items, locale)` takes `{service, availability}` pairs, already evaluated
against one `now`, and orders them by tier ascending, then by `service.name` with a
locale-aware numeric `Intl.Collator`. There is no distance term in core, because no probe
point exists until phase 2.

### 5.5 `hours.js`

`hoursRows(service, locale)` → `[{days: 'Mon–Fri', hours: '7:00 AM – 6:00 PM', muted: false}, …]`.

**Building the rows**

1. For each rule, collect the weekday set (the union of its calendars' `days`) and the hours:
   - `null` when both times are null, rendered as "All service hours";
   - otherwise `start – end` as wall-clock times. A time at or past 24:00 is taken mod 24 h
     and gets the suffix " (next day)".
2. Merge rules with identical hours: union their weekday sets, then drop exact duplicate
   rows.
3. Format each weekday set as ranges of consecutive days in Mon…Sun order, using the locale's
   short weekday names, e.g. "Mon–Fri", "Mon, Wed".

**The "No service" row.** Add one muted row with `hours: 'No service'` for weekdays that
appear in no calendar whose `endDate` is today or later, formatted the same way (e.g. "Sun",
"Sat–Sun").

## 6. Strings

A new `ondemand` namespace goes into `src/locales/en.json` only. The other locales fall back
to English, the same way the survey banner strings landed. Keys use snake_case, as in the
existing namespaces:

- `card_title`
- `status_open`, `status_open_until`, `status_open_now_until`, `status_opens`,
  `status_booking_opens`, `status_book_by`, `status_closed`
- `book_by_for_ride`, `no_notice_required`, `booking_closed`, `booking_unknown`
- `tag_no_notice`, `tag_same_day`, `tag_advance`
- `call`, `book_online`, `open_agency_website`, `more_information`
- `where`, `service_area`, `drop_off`, `zone_count`
- `when`, `all_service_hours`, `no_service`, `next_day`
- `how_to_book`
- `not_available`, `load_failed`, `retry`
- `flex_only_empty_arrivals`
- `close`
- `today_at`, `tomorrow_at`, `yesterday_at`

## 7. Testing

The tests follow Wayfinder's conventions: Vitest with jsdom, `vi.fn`/`spyOn` for fetch (not
msw), `createMockMapProvider`, and Testing Library for components.

- **`bookingDeadline`:** all 22 vectors, plus unit cases for `countBack` edges, including the
  400-day cap and an unparseable `startDate`.
- **`bookingResolution` and `availability`:**
  - real-time, same-day and advance fixtures built from the Alexandria, Manistee and
    Charlevoix shapes;
  - I4;
  - an all-hours continuous service ("Open");
  - windows past midnight;
  - a missing timezone;
  - nextChangeInstant.
- **`hours`:** merging Mon–Fri and Sat with equal hours into Mon–Sat; "No service" rows for
  Mon–Sat (Sun) and Mon–Fri (Sat–Sun) calendars; "All service hours"; "(next day)".
- **`colors` and `zoomLevel`:** thresholds and collision assignment.
- **`models`:** unknown enums, missing references, `onDemandServiceIds` default.
- **`serverSupport` and proxies:**
  - the three unsupported shapes, and the 501 while unsupported;
  - re-probing after the 1 h expiry;
  - passthrough;
  - a service 404 that leaves the verdict alone;
  - a 502 on 5xx or network failure;
  - parameter validation;
  - agency filtering.
- **`agencyFilter`:** a flex-only stop is kept when its `onDemandServiceIds` match the filter.
- **Providers:** polygon create, style, remove and clear for OSM, Google and ArcGIS (holes,
  MultiPolygon, halo, interactive click); `clearAllPolylines` leaves polygons alone.
- **`OnDemandZonesLayer`:**
  - the level gates;
  - no fetch when hidden;
  - diffing;
  - clearing on a mode change and on unsupported;
  - discarding stale responses;
  - the highlight.
- **`OnDemandStopCard`:**
  - hidden without ids and on unsupported;
  - drops failures and stays hidden when every fetch fails;
  - no refetch on re-render with the same ids;
  - rows link to the detail sheet;
  - the flex-only empty-arrivals copy.
- **`OnDemandServiceSheet`:**
  - section presence by tier;
  - the Where rules;
  - "More information" hidden when it equals `url`;
  - the not-found copy;
  - the retry path;
  - re-evaluation on the timer.

**Manual check:** run maglev locally with `testdata/charlevoix-flex.zip` and
`testdata/manistee-flex.zip`, and point Wayfinder at it with the OSM provider. Confirm zones
at both levels, the stop card on Ironton Ferry, and the detail sheet. Where keys allow, smoke
test on Google and ArcGIS.

`npm run lint` and `npm run test` must pass, and coverage must stay at or above the 70%
thresholds.

## 8. Delivery

One PR against `develop`. Its commits are grouped in this order, each one scoped and described:

1. data layer;
2. pure logic and vectors;
3. provider polygons;
4. zones layer;
5. stop card;
6. detail sheet and route.

The PR description flags every place where behaviour deliberately differs from iOS or Android:

- the thresholds follow Android;
- the stop card rows show a status line;
- the detail view is a URL-addressable sheet;
- en-only strings;
- the phase-2 items in _Scope_ are deferred.

## 9. Risks

- **Large geometries in the viewport.** Simplified geometry has at most 256 points per ring,
  so a region-level viewport with many services is still small. If a deployment has hundreds
  of services, a later change can add a per-level cap.
- **Leaflet `L.polygon` with `fill: false` halos** doubles the path count per zone. That's
  acceptable at the expected dozens of zones.
- **The 1 h `unsupported` cache** delays detection of a freshly upgraded server by up to an
  hour. A restart clears it.
