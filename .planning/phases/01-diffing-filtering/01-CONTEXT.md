# Phase 1: Diffing & Filtering - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Arrivals list is always accurate — departed buses are removed on every poll and each row has a stable identity across refreshes. This phase implements the diffing logic (filter departed, key by tripId+serviceDate, tag new arrivals) and the unit tests that verify it. No visual transitions yet — that's Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key design decisions already confirmed in conversation:
- Departure threshold: 0 minutes (remove immediately when ETA < 0)
- Diff key: `tripId + serviceDate` (matches TripDetailsPane identity)
- Tag new arrivals with `_isNew` property for Phase 2 animation targeting
- Extract diffing as a pure function for testability
- Modify only StopPane.svelte — ArrivalDeparture.svelte untouched

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StopPane.svelte` (263 lines) — main arrivals container with 30s polling via setInterval
- `ArrivalDeparture.svelte` (229 lines) — individual arrival row renderer (not modified)
- `SingleSelectAccordion.svelte` + `AccordionItem.svelte` — current list rendering components

### Established Patterns
- Svelte 5 runes: `$state`, `$derived`, `$effect` for reactivity
- AbortController for request cancellation on stop change
- `loadData()` fetches from `/api/oba/arrivals-and-departures-for-stop/{stopID}`
- Arrival data: `{ tripId, serviceDate, scheduledArrivalTime, predictedArrivalTime, predicted, stopSequence, ... }`
- Time handling: milliseconds since epoch, `predictedArrivalTime > 0 && predicted` means real-time data

### Integration Points
- `loadData()` in StopPane.svelte — where diffing logic hooks in after API response
- `arrivalsAndDepartures` state variable — the list that gets filtered/tagged
- `{#each arrivalsAndDepartures.arrivalsAndDepartures as arrival}` — the rendering loop (will need keying)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
