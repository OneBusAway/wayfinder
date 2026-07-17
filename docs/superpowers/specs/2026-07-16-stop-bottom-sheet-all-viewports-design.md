# Stop Bottom Sheet at All Viewport Widths

**Date:** 2026-07-16
**Status:** Approved

## Goal

Remove the desktop-only `StopModal` (a 384px left-column `ModalPane`) and use the
draggable `BottomSheet` for the stop view at every viewport width. One code path
for stops; `ModalPane` remains for the route, all-routes, and trip-planner modals.

## Decisions

- **Desktop sheet geometry:** left-aligned at the search pane's width (384px),
  rising from the bottom of the viewport — not full-width, not centered.
- **Search pane on desktop:** always stays open. The collapse-to-pill behavior
  applies only below the `md` breakpoint.
- **Anchoring:** the sheet is anchored inside the existing left column's modal
  slot (the `flex-1` div below `SearchPane`, made `position: relative`).
  `BottomSheet` already sizes itself against its nearest positioned ancestor, so
  snap heights derive from the slot: "full" exactly fills the space the old
  desktop modal occupied and can never cover the search pane. No breakpoint
  detection or height measurement in JS.

## Changes

### `src/routes/+page.svelte`

- Delete the `StopModal` import and its `{#if currentModal === Modal.STOP && !isMobile}`
  branch; render `StopBottomSheet` in the modal slot for `Modal.STOP` at all widths.
- Make the modal slot `relative`; move the sheet inside it (it was previously a
  sibling of the column, anchored to the full viewport).
- Delete `isMobile`, the `matchMedia('(max-width: 767.98px)')` query, and its
  change listener. `stopSheetOpen` becomes `currentModal === Modal.STOP`.
- Move horizontal margins off the column onto a search wrapper
  (`mx-2 md:mx-0`) so the mobile sheet stays edge-to-edge while the desktop
  column keeps `md:mx-4 md:w-96`.
- Collapse visibility becomes CSS-responsive: the collapsed `SearchPane` gets
  `hidden md:flex` (desktop always shows it), and the pill is mobile-only.

### `src/components/navigation/BottomSheet.svelte`

- Delete the map-dim overlay: `mapDim` prop, `DIM_THRESHOLD`, the `dimmed`
  derived, and the dim div. At "full" the sheet now fills its whole container,
  so the dim could never be seen.

### `src/components/search/SearchPane.svelte` / `CollapsedSearchField.svelte`

- The collapse "X" button and the pill get `md:hidden` — collapsing is a
  sub-`md` affordance only.

### Deletions

- `src/components/stops/StopModal.svelte`
- `src/components/stops/__tests__/StopModal.test.js`
- The two map-dim tests in `BottomSheet.test.js`

## Accepted mobile behavior changes

- "Full" snap now stops just below the collapsed search pill instead of sliding
  over it (closer to the original brief's "viewport minus header").
- No more map dim at full — the map is fully hidden behind the sheet there anyway.

## Testing

- Update `BottomSheet.test.js` (drop dim tests); keep `StopBottomSheet` and
  `SearchPane` tests; delete `StopModal` tests.
- Playwright at 390×780 and 1280×800: open a stop, drag and arrow-key through
  snap points, verify search interplay (pill on mobile, persistent pane on
  desktop), verify route/all-routes/trip-planner modals are unaffected.
