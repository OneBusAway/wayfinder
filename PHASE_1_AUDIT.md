# PHASE 1: DISCOVERY & ARCHITECTURE AUDIT

**Date:** 22 March 2026  
**Scope:** Baseline architecture, delivery-gap analysis, and readiness for implementation

---

## 1) EXECUTIVE SUMMARY

Phase 1 is complete. The current codebase is stronger than expected and already ships key parts of the proposed GSOC scope.

### Current status against target outcomes

- **Favorites / bookmarks (localStorage):** **Not implemented**
- **Service alerts display:** **Partially implemented / present in stop flow**
- **Dynamic arrivals auto-refresh:** **Implemented** (30s polling in stop pane)
- **Extended departures beyond default window:** **Implemented** (date-based stop schedule)
- **Accessibility audit + fixes:** **Pending formal audit; multiple known issues**
- **Expanded tests:** **Already strong baseline**
- **Bug fixes (trip details / past departures):** **Needs targeted verification**

---

## 2) ARCHITECTURE BASELINE

### Stores and state

Observed store files:

- `src/stores/mapStore.js`
- `src/stores/modalOpen.js`
- `src/stores/recentTripsStore.js` *(persisted to localStorage)*
- `src/stores/surveyStore.js`
- `src/stores/tripOptionsStore.js` *(persisted fields + derived `effectiveDistanceUnit`)*
- `src/stores/userLocationStore.js`

### localStorage patterns already used

- `src/stores/recentTripsStore.js`
- `src/stores/tripOptionsStore.js`

These patterns are reusable for `favoritesStore` implementation.

### API and data integration

- OBA SDK wrapper exists in `src/lib/obaSdk.js` with central response guard (`handleOBAResponse`).
- API routes are organized under `src/routes/api/**`.
- Alerts data paths already exist:
  - GTFS-RT alerts endpoint: `src/routes/api/oba/alerts/+server.js`
  - Stop-level situations consumed in stop pane.

---

## 3) FEATURE GAP FINDINGS (WHAT IS ALREADY DONE VS MISSING)

### A) Favorites / bookmarks

**Status:** Missing (no favorites/bookmark symbols found in `src/**`).

**Phase 2 target files to add:**

- `src/stores/favoritesStore.js`
- `src/lib/favoritesUtils.js`
- `src/components/favorites/FavoriteButton.svelte`
- `src/components/favorites/FavoritesPanel.svelte`

**Likely files to modify:**

- `src/components/StopItem.svelte`
- `src/components/RouteItem.svelte`
- `src/routes/+layout.svelte` (or another global nav host)

### B) Service alerts

**Status:** Present in stop experience.

Evidence:

- `src/components/stops/StopPane.svelte` pulls situations from arrivals response and renders `ServiceAlerts`.
- `src/components/service-alerts/**` already exists.

**Remaining work:** Improve filtering/scoping UX (route/stop relevance), strengthen a11y semantics, add focused tests.

### C) Dynamic arrivals auto-refresh

**Status:** Implemented.

Evidence:

- `src/components/stops/StopPane.svelte` uses `setInterval(..., 30000)` to re-fetch arrivals.
- Request cancelation via `AbortController` is already in place.

**Remaining work:** refine stale-state messaging and verify no timing regressions in edge cases.

### D) View departures beyond default range

**Status:** Implemented via date picker schedule view.

Evidence:

- `src/routes/stops/[stopID]/schedule/+page.svelte` fetches `/api/oba/schedule-for-stop/[id]?date=...`.

**Remaining work:** evaluate adding explicit time-range controls (if required by mentors).

---

## 4) ACCESSIBILITY BASELINE (PHASE 1 PRIORITIES)

Initial code scan found interactive patterns that need a formal audit pass:

- Click handlers without full keyboard parity in several components.
- Missing/limited ARIA labels in action-heavy UI.
- Focus states and modal focus management need review.

### High-priority candidates

- `src/components/StopItem.svelte`
- `src/components/RouteItem.svelte`
- `src/components/map/PopupContent.svelte`
- `src/components/trip-planner/TripOptionsModal.svelte`
- `src/components/navigation/OverflowMenu.svelte`
- `src/components/containers/Accordion.svelte`

---

## 5) TEST BASELINE (ACTUAL RUN)

Command executed: `npm run test:coverage`

### Result snapshot

- **Test files:** 52 passed
- **Tests:** 1157 passed
- **Coverage:**
  - Statements: **78.59%**
  - Branches: **90.30%**
  - Functions: **70.50%**
  - Lines: **78.59%**

### Key uncovered zones for this project scope

- map stack (`src/components/map/**`)
- route/stop server endpoints with 0% files
- some trip-planner modal/detail components
- provider and system theme infrastructure

This means testing is not a greenfield task; it is now a targeted expansion task.

---

## 6) RISKS & DEPENDENCIES

- Favorites UX needs clear interaction model (stop vs route vs trip).
- Accessibility fixes may touch shared primitives, causing broad test updates.
- Service alerts can vary by regional backend configuration and feed quality.

---

## 7) PHASE 2 START PLAN (IMMEDIATE)

### Sprint 1 (next implementation block)

1. Implement favorites persistence/store API.
2. Add `FavoriteButton` to stop and route list items.
3. Add favorites list surface in navigation/layout.
4. Add tests for store + UI interactions.

### Definition of done for Phase 2 kickoff

- Add/remove favorites works for both stops and routes.
- State persists across reloads.
- No regressions in existing test suite.
- New unit/component tests included.

---

## 8) PHASE 1 DELIVERABLE CHECKLIST

- [x] Architecture and state audit completed
- [x] Existing feature parity mapped against GSOC goals
- [x] Coverage baseline executed and recorded
- [x] Accessibility hotspot list prepared
- [x] Phase 2 implementation entry plan defined
