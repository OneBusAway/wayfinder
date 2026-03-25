---
phase: 01-diffing-filtering
plan: 02
subsystem: component
tags: [svelte5, stoppane, arrival-diffing, polling, keyed-each]

# Dependency graph
requires:
  - "src/lib/arrivalDiffing.js (makeKey, diffArrivals from plan 01-01)"
provides:
  - "StopPane.svelte wired with diffArrivals: departed buses filtered on every 30s poll"
  - "previousArrivals state tracking across polls, reset on stop change"
  - "Stable {#each} keying via makeKey(arrival) — no row jumps between polls"
  - "data-new attribute on AccordionItem for Phase 2 animation targeting"
affects:
  - 02-transitions (will consume _isNew flag and data-new attribute for fade animations)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "diffArrivals integration pattern: raw arrivals stored as previousArrivals, diffed result stored as arrivalsAndDepartures"
    - "Svelte 5 keyed {#each} pattern: (makeKey(arrival)) for stable DOM reconciliation"
    - "Stop-change reset pattern: previousArrivals = null before resetDataFetchInterval"

key-files:
  created: []
  modified:
    - src/components/stops/StopPane.svelte

key-decisions:
  - "previousArrivals stores raw (unfiltered) arrivals so diff sees the complete prior poll for accurate _isNew tagging"
  - "arrivalsAndDepartures rebuilt via spread { ...entry, arrivalsAndDepartures: diffed } — avoids mutating API response"
  - "data-new attribute passed to AccordionItem — silently ignored if AccordionItem doesn't spread attrs, which is acceptable"

requirements-completed:
  - DIFF-01
  - DIFF-02
  - DIFF-03

# Metrics
duration: ~2min
completed: 2026-03-25
---

# Phase 01 Plan 02: StopPane diffArrivals Integration Summary

**`StopPane.svelte` wired to call `diffArrivals()` on every 30-second poll, filtering departed buses (ETA < 0), tagging new arrivals with `_isNew`, and providing stable keyed `{#each}` rendering via `makeKey(arrival)`**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-25T12:06:36Z
- **Completed:** 2026-03-25T12:08:21Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `import { diffArrivals, makeKey } from '$lib/arrivalDiffing'` to StopPane.svelte
- Added `let previousArrivals = $state(null)` for cross-poll tracking
- Replaced direct `arrivalsAndDepartures = data.data.entry` assignment with diffing pipeline: extract raw arrivals, call `diffArrivals(previousArrivals, rawArrivals, Date.now())`, store raw as `previousArrivals`, rebuild entry with diffed results
- Added `previousArrivals = null` reset in the stop-change `$effect` so navigation to a new stop correctly tags all arrivals as `_isNew`
- Changed `{#each arrivalsAndDepartures.arrivalsAndDepartures as arrival}` to `{#each ... as arrival (makeKey(arrival))}` for stable DOM reconciliation
- Added `data-new={arrival._isNew}` to `AccordionItem` for Phase 2 animation targeting
- All 1175 tests pass, build succeeds

## Task Commits

1. **Task 1: Integrate diffArrivals into StopPane polling cycle** - `a40c0df` (feat)

## Files Created/Modified

- `src/components/stops/StopPane.svelte` — 10 lines added, 3 replaced: import, state, loadData diffing pipeline, effect reset, keyed {#each}

## Decisions Made

- `previousArrivals` stores the raw (unfiltered) arrivals from the API response — not the diffed result — so that the next poll's `diffArrivals` call can accurately compare against the full prior set (including entries that may have just been filtered out)
- Entry object rebuilt via spread `{ ...entry, arrivalsAndDepartures: diffed }` so all other entry properties (stopId, etc.) flow through unchanged to the rest of the component
- `data-new` attribute on AccordionItem is a convenience for debugging and Phase 2 — silently ignored if the component doesn't spread unknown attributes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all data flows from the live API through diffArrivals to the rendered list.

## User Setup Required

None.

## Next Phase Readiness

- Phase 01 is complete: diffing utility (plan 01-01) + StopPane integration (plan 01-02) are both done
- `_isNew` flag is produced correctly and carried on every arrival object in the rendered list
- `data-new` attribute is set on each AccordionItem row — Phase 2 CSS transitions can target `[data-new="true"]`
- Phase 2 (transitions) can begin immediately

---
*Phase: 01-diffing-filtering*
*Completed: 2026-03-25*
