# iOS-style collapsed stop list in TripDetailsPane

Date: 2026-07-22

## Problem

When a vehicle is several stops away from the rider's selected stop, the trip
details pane (`src/components/oba/TripDetailsPane.svelte`) renders every stop
between the vehicle and the rider stop as a uniform vertical list of circles on
a straight rail. Long lists dominate the pane and bury the information the rider
actually cares about: where the bus is now, and the last stops before theirs.

The iOS app solves this by collapsing the middle of the list into a single
zig-zag connector labelled "N stops", showing only the vehicle's current stop,
the last few stops before the rider's stop, and the rider's stop itself.

## Goal

Replicate the iOS experience in Wayfinder:

- Vehicle's current stop at top, with the bus icon (unchanged).
- A **static** zig-zag segment collapsing the hidden middle stops, with an
  **"N stops"** legend (N = number of collapsed stops).
- The last **3** stops before the rider's stop, each a normal circle.
- The rider's stop, bold, with the filled location marker (unchanged).

Static, not interactive — matches iOS.

## Design

### Collapse logic (pure, unit-tested)

New function in `src/lib/tripDetailsUtils.js`:

```js
buildStopSegments(stopTimes, busPosition, riderStopId, (tailCount = 3));
```

Returns an ordered array of render items, built on top of the existing
`computeVisibleStopRange` so the "hide already-passed / hide beyond-rider"
logic stays in one place:

```js
[
  { type: 'stop', index },        // render as a normal stop row
  { type: 'collapsed', count },   // render as a zig-zag with an "N stops" legend
  ...
]
```

Rules, given `range = computeVisibleStopRange(...)` with inclusive
`{ start, end }`:

- `end < start` (empty range) → `[]`.
- `intermediate = end - start - 1` (stops strictly between head and rider).
- If `intermediate <= tailCount`: no collapse — every index `start..end` is a
  `stop` item (identical to today's output for short trips).
- If `intermediate > tailCount`: emit
  - head: `{ type: 'stop', index: start }`
  - `{ type: 'collapsed', count: intermediate - tailCount }`
  - tail: indices `end - tailCount .. end` as `stop` items (the last
    `tailCount` intermediate stops plus the rider stop).

Threshold: the zig-zag appears only when the vehicle is more than
`tailCount + 1` indices from the rider stop (for `tailCount = 3`, ≥ 5 indices).

Edge cases covered by tests: empty/short ranges, `start === end` (single stop),
unknown vehicle position (`busPosition < 0`, scheduled trip — no bus icon, but
long lists still collapse), and the rider stop missing from `stopTimes`.

### Template

`TripDetailsPane.svelte` iterates over the segment list instead of filtering
`stopTimes` by an index range. `stop` items reuse the existing row markup (bus
icon / rider marker / circle, keyed off `index === busPosition` and
`stopId === stop.id`, plus the arrival time — Wayfinder shows times, iOS does
not). `collapsed` items render a self-contained SVG zig-zag in the left rail
plus the legend.

The continuous rail line and its masking pattern are unchanged: the existing
circle dots already mask the absolute rail line with `bg-white
dark:bg-neutral-800`; the zig-zag cell uses the same opaque background so the
straight rail reads as flowing into and out of the zig-zag.

### i18n

New key `trip_details.collapsed_stops` in `src/locales/en.json`, pluralized via
svelte-i18n's ICU MessageFormat:

```json
"collapsed_stops": "{count, plural, one {# stop} other {# stops}}"
```

English is the synchronous fallback; other locales inherit it until translated.

## Testing

- `tripDetailsUtils.test.js`: unit tests for `buildStopSegments` — collapse
  counts, the no-collapse threshold, single-stop and empty ranges, unknown
  vehicle position.
- `TripDetailsPane.test.js`: assert the zig-zag legend appears with the correct
  count for a long trip and is absent for a short one.

## Out of scope

- Tap-to-expand interaction (iOS is static; deferred).
- Changing which stops count as "passed" / vehicle-position resolution
  (`resolveVehicleStopIndex` / `computeVisibleStopRange` are unchanged).
