# Stop UI Redesign — Arrival/Departure Cards, Section Header, Trip Timeline

**Date:** 2026-07-22
**Branch:** `arrival-departure-cards`

## Goal

Redesign the stop pane's arrivals/departures UI to match the provided mockup:
a route badge, a bold headsign with a colored `time · status` sub-line, a large
compact ETA with a live/schedule icon, and a restyled trip-detail timeline. The
condensed sheet header already matches the mockup and is left unchanged.

## Scope

In scope:

- New reusable `RouteBadge.svelte` component.
- Redesign `ArrivalDeparture.svelte` layout, ETA format, and scheduled-color.
- Add an "ARRIVALS & DEPARTURES" section header in `StopPane.svelte`.
- Restyle `TripDetailsPane.svelte` timeline and heading.

Out of scope (unchanged):

- `StopBottomSheet.svelte` / `StopPageHeader.svelte` headers — the sheet header
  already matches the mockup. (Noted discrepancy: the mockup subtitle shows the
  stop direction "SW bound", which the sheet omits today. Left as-is per the
  scope decision.)
- The accordion chevron and row dividers — already provided by
  `AccordionItem.svelte` / `SingleSelectAccordion.svelte`.
- Data fetching / polling.
- A "Past · N" counter shown at the top-right of the section header in the
  mockup — **deferred** to a separate change.

## Components

### 1. `src/components/RouteBadge.svelte` (new)

A rounded-square colored badge rendering a route short name.

- **Props:** `shortName` (string), `color` (hex string without `#`, optional),
  `textColor` (hex string without `#`, optional).
- **Background:** `#{color}` when present, otherwise a dark slate fallback
  (`#374151`). This yields the red RapidRide C Line and the dark numbered
  routes from the mockup.
- **Text color:** `#{textColor}` when present, otherwise white.
- **Applied via inline `style`, NOT Tailwind arbitrary classes.** Dynamic runtime
  hex values cannot go in `class="bg-[#{color}]"` — Tailwind generates classes at
  build time and would emit no rule, rendering the badge unstyled. Use the same
  pattern as `RouteItem.svelte:29-30`:
  ```svelte
  let bg = $derived(color ? `#${color}` : '#374151'); let fg = $derived(textColor ? `#${textColor}`
  : '#ffffff');
  <div
  	class="flex h-14 w-16 items-center justify-center wrap-break-word rounded-lg text-center font-bold leading-tight"
  	style="background-color: {bg}; color: {fg};"
  >
  	{shortName}
  </div>
  ```
- **Layout:** `rounded-lg`, fixed size (~`w-16 h-14`), centered, bold. `leading-tight`
  - `wrap-break-word` so "C Line" stacks onto two lines and longer `shortName` values
    degrade gracefully instead of overflowing the box.
- **Dark mode:** the badge is a self-colored block with contrasting text, so it
  reads correctly in both light and dark mode without overrides. Raw route colors
  are used as-is (not dark-adjusted like `RouteItem`); rely on the API `textColor`
  for contrast, with the `#374151`/white fallback used only when `color` is absent.

### 2. `src/components/ArrivalDeparture.svelte` (redesign)

New full-width flex row (the accordion renders its chevron immediately after):

```text
[RouteBadge] | headsign (bold) + "time · status" | big ETA + live/clock icon
```

- **Headsign:** bold, `text-gray-900 dark:text-white`.
- **Sub-line:** clock time (e.g. `11:48 AM`) in gray, a `·` separator, then the
  status text in the status color.
- **Big ETA:** compact `{n}m` format (e.g. `19m`) — replaces today's `19 mins`.
  `text-3xl font-bold`, in the status color.
- **Superscript icon** beside the ETA: `faTowerBroadcast` for real-time
  (predicted) arrivals; `faClock` for schedule-only arrivals. Both imported from
  `@fortawesome/free-solid-svg-icons` — `faTowerBroadcast` exists **only** in
  free-solid, so import both from solid for a consistent stroke weight:
  `import { faTowerBroadcast, faClock } from '@fortawesome/free-solid-svg-icons';`

**Status color rule (`computeColor`):**

- Not predicted (scheduled) → **gray**, `text-gray-500 dark:text-gray-400`,
  changed from today's blue, so scheduled rows read fully muted per the mockup.
  (Must NOT use `text-gray-400` in light mode — ~2.9:1 on white fails WCAG AA;
  `gray-500` ≈ 4.8:1 passes, and `gray-400` passes on the dark `gray-800`
  surface, mirroring the existing 600/400 pairing documented at
  `ArrivalDeparture.svelte:18-21`.)
- Predicted, late (`delay > 0`) → violet (`text-violet-600 dark:text-violet-400`).
- Predicted, early (`delay < -1`) → red (`text-red-600 dark:text-red-400`).
- Predicted, on time → green (`text-green-600 dark:text-green-400`).

All existing logic — `computeStatusLabel`, frequency handling, canceled trips,
arrival-vs-departure selection, i18n strings — is preserved. Only presentation,
the scheduled color, and the compact ETA change.

**Compact ETA format:** a new label form producing `{n}m`. The `m` unit must be
localizable — add an i18n key (e.g. `time.min_compact: "{n}m"`) and interpolate,
rather than string-concatenating a literal `m`. Keep the `now` / `1m` / negative
branches routing through i18n as today (`time.now`, etc.).

### 3. `src/components/stops/StopPane.svelte`

- Build a `routeId → route` lookup from
  `arrivalsAndDeparturesResponse.data.references.routes` as a **`$derived`** value
  (`let routeById = $derived(new Map(...))`), NOT written into `$state` from an
  `$effect` — that Svelte 5 anti-pattern would go stale against the 30s poll.
  Pass the matched route's `color` and `textColor` into each `ArrivalDeparture`
  (the arrival object itself carries no color).
- Add an **"ARRIVALS & DEPARTURES"** section header above the accordion:
  uppercase, letter-spaced, semibold, muted gray. Reuse the existing
  `arrivals_and_departures` i18n key (`en.json:127`) and apply
  `uppercase tracking-wide` in markup — do not duplicate an all-caps string. No
  "Past · N" counter (deferred).

### 4. `src/components/oba/TripDetailsPane.svelte`

- Heading becomes **"Live · vehicle {vehicleId}"** with a `faTowerBroadcast` icon
  when a real-time vehicle is present (`tripDetails.status.vehicleId`); otherwise
  a schedule-oriented fallback heading. Add a new interpolated i18n key under the
  existing `vehicle.*` namespace (`en.json:148-154`) — do not hardcode the string.
- Timeline markers restyled to the mockup:
  - intermediate stop → empty ring circle,
  - vehicle current position → filled dark rounded-square with bus icon,
  - your stop → filled location pin, row text bold.
- Stop times remain right-aligned and gray.

## Data Flow

`StopPane.loadData()` already stores the full response
(`arrivalsAndDeparturesResponse`). Route colors come from
`data.references.routes[]` (fields `id`, `color`, `textColor`), joined to each
arrival by `routeId`. No API or fetch changes.

## Testing

- **`RouteBadge`:** renders short name; uses `#{color}` background when present;
  dark slate fallback when absent; `#{textColor}` vs white text.
- **`ArrivalDeparture`:** updated for new markup, compact `{n}m` ETA, and the
  scheduled→gray color change (fix the existing blue assertion); real-time icon
  vs clock icon; status color per delay.
- **`StopPane`:** section-header label renders; route color is passed to the
  badge.
- **`TripDetailsPane`:** "Live · vehicle {id}" heading appears when a vehicle is
  present; timeline markers render for the three states.

## i18n keys

- **Reuse:** `arrivals_and_departures` (`en.json:127`) for the section header.
- **Add:** `time.min_compact` = `"{n}m"` for the compact ETA.
- **Add:** a new interpolated key under `vehicle.*` for "Live · vehicle {id}".
- New keys go into `src/locales/en.json` (the synchronous fallback locale);
  other locales fall back to English until translated.

## Risks / Notes

- Changing the scheduled color from blue to gray and the ETA from `19 mins` to
  `19m` will break existing `ArrivalDeparture` test assertions; those tests are
  updated as part of this work.
- Contrast: scheduled gray uses `text-gray-500 dark:text-gray-400` (WCAG AA
  safe); `text-gray-400` must not be used in light mode.
- `StopPane` couples fetching, hero card, surveys, and alerts in one file. This
  change adds only the route-color map and the section header; no broader
  refactor is undertaken.
