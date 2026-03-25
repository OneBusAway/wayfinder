# Requirements: Wayfinder Dynamic Arrival Updates

**Defined:** 2026-03-25
**Core Value:** Riders see an accurate, always-current arrivals list without stale departed buses

## v1.0 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Arrival Diffing

- [x] **DIFF-01**: Departed arrivals (ETA < 0) are filtered out on each poll refresh
- [x] **DIFF-02**: Arrivals are keyed by tripId+serviceDate for stable identity across polls
- [x] **DIFF-03**: New arrivals (not in previous poll) are identified for animation targeting

### Transitions

- [ ] **TRAN-01**: Departures fade out (200ms opacity transition) when removed from the list
- [ ] **TRAN-02**: New arrivals fade in (300ms opacity transition) when appearing in the list

### Testing

- [x] **TEST-01**: Unit tests for diffing logic (filter departed, tag new, stable keys, edge cases)

## Future Requirements

### Extended Departures (Phase 3)

- **EXT-01**: User can see beyond 30-minute default arrival window
- **EXT-02**: "Show more departures" button with progressive loading

### Bug Fixes (Phase 4)

- **FIX-01**: Past departure text shows "Arrived X minutes ago" instead of negative minutes
- **FIX-02**: Correct tripId/serviceDate propagation to TripDetailsPane

## Out of Scope

| Feature | Reason |
|---------|--------|
| WebSocket/SSE real-time updates | 30s polling is sufficient; WebSocket adds complexity with no clear benefit |
| API route changes | No backend modifications needed for diffing |
| ArrivalDeparture.svelte changes | Internal rendering logic is already reactive |
| Custom animation library | Svelte built-in transitions are sufficient |
| Configurable departure threshold | 0-minute threshold confirmed; no user setting needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIFF-01 | Phase 1 | Complete |
| DIFF-02 | Phase 1 | Complete |
| DIFF-03 | Phase 1 | Complete |
| TEST-01 | Phase 1 | Complete |
| TRAN-01 | Phase 2 | Pending |
| TRAN-02 | Phase 2 | Pending |

**Coverage:**
- v1.0 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
