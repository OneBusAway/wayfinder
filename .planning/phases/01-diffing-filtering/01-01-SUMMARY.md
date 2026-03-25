---
phase: 01-diffing-filtering
plan: 01
subsystem: testing
tags: [vitest, pure-functions, arrival-diffing, tdd, transit]

# Dependency graph
requires: []
provides:
  - "Pure filterDeparted function: removes arrivals with ETA < 0 from any poll response"
  - "Pure makeKey function: stable tripId_serviceDate composite key for diffing"
  - "Pure diffArrivals function: filters departed and tags _isNew on each arrival"
  - "18 unit tests covering all three functions including edge cases"
affects:
  - 01-02 (StopPane integration will import filterDeparted, makeKey, diffArrivals)
  - 02-transitions (animation phase uses _isNew tag produced by diffArrivals)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure utility module pattern: no Svelte imports, no DOM dependencies — safe everywhere"
    - "TDD RED→GREEN flow: tests written first against spec, module created to pass them"
    - "makeArrival factory function in tests for concise, readable fixture creation"

key-files:
  created:
    - src/lib/arrivalDiffing.js
    - src/lib/__tests__/arrivalDiffing.test.js
  modified: []

key-decisions:
  - "ETA threshold = 0: arrivals at exactly ETA=0 (arriving now) are KEPT, only ETA < 0 are filtered"
  - "stopSequence === 0 uses departure times (predictedDepartureTime / scheduledDepartureTime) instead of arrival times, matching ArrivalDeparture.svelte logic"
  - "diffArrivals spreads each arrival object ({ ...a, _isNew }) to avoid mutating the input arrays"
  - "No default export — all three functions are named exports for explicit import"

patterns-established:
  - "arrivalDiffing pattern: import { filterDeparted, makeKey, diffArrivals } from '$lib/arrivalDiffing'"
  - "MS_IN_MINS = 60000 constant matches the constant used in ArrivalDeparture.svelte"

requirements-completed:
  - DIFF-01
  - DIFF-02
  - DIFF-03
  - TEST-01

# Metrics
duration: 1min
completed: 2026-03-25
---

# Phase 01 Plan 01: Arrival Diffing Utility Summary

**Pure `filterDeparted`, `makeKey`, and `diffArrivals` functions in `src/lib/arrivalDiffing.js` with 18 passing Vitest unit tests, implementing stable tripId+serviceDate identity and ETA-based departure filtering**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-25T12:03:05Z
- **Completed:** 2026-03-25T12:04:34Z
- **Tasks:** 2 (RED + GREEN, no REFACTOR needed)
- **Files modified:** 2

## Accomplishments

- Created `src/lib/arrivalDiffing.js` with three named exports: `filterDeparted`, `makeKey`, `diffArrivals`
- Created `src/lib/__tests__/arrivalDiffing.test.js` with 18 tests across 3 describe blocks
- All 18 tests pass: `filterDeparted` (8), `makeKey` (2), `diffArrivals` (8)
- Implementation handles all edge cases: predicted vs scheduled time selection, stopSequence=0 departure logic, null prev list, empty arrays, no mutation of inputs

## Task Commits

Each task was committed atomically:

1. **Task 1: RED - Write failing tests for arrivalDiffing** - `f59634f` (test)
2. **Task 2: GREEN - Implement arrivalDiffing to pass all tests** - `d6c560d` (feat)

_TDD plan: RED commit (tests only, module missing) then GREEN commit (implementation, all pass). No REFACTOR commit needed — implementation was clean on first pass._

## Files Created/Modified

- `src/lib/arrivalDiffing.js` - Three pure functions: `makeKey`, `filterDeparted`, `diffArrivals` with JSDoc
- `src/lib/__tests__/arrivalDiffing.test.js` - 18 Vitest unit tests using a `makeArrival` factory helper

## Decisions Made

- ETA threshold is 0: `eta >= 0` keeps arrivals (ETA=0 means "arriving now" — keep it visible)
- `stopSequence === 0` signals first stop in trip; departure times used to match `ArrivalDeparture.svelte` behavior
- Spread operator `{ ...a, _isNew }` ensures no mutation of input objects — inputs remain pristine across calls
- No default export — only named exports to keep imports explicit and tree-shakeable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/lib/arrivalDiffing.js` is ready for import into `StopPane.svelte` (Plan 01-02)
- All three exported functions are stable and tested — no breaking changes expected
- `_isNew` tag produced by `diffArrivals` is the contract Phase 2 transitions will rely on

---
*Phase: 01-diffing-filtering*
*Completed: 2026-03-25*
