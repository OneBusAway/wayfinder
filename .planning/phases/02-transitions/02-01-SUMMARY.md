---
plan: 02-01
phase: 02-transitions
status: complete
started: 2026-03-25
completed: 2026-03-25
---

## What Was Done

Added Svelte fade transitions to the arrivals list in StopPane.svelte. Each arrival item in the keyed `{#each}` block is wrapped in a `<div>` with `in:fade={{ duration: 300 }}` and `out:fade={{ duration: 200 }}`.

## Key Files

### Created
(none)

### Modified
- `src/components/stops/StopPane.svelte` — Added `import { fade } from 'svelte/transition'`, wrapped AccordionItem in div with fade transitions

## Self-Check: PASSED

- fade import present: ✓
- in:fade directive: ✓
- out:fade directive: ✓
- 300ms duration for enter: ✓
- 200ms duration for exit: ✓
- Build passes: ✓
- All 1175 tests pass: ✓

## Decisions

- Used wrapper `<div>` approach since Svelte transitions must be on DOM elements, not component tags
- Used separate `in:fade` and `out:fade` for different durations (300ms in, 200ms out)
- Kept existing `data-new={arrival._isNew}` attribute for potential future use

## Deviations

None — implemented exactly as planned.
