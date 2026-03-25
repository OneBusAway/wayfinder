# Roadmap: Wayfinder Dynamic Arrival Updates

## Overview

Two phases deliver the complete feature. Phase 1 builds the diffing logic — filtering departed buses and identifying new arrivals by stable key — plus the unit tests that verify it. Phase 2 wires in Svelte transitions so departures fade out and new arrivals fade in. Phase 2 depends on Phase 1 because transitions target the new/removed sets produced by diffing.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Diffing & Filtering** - Arrivals are filtered and diffed by stable key; logic is unit-tested
- [ ] **Phase 2: Transitions** - Departures fade out and new arrivals fade in during each poll refresh

## Phase Details

### Phase 1: Diffing & Filtering
**Goal**: Arrivals list is always accurate — departed buses are removed on every poll and each row has a stable identity across refreshes
**Depends on**: Nothing (first phase)
**Requirements**: DIFF-01, DIFF-02, DIFF-03, TEST-01
**Success Criteria** (what must be TRUE):
  1. A bus with ETA < 0 disappears from the arrivals list after the next 30-second poll
  2. Rows do not jump or reorder between polls when the same bus is present in consecutive refreshes
  3. Arrivals that were not present in the previous poll are tagged as new (verifiable via test or DOM attribute)
  4. Unit tests pass for: filter departed, tag new, stable key derivation, empty list edge case
**Plans:** 1/2 plans executed
Plans:
- [x] 01-01-PLAN.md — TDD: Create arrivalDiffing utility (filterDeparted, makeKey, diffArrivals) with unit tests
- [ ] 01-02-PLAN.md — Wire diffArrivals into StopPane.svelte polling cycle

### Phase 2: Transitions
**Goal**: List changes are visually smooth — riders see departures fade away and new arrivals materialize rather than the list snapping to a new state
**Depends on**: Phase 1
**Requirements**: TRAN-01, TRAN-02
**Success Criteria** (what must be TRUE):
  1. A bus leaving the list fades out over ~200ms before its row is removed from the DOM
  2. A bus appearing for the first time fades in over ~300ms rather than appearing instantly
  3. Buses that were present in both the previous and current poll do not animate at all
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Diffing & Filtering | 1/2 | In Progress|  |
| 2. Transitions | 0/? | Not started | - |
