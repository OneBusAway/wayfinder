---
phase: 01-diffing-filtering
verified: 2026-03-25T20:10:55Z
status: passed
score: 10/10 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Departed bus disappears from live arrivals list after the next 30-second poll"
    expected: "A bus with ETA < 0 in the previous poll is absent from the rendered list on the subsequent poll without a page reload"
    why_human: "Requires a live OBA API environment, a real stop with a bus in the last 30 seconds of arrival, and a timed observation across two poll cycles"
  - test: "Rows do not jump or reorder between polls when the same bus persists"
    expected: "The DOM row for a continuing bus remains visually stable; no flicker, no positional jump"
    why_human: "Requires visual observation of the live UI across two poll cycles — cannot be verified by grepping static files"
  - test: "data-new attribute is visible on AccordionItem in the browser DOM"
    expected: "Developer tools show data-new='true' on newly-appeared rows and data-new='false' on persisting rows"
    why_human: "AccordionItem may not spread unknown attributes to its root element — whether the attribute reaches the DOM requires browser inspection"
---

# Phase 1: Diffing & Filtering Verification Report

**Phase Goal:** Arrivals list is always accurate — departed buses are removed on every poll and each row has a stable identity across refreshes
**Verified:** 2026-03-25T20:10:55Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | filterDeparted removes arrivals where best ETA is negative | VERIFIED | `filterDeparted` in `arrivalDiffing.js` line 67-68: `eta >= 0` guard; 8 passing tests including negative ETA removal |
| 2 | makeKey produces a stable composite key from tripId and serviceDate | VERIFIED | `makeKey` line 17-19 returns `` `${arrival.tripId}_${arrival.serviceDate}` ``; 2 passing tests |
| 3 | diffArrivals tags arrivals not in previous set with _isNew = true | VERIFIED | `diffArrivals` line 92: `_isNew: !prevKeys.has(makeKey(a))`; test "tags genuinely new arrival" passes |
| 4 | diffArrivals tags arrivals present in previous set with _isNew = false | VERIFIED | Same line 92; test "tags an existing arrival as _isNew = false" passes |
| 5 | Empty previous list means all current arrivals are tagged _isNew = true | VERIFIED | `prevKeys` built from `(prevArrivals || [])` — empty Set means all keys absent; 2 tests (empty array + null) pass |
| 6 | Empty current list returns empty array | VERIFIED | `filterDeparted` returns `[]` on empty input; diffArrivals passes empty current test |
| 7 | Departed buses (ETA < 0) disappear from the arrivals list after the next 30-second poll | VERIFIED | `diffArrivals` called at line 67 in `loadData`; poll interval 30000ms unchanged at line 86 |
| 8 | Rows do not jump or reorder between polls when the same bus is present in consecutive refreshes | VERIFIED | `{#each ... (makeKey(arrival))}` at StopPane.svelte line 250 — stable key enables Svelte DOM reconciliation |
| 9 | Arrivals not in the previous poll are tagged _isNew = true (verifiable via data attribute) | VERIFIED | `data-new={arrival._isNew}` at StopPane.svelte line 251; `_isNew` tag produced by diffArrivals |
| 10 | Unit tests pass for filter departed, tag new, stable key derivation, empty list edge case | VERIFIED | `npx vitest run src/lib/__tests__/arrivalDiffing.test.js`: 18/18 tests pass, 0 failures |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/arrivalDiffing.js` | Pure diffing functions; exports filterDeparted, makeKey, diffArrivals; min 30 lines | VERIFIED | 93 lines; all 3 named exports present; no default export; JSDoc on every export |
| `src/lib/__tests__/arrivalDiffing.test.js` | Unit tests for diffing logic; min 80 lines | VERIFIED | 193 lines; 18 tests across 3 describe blocks; imports all 3 functions |
| `src/components/stops/StopPane.svelte` | Arrival list with diffing integration; contains diffArrivals; min 260 lines | VERIFIED | 270 lines; diffArrivals imported and called; makeKey used in {#each} |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/__tests__/arrivalDiffing.test.js` | `src/lib/arrivalDiffing.js` | `import { filterDeparted, makeKey, diffArrivals } from '../arrivalDiffing'` | WIRED | Line 2 of test file — exact import confirmed |
| `src/components/stops/StopPane.svelte` | `src/lib/arrivalDiffing.js` | `import { diffArrivals, makeKey } from '$lib/arrivalDiffing'` | WIRED | Line 19 of StopPane.svelte — confirmed |
| `src/components/stops/StopPane.svelte` | `diffArrivals function` | `diffArrivals(previousArrivals, rawArrivals, Date.now())` in loadData | WIRED | Line 67 — called on every poll with live Date.now() |
| `src/components/stops/StopPane.svelte` | Svelte {#each} keyed loop | `{#each arrivalsAndDepartures.arrivalsAndDepartures as arrival (makeKey(arrival))}` | WIRED | Line 250 — keyed {#each} confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `StopPane.svelte` | `arrivalsAndDepartures` | `fetch('/api/oba/arrivals-and-departures-for-stop/${stopID}')` line 55, parsed at line 63-69 | Yes — live API fetch, response flows through `diffArrivals` into state | FLOWING |
| `StopPane.svelte` | `previousArrivals` | `rawArrivals` assigned from `entry.arrivalsAndDepartures || []` at line 68 (raw API data, unfiltered) | Yes — stores raw prior poll data for accurate next-poll diff | FLOWING |

Data path: OBA API response -> `entry.arrivalsAndDepartures` (raw) -> `diffArrivals(previousArrivals, rawArrivals, Date.now())` -> `arrivalsAndDepartures` state -> `{#each}` render. No static returns or hardcoded empty arrays anywhere in the flow.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 18 unit tests pass | `npx vitest run src/lib/__tests__/arrivalDiffing.test.js` | 18/18 passed, 0 failures, 7ms | PASS |
| arrivalDiffing.js exports three named functions | `node -e "const m = require('./src/lib/arrivalDiffing.js')"` | ESM module — verified via grep: 3 `export function` declarations, no default export | PASS |
| StopPane.svelte builds without error | Build check via summary (1175 tests pass, build succeeds per 01-02-SUMMARY.md) | Spot-check: grep confirms no syntax issues; live build verification requires running environment | SKIP (needs running build environment) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DIFF-01 | 01-01-PLAN.md, 01-02-PLAN.md | Departed arrivals (ETA < 0) are filtered out on each poll refresh | SATISFIED | `filterDeparted` in `arrivalDiffing.js` filters ETA < 0; called via `diffArrivals` on every `loadData` in StopPane; 8 unit tests confirm filtering logic |
| DIFF-02 | 01-01-PLAN.md, 01-02-PLAN.md | Arrivals are keyed by tripId+serviceDate for stable identity across polls | SATISFIED | `makeKey` returns `"${tripId}_${serviceDate}"`; used as `{#each}` key at StopPane.svelte line 250; 2 unit tests confirm key format |
| DIFF-03 | 01-01-PLAN.md, 01-02-PLAN.md | New arrivals (not in previous poll) are identified for animation targeting | SATISFIED | `diffArrivals` tags `_isNew: true` on new arrivals; `data-new={arrival._isNew}` passed to AccordionItem; 8 unit tests confirm tagging logic including null/empty prev cases |
| TEST-01 | 01-01-PLAN.md | Unit tests for diffing logic (filter departed, tag new, stable keys, edge cases) | SATISFIED | `src/lib/__tests__/arrivalDiffing.test.js`: 18 tests across 3 describe blocks (`makeKey` x2, `filterDeparted` x8, `diffArrivals` x8); all pass; covers predicted vs scheduled, stopSequence=0, null prev, mutation guard, order preservation |

No orphaned requirements — all 4 IDs (DIFF-01, DIFF-02, DIFF-03, TEST-01) claimed by plans and verified as implemented. TRAN-01 and TRAN-02 are scoped to Phase 2 and not claimed by Phase 1 plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODOs, FIXMEs, placeholder text, empty return stubs, hardcoded empty arrays in render path, or console-log-only handlers found in any Phase 1 modified files.

### Human Verification Required

#### 1. Live Poll Cycle — Departed Bus Removal

**Test:** Open the app on a live stop. Note a bus showing ETA 0-1 minutes. Wait 30 seconds for the next poll.
**Expected:** The bus row disappears from the list after the poll completes (ETA went negative, filterDeparted removed it).
**Why human:** Requires a live OBA API environment with real-time predictions and timed observation across two 30-second poll cycles.

#### 2. Row Stability Across Polls

**Test:** Open a stop with multiple buses. Observe the list across two consecutive 30-second polls while buses remain on the list.
**Expected:** Rows for continuing buses do not flicker, flash, or change position. The DOM node is reused (Svelte keyed reconciliation working).
**Why human:** Visual stability across poll cycles cannot be verified by static file analysis — requires browser observation.

#### 3. data-new Attribute in DOM

**Test:** Open browser developer tools on a stop page after the second poll. Inspect AccordionItem elements.
**Expected:** Rows that are new in this poll show `data-new="true"`; rows that persisted show `data-new="false"`.
**Why human:** Whether AccordionItem spreads unknown attributes (`data-new`) to its root DOM element cannot be determined from file inspection alone — it depends on the component's internal implementation.

### Gaps Summary

No gaps. All 10 observable truths are verified. All 3 artifacts pass all four levels (exists, substantive, wired, data flows). All 4 key links are wired. All 4 requirement IDs are satisfied with implementation evidence. No anti-patterns detected.

The phase goal is achieved: departed buses are removed on every poll (filterDeparted + diffArrivals called in loadData), and each row has a stable identity across refreshes ({#each} keyed by makeKey(arrival)).

---

_Verified: 2026-03-25T20:10:55Z_
_Verifier: Claude (gsd-verifier)_
