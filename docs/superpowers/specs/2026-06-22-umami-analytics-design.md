# Umami Analytics Contract Compliance — Design

**Issue:** [OneBusAway/wayfinder#523](https://github.com/OneBusAway/wayfinder/issues/523) — Add Umami Analytics support (server-side event emission via region-feed discovery)
**Date:** 2026-06-22
**Status:** Approved (brainstorming → ready for implementation plan)
**Branch:** `umami`

## Summary

Issue #523 asks Wayfinder to emit Umami analytics server-side. **Most of this already
exists.** The adapter pipeline built in the
[2026-05-16 spec](./2026-05-16-umami-analytics-adapter-design.md) already does the
core work: a client facade (`Analytics.js`) with event call sites wired throughout
the UI, a `/api/events` server endpoint that selects an adapter and forwards the
event with the end user's IP and User-Agent, and a `UmamiAdapter` that POSTs the
exact `{ type, payload }` contract body to `<host>/api/send`.

This work closes the **three gaps** between that implementation and the issue's
contract:

1. **`beep/boop` detection** — the issue's "critical gotcha." Umami silently drops a
   bot-like or misconfigured request as **HTTP 200** with body `{"beep":"boop"}`. The
   adapter currently treats that valid-JSON 200 as success, so a silently-dropped
   event looks healthy.
2. **Bot-risky User-Agent fallback** — when the forwarded browser UA is empty the
   adapter falls back to a bare `Wayfinder/1.0`, which risks Umami's `isbot` filter.
   (The 2026-05-16 spec flagged exactly this under "Open risks.")
3. **No prop sanitization** — the `data` object is forwarded verbatim, including the
   free-text `search` `query` (uncontrolled user input).

All three changes are confined to `src/lib/Analytics/adapters/UmamiAdapter.js` and its
test file. No new architecture, no new endpoints, no call-site changes.

## Decisions (resolved during brainstorming)

| Question | Decision |
| --- | --- |
| Where do `url` / `id` come from? | **Env vars only** (`PUBLIC_ANALYTICS_*`), keeping the existing config. Region-feed discovery is **deferred / out of scope**, matching the sibling [Twilio design](../../../../twilio/docs/superpowers/specs/2026-06-22-umami-analytics-design.md), which made the same call for the same reason: the app does not consume `regions-v3.json` today. |
| Expand event coverage? | **No.** Ship against the events already wired (pageview, search, stop-viewed, route-clicked, arrival-clicked). Trip-plan / arrivals-refresh events are a possible follow-up. |
| Keep Plausible? | **Yes.** Untouched. |

### Why env-only (and not region-feed discovery)

The issue text says "read the current region's `umamiAnalytics` from the region feed
Wayfinder already consumes." In practice Wayfinder **does not** consume the feed — the
`/api/regions` endpoint is a passthrough proxy used by nothing, and the app is a
single-region deployment configured entirely through env vars (`PUBLIC_OBA_SERVER_URL`
et al.). Twilio — the closest analog, also a server-side emitter that does not fetch
the feed — explicitly deferred region-feed fetching and shipped env-only. Wayfinder
follows that precedent. Region-feed discovery remains a clean future enhancement if a
multi-region Wayfinder ever materializes.

## Emission contract (unchanged, for reference)

`POST <PUBLIC_ANALYTICS_API_HOST>/api/send`, `Content-Type: application/json`:

```json
{
  "type": "event",
  "payload": {
    "website": "<PUBLIC_ANALYTICS_WEBSITE_ID>",
    "hostname": "<PUBLIC_ANALYTICS_DOMAIN>",
    "language": "en-US",
    "screen": "1920x1080",
    "url": "/stop",
    "referrer": "",
    "title": "Wayfinder",
    "name": "pageview",
    "data": { "id": "1_00" }
  }
}
```

- The end user's IP is forwarded via `X-Forwarded-For`, and their browser User-Agent
  via the `User-Agent` header, so Umami attributes per-visitor sessions from IP+UA —
  exactly as the issue asks. **This already works** and does not change.
- `name` is always present in Wayfinder's envelopes (the facade sends `pageview` /
  `search` / `click`), so every event is a Umami custom event. No pageview-omission
  path exists; no test for it.

## Components

### `UmamiAdapter.js` — the three fixes

All changes live in `forwardEvent` plus two new module-level exported helpers (exported
so they are unit-testable in isolation, mirroring Twilio's standalone
`isSuccessfulIngest`).

#### 1. `beep/boop` detection — `isSuccessfulIngest(body)`

```js
// A dropped event returns HTTP 200, not an error. Umami replies {"beep":"boop"}
// (or a body lacking cache/sessionId/visitId) when isbot rejects the request.
// Tolerant of non-JSON: fall back to a substring check for "beep".
export function isSuccessfulIngest(body) { /* ... */ }
```

Contract (mirrors the Twilio/iOS resolution):

- A body containing `"beep"` → **failure**.
- Otherwise **success** when the body is **empty** OR contains one of
  `cache` / `sessionId` / `visitId`.
- Any other non-empty body → **failure** (no success marker).
- Parsing is tolerant: a non-JSON body must not throw; fall back to the `"beep"`
  substring check.

Wiring in `forwardEvent`: after the existing `res.ok` check and `await res.text()`,
call `isSuccessfulIngest(text)`. On failure, **throw** a descriptive `Error`
(e.g. `Umami dropped event (bot-like User-Agent or misconfigured website id)`) with
`upstreamStatus = res.status`. The `/api/events` endpoint already catches this and
returns the status; the client facade already swallows and logs it — so the
fire-and-forget guarantee holds while the drop is now visible in server logs instead
of looking healthy. On success, return the parsed JSON as today.

#### 2. Browser-shaped User-Agent fallback

Replace the bare `Wayfinder/1.0` fallback with a `Mozilla/5.0`-prefixed,
browser-shaped constant that survives `isbot` **by construction** (the approach Twilio
adopted after finding bare product tokens fragile against isbot's anchored pattern):

```js
const FALLBACK_USER_AGENT = 'Mozilla/5.0 (Wayfinder) Server/1.0';
```

The forwarded real browser UA remains preferred and unchanged; this only affects the
rare empty-UA case (server-originated requests, `sendBeacon` edge cases, curl).

#### 3. Prop sanitization — `sanitizeData(props)`

```js
// Keep string / finite number / boolean. Stringify other types. Drop null/undefined.
// Truncate strings to MAX_DATA_VALUE_LENGTH (256) to respect Umami's data limits and
// to bound the free-text `search` query (uncontrolled user input).
export function sanitizeData(props) { /* ... */ }
```

Applied to `payload.data` before the POST. Empty result is sent as `{}` (current
behavior for missing props is preserved).

## Files touched

**Modified:**

- `src/lib/Analytics/adapters/UmamiAdapter.js` — add `isSuccessfulIngest`,
  `sanitizeData`, `FALLBACK_USER_AGENT`; wire all three into `forwardEvent`.
- `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js` — add the new tests below;
  **update** the existing fallback-UA test (currently asserts `'Wayfinder/1.0'` at
  ~line 206) to assert the new browser-shaped string.

No other files change. Env schema, `.env.example`, call sites, and the `/api/events`
endpoint are all untouched — the endpoint's existing `try/catch` already handles the
new throw path.

## Testing

Add to the existing `UmamiAdapter` suite (which already covers payload shape, IP/UA
forwarding, hostname sourcing, timeout/abort, and the disabled gate):

- **`isSuccessfulIngest` (table test):**
  - `{"beep":"boop"}` → failure.
  - body with `cache` / `sessionId` / `visitId` → success.
  - empty body `''` → success.
  - non-empty body with no success marker and no `beep` → failure.
  - non-JSON body (e.g. `'<html>...'`) → does not throw; failure unless it contains a
    marker.
- **`forwardEvent` beep/boop path:** a 200 response whose body is `{"beep":"boop"}` is
  treated as a **failure** (throws, `upstreamStatus` set); a 200 with a success body
  still resolves successfully.
- **`sanitizeData`:** strings/numbers/booleans kept; objects/arrays stringified;
  `null`/`undefined` dropped; a >256-char string truncated to 256; verified through a
  `forwardEvent` call that the emitted `payload.data` is sanitized (e.g. a long
  `query`).
- **Fallback UA:** update the existing test — empty `requestContext.userAgent` now
  yields `Mozilla/5.0 (Wayfinder) Server/1.0`; a present browser UA is still forwarded
  verbatim.
- All existing Analytics tests stay green.

Run with `npx vitest run` (per repo convention — `npm run test` hangs in non-TTY).

## Manual verification (issue's real acceptance test)

Not automatable. Checklist:

1. Configure `.env` with `PUBLIC_ANALYTICS_PROVIDER=umami`,
   `PUBLIC_ANALYTICS_API_HOST`, `PUBLIC_ANALYTICS_WEBSITE_ID`, `PUBLIC_ANALYTICS_DOMAIN`
   pointed at the live Umami host + website UUID.
2. `npm run dev`; exercise pageview / search / stop-view / route-click / arrival-click.
3. Confirm events appear under the correct website UUID in the Umami dashboard, and
   that the ingest response was `cache/sessionId/visitId` — **not** `beep/boop`.
4. Confirm a `none` / unconfigured provider emits nothing.

## Fail-safe guarantees (preserved)

- Emission is fire-and-forget: client call sites don't await, the facade swallows and
  logs, and the server endpoint catches every throw.
- Short upstream timeout (5s `AbortController`) — unchanged.
- A `beep/boop` drop now throws (logged server-side) instead of silently succeeding,
  without affecting any user-facing path.
- Disabled provider / missing config → `NoopAdapter` or `isEnabled() === false` → no
  request is ever made.

## Out of scope

- **Region-feed (`regions-v3.json`) discovery and per-region matching** — deferred,
  matching Twilio. Env-only config chosen.
- New event types beyond what's already wired (trip-plan, arrivals-refresh).
- Removing or deprecating Plausible.
- Any client-side / JavaScript Umami tracker.
