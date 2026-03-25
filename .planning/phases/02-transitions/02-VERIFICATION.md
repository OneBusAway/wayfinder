---
phase: 02-transitions
verified: 2026-03-25T20:41:00Z
status: human_needed
score: 4/4 must-haves verified (automated checks pass; visual behavior needs human)
human_verification:
  - test: "Observe fade-out on poll refresh"
    expected: "A bus that departs (exits the list) fades out over roughly 200ms rather than disappearing instantly"
    why_human: "CSS opacity transitions cannot be confirmed programmatically without a running browser and live polling cycle"
  - test: "Observe fade-in on poll refresh"
    expected: "A new bus appearing in the list fades in over roughly 300ms rather than snapping to full opacity"
    why_human: "Same as above — requires live browser and at least one 30-second poll cycle"
  - test: "Persistent buses do not animate"
    expected: "Buses present in both the previous and the current poll response show no opacity change between polls"
    why_human: "Requires watching the list across two consecutive poll cycles in a browser"
  - test: "New-stop navigation fades all items in"
    expected: "Navigating to a different stop causes all arrivals at the new stop to fade in (the {#key stopId} block re-mounts everything)"
    why_human: "Requires manual navigation between two stops in the browser"
---

# Phase 02: Transitions Verification Report

**Phase Goal:** List changes are visually smooth — riders see departures fade away and new arrivals materialize rather than the list snapping to a new state
**Verified:** 2026-03-25T20:41:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A bus leaving the list fades out over 200ms before its row is removed from the DOM | VERIFIED (automated) | `out:fade={{ duration: 200 }}` at StopPane.svelte line 252 |
| 2 | A bus appearing for the first time fades in over 300ms rather than appearing instantly | VERIFIED (automated) | `in:fade={{ duration: 300 }}` at StopPane.svelte line 252 |
| 3 | Buses present in both previous and current poll do not animate at all | VERIFIED (mechanistic) | Svelte's keyed `{#each}` with `(makeKey(arrival))` only triggers in/out transitions for keys that enter or leave the rendered set; stable keys get no transition |
| 4 | Build succeeds and all existing tests pass — no regressions | VERIFIED (automated) | Build: ✓ (8.46s, no errors); Tests: ✓ (1175/1175 passing across 53 test files) |

**Score:** 4/4 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/stops/StopPane.svelte` | Fade transitions on arrival list items | VERIFIED | File exists, contains `fade` import, `in:fade`/`out:fade` directives on the wrapper div around each AccordionItem |

**Level 1 — Exists:** Yes (confirmed by Read)
**Level 2 — Substantive:** Yes — 274 lines; full component with real data-fetching, diffing integration, and transition directives. No placeholder content.
**Level 3 — Wired:** Yes — `fade` imported from `svelte/transition` and applied via directives on DOM elements. `diffArrivals`/`makeKey` from `arrivalDiffing.js` called in the fetch handler and in the template respectively.
**Level 4 — Data Flowing:** Yes — `loadData()` fetches from `/api/oba/arrivals-and-departures-for-stop/${stopID}`, passes result through `diffArrivals(previousArrivals, rawArrivals, Date.now())`, and assigns to `arrivalsAndDepartures`. No static/empty return paths.

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/components/stops/StopPane.svelte` | `svelte/transition` | `import { fade }` | WIRED | Line 20: `import { fade } from 'svelte/transition';` |
| `src/components/stops/StopPane.svelte` | keyed `{#each}` block | `in:fade` and `out:fade` directives on wrapper `<div>` | WIRED | Line 252: `<div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }}>` inside `{#each ... (makeKey(arrival))}` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `StopPane.svelte` | `arrivalsAndDepartures` | `/api/oba/arrivals-and-departures-for-stop/${stopID}` → `diffArrivals()` | Yes — live OBA API response filtered and tagged | FLOWING |

The data pipeline is intact end-to-end:
1. `loadData(stopID)` fetches from the OBA API proxy
2. Response is passed to `diffArrivals(previousArrivals, rawArrivals, Date.now())` from `$lib/arrivalDiffing.js`
3. Result is assigned to `arrivalsAndDepartures.arrivalsAndDepartures`
4. Template iterates over this array with `(makeKey(arrival))` key expressions
5. Each item is wrapped in `<div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }}>`

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build produces no errors | `npm run build` | "built in 8.46s" — exit 0 | PASS |
| All 1175 tests pass | `npx vitest run` | "Test Files 53 passed (53), Tests 1175 passed (1175)" | PASS |
| fade import present | `grep "import.*fade.*from.*svelte/transition" StopPane.svelte` | Match at line 20 | PASS |
| in:fade directive present with 300ms | `grep "in:fade.*300"` | Match at line 252 | PASS |
| out:fade directive present with 200ms | `grep "out:fade.*200"` | Match at line 252 | PASS |
| Keyed each with makeKey | `grep "#each.*makeKey"` | Match at line 251 | PASS |
| Visual fade behavior in browser | Requires live browser + polling cycle | Cannot run headlessly | SKIP — human needed |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TRAN-01 | 02-01-PLAN.md | Departures fade out (200ms opacity transition) when removed from the list | SATISFIED | `out:fade={{ duration: 200 }}` on wrapper div at line 252 of StopPane.svelte |
| TRAN-02 | 02-01-PLAN.md | New arrivals fade in (300ms opacity transition) when appearing in the list | SATISFIED | `in:fade={{ duration: 300 }}` on wrapper div at line 252 of StopPane.svelte |

Both requirements declared in the plan frontmatter are present in REQUIREMENTS.md under the "Transitions" section and are fully satisfied by the implementation.

**Orphaned requirements check:** REQUIREMENTS.md maps TRAN-01 and TRAN-02 to Phase 2. Both are claimed by 02-01-PLAN.md. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

No TODOs, FIXMEs, empty returns, placeholder text, or disconnected props were found in `StopPane.svelte`.

---

### Human Verification Required

#### 1. Fade-out on poll refresh

**Test:** Run `npm run dev`, open the app, navigate to a stop with active arrivals. Wait for a bus to depart (ETA reaches 0) across a 30-second poll cycle.
**Expected:** The departing bus's row fades to opacity 0 over approximately 200ms before disappearing from the DOM.
**Why human:** CSS opacity transitions cannot be observed programmatically without a running browser and a live polling cycle.

#### 2. Fade-in on poll refresh

**Test:** Same session. Wait for a new bus to appear in the list on a poll refresh.
**Expected:** The new row starts at opacity 0 and fades in to full opacity over approximately 300ms.
**Why human:** Same as above — requires live browser observation.

#### 3. Persistent buses do not animate

**Test:** Watch a bus that remains in the list across two consecutive polls.
**Expected:** No opacity flicker or animation on rows whose key (`tripId_serviceDate`) is present in both the previous and current poll.
**Why human:** Requires observing two full 30-second cycles with the browser DevTools Network tab to confirm the poll fired.

#### 4. New-stop navigation fades all items in

**Test:** While viewing one stop, click through to a different stop.
**Expected:** All arrival rows at the new stop fade in on initial render (because the `{#key arrivalsAndDepartures.stopId}` block re-mounts the accordion entirely).
**Why human:** Requires manual navigation in the browser.

---

### Gaps Summary

No gaps. All four automated must-have truths are verified:

- The `fade` import is present and correctly sourced from `svelte/transition`.
- The `in:fade={{ duration: 300 }}` and `out:fade={{ duration: 200 }}` directives are applied to a native DOM `<div>` wrapper (required by Svelte — transitions cannot live on component tags).
- The `{#each}` block uses `(makeKey(arrival))` as the key expression, which ensures Svelte correctly identifies entering and leaving items and triggers only enter/exit transitions — persistent items get none.
- Build is clean, all 1175 tests pass.

The only outstanding item is visual confirmation in a live browser, which is inherent to any CSS transition feature and cannot be automated without a headless browser test harness.

---

_Verified: 2026-03-25T20:41:00Z_
_Verifier: Claude (gsd-verifier)_
