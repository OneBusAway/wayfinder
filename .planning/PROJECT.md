# Wayfinder — Dynamic Arrival Updates

## What This Is

Wayfinder is the next-generation OneBusAway web application (SvelteKit 5) providing real-time transit information. This milestone focuses on making the arrivals list dynamic — departed buses are removed and new arrivals animate in smoothly during the 30-second polling cycle.

## Core Value

Riders see an accurate, always-current arrivals list without stale departed buses cluttering the view.

## Current Milestone: v1.0 Dynamic Arrival Updates

**Goal:** Arrivals auto-refresh with diffing — departed buses are removed instantly, new arrivals fade in smoothly

**Target features:**
- Filter departed arrivals (ETA < 0) on each poll refresh
- Diff arrivals by tripId+serviceDate for stable identity across polls
- Fade-out animation (200ms) when departures leave the list
- Fade-in animation (300ms) when new arrivals appear
- Keyed rendering for stable row positions

## Requirements

### Validated

- Favorites/bookmarks system (GSoC Phase 1, PR #436) — localStorage store, star toggle, favorites tab
- Arrival diffing & filtering (Milestone Phase 1) — filterDeparted, makeKey, diffArrivals utility + StopPane integration
- Stable row identity (Milestone Phase 1) — keyed {#each} by tripId+serviceDate, no reshuffle across polls

### Active

- [ ] Fade-out transition (200ms) for departures leaving the list
- [ ] Fade-in transition (300ms) for new arrivals appearing
- [ ] Arrival diffing — identify new/removed/unchanged arrivals by tripId+serviceDate
- [ ] Fade-out transition (200ms) for departures leaving the list
- [ ] Fade-in transition (300ms) for new arrivals appearing
- [ ] Stable row ordering via keyed each blocks

### Out of Scope

- WebSocket/SSE real-time updates — polling at 30s is sufficient for this milestone
- API route changes — no backend modifications needed
- ArrivalDeparture.svelte rendering changes — internal logic stays the same
- Extended departure range (Phase 3) — separate milestone
- Bug fixes for past departure text (Phase 4) — separate milestone

## Context

- GSoC 2026 contributor, 175-hour total scope, ~40 hours for this phase
- Issue #331 tracks this work
- Branch: `feat/dynamic-arrivals` from `develop`
- StopPane.svelte (263 lines) polls every 30s, replaces entire list on each refresh
- ArrivalDeparture.svelte (229 lines) has its own 30s display timer, computes ETA/color/status
- Before screenshots captured on develop branch in `/tmp/wayfinder-pr-screenshots/before/`

## Constraints

- **Time**: ~40 hours GSoC allocation for this phase
- **Scope**: Only StopPane.svelte modified + new test file. No API changes.
- **Svelte 5**: Must use runes ($state, $derived, $effect) and Svelte 5 transition directives
- **Conventions**: Path aliases, i18n via svelte-i18n, Vitest for tests
- **Backwards compat**: Existing accordion expand/collapse, survey system, service alerts — all untouched

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Departure threshold: 0 minutes | Clean and simple — remove immediately when ETA goes negative | — Pending |
| Diff key: tripId+serviceDate | Matches TripDetailsPane identity, handles midnight rollover | — Pending |
| Fade transitions (200ms/300ms) | Subtle enough for quick-glance transit app, signals change without distraction | — Pending |
| No ArrivalDeparture.svelte changes | Internal display logic is already reactive, parent controls list membership | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after Phase 1 (Diffing & Filtering) completion*
