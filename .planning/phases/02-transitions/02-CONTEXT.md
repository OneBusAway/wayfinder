# Phase 2: Transitions - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

List changes are visually smooth — riders see departures fade away and new arrivals materialize rather than the list snapping to a new state. Uses Svelte's built-in transition directives on the keyed {#each} block already established in Phase 1.

</domain>

<decisions>
## Implementation Decisions

### Transition Timing
- Departures fade out over 200ms (opacity 1→0)
- New arrivals fade in over 300ms (opacity 0→1)
- Buses present in both previous and current poll do not animate at all

### Implementation Approach
- Use Svelte's built-in `transition:fade` directive on the {#each} items
- The keyed {#each} from Phase 1 already provides stable identity — Svelte handles enter/exit transitions automatically
- `_isNew` flag from diffArrivals is available but Svelte's keyed transitions may handle this natively
- No external animation library needed

### Claude's Discretion
- Whether to use `in:fade` + `out:fade` separately (for different durations) or `transition:fade` with conditional duration
- Whether to wrap the transition on the AccordionItem or an inner div
- CSS approach for the fade (Svelte transition vs CSS transition class)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/arrivalDiffing.js` — Phase 1 output, provides `_isNew` flag on arrivals
- `src/components/stops/StopPane.svelte` — already has keyed `{#each}` with `(makeKey(arrival))` and `data-new={arrival._isNew}` attribute

### Established Patterns
- Svelte 5 with runes ($state, $derived, $effect)
- Tailwind CSS for styling
- Svelte built-in transitions: `import { fade } from 'svelte/transition'`

### Integration Points
- StopPane.svelte line ~250: the `{#each arrivalsAndDepartures.arrivalsAndDepartures as arrival (makeKey(arrival))}` block
- AccordionItem wrapper around each arrival

</code_context>

<specifics>
## Specific Ideas

- Transitions should be subtle — transit apps need quick scanability
- The `data-new` attribute is already on AccordionItem from Phase 1 for targeting

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
