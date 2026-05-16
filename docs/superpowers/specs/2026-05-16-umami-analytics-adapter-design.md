# Pluggable Analytics Adapters (Plausible + Umami)

**Date:** 2026-05-16
**Status:** Draft — pending approval
**Branch:** `umami-analytics`

## Problem

Wayfinder currently sends analytics events to Plausible. We want to also support [Umami](https://umami.is/), and to allow operators to pick which (if any) backend to use. The current toggle is a boolean (`PUBLIC_ANALYTICS_ENABLED`) that only governs Plausible. Plausible and Umami have different request shapes, so a single hard-coded implementation can't serve both.

## Goals

1. Support Plausible and Umami as analytics backends, selectable via configuration.
2. Replace the boolean on/off toggle with a single provider selector that also serves as the on/off switch.
3. Make adding a third backend a matter of writing one new adapter class and wiring it into a factory.
4. Build the system test-first (TDD red-to-green) at each step.

## Non-goals

- No back-compat shim for the removed `PUBLIC_ANALYTICS_ENABLED` boolean. Operators set `PUBLIC_ANALYTICS_PROVIDER=plausible` (or `umami`/`none`) instead.
- No client-side Umami SDK (no `umami.js` script tag). We keep the existing server-proxy pattern.
- No new event types or report methods. Surface stays identical at the call sites.
- No conditional schema validation. Provider-specific vars stay `allowEmpty: true` in `env-schema.json`; the adapter's `isEnabled()` decides whether a provider is configured.

## API shapes

These are the on-the-wire payload differences that motivate the adapter pattern.

### Plausible — `POST {host}/api/event`

```json
{
  "domain": "example.com",
  "name": "pageview",
  "url": "/",
  "referrer": "https://example.com",
  "props": { "id": "1_00" }
}
```

Plausible derives screen, language, and User-Agent from request headers.

### Umami — `POST {host}/api/send`

Requires a `User-Agent` header on the request — Umami rejects requests without one.

```json
{
  "type": "event",
  "payload": {
    "website": "79eab5f4-0c4d-492b-9b60-ecf018859f03",
    "hostname": "wayfinder.example.com",
    "language": "en-US",
    "screen": "1920x1080",
    "url": "/",
    "referrer": "",
    "title": "Wayfinder",
    "name": "pageview",
    "data": { "id": "1_00" }
  }
}
```

Source: <https://docs.umami.is/docs/api/sending-stats>

## Architecture

Three layers under `src/lib/Analytics/`:

```
src/lib/Analytics/
├── index.js              # default export: Analytics singleton
├── Analytics.js          # facade — high-level methods, builds envelope, POSTs /api/events
├── createAdapter.js      # factory — env → adapter instance
├── adapters/
│   ├── PlausibleAdapter.js
│   ├── UmamiAdapter.js
│   └── NoopAdapter.js
└── analyticsUtils.js     # renamed from plausibleUtils.js — distance category helper
```

### The Facade (`Analytics.js`)

What components import. Identical surface to today.

```js
class Analytics {
  constructor(env)
  defaultProperties: object
  isEnabled(): boolean
  async reportPageView(url, props)
  async reportSearchQuery(query)
  async reportStopViewed(id, distance)
  async reportRouteClicked(routeId)
  async reportArrivalClicked(action)
}
```

Responsibilities:
- Read `PUBLIC_ANALYTICS_PROVIDER` from env to short-circuit fetch when `none`.
- Collect browser context per call: `document.title`, `document.referrer`, `navigator.language`, `${window.screen.width}x${window.screen.height}`. Always populated when running in a browser; omitted/empty in non-browser contexts (tests/SSR).
- Build the **generic envelope** (see below) and POST it to `/api/events`.
- Merge `defaultProperties` into `props` (unchanged behavior).

### Generic envelope (client → server)

Provider-agnostic payload shape on the wire between the browser and `/api/events`:

```ts
{
  name: string,            // event name (pageview, search, click)
  url: string,             // path on the site
  props?: object,          // event-specific data
  referrer?: string,
  title?: string,
  language?: string,
  screen?: string          // "WIDTHxHEIGHT"
}
```

The Plausible adapter ignores `title`/`language`/`screen`. The Umami adapter consumes all of them.

### Adapter contract (server-side)

```js
class Adapter {
  constructor(env)
  isEnabled(): boolean
  async forwardEvent(envelope, requestContext): Promise<object>
}
```

Where `requestContext` carries the things only the SvelteKit server can see:

```ts
{ userAgent: string }
```

`UmamiAdapter` uses `env.PUBLIC_ANALYTICS_DOMAIN` (not the request `Host` header) as `payload.hostname`, so the value is deterministic and survives proxies. `UmamiAdapter` also requires the `User-Agent` header — Umami rejects requests without it — so we forward it via `requestContext.userAgent`.

`forwardEvent` returns the upstream response parsed as JSON if possible; on upstream error, throws an `Error` with an `upstreamStatus` property (matches current behavior so `/api/events/+server.js` can forward the status).

### Factory (`createAdapter.js`)

```js
function createAdapter(env) {
  switch (env.PUBLIC_ANALYTICS_PROVIDER) {
    case 'plausible': return new PlausibleAdapter(env);
    case 'umami':     return new UmamiAdapter(env);
    case 'none':
    default:          return new NoopAdapter();
  }
}
```

If the selected provider is missing its required vars, the adapter's `isEnabled()` returns `false` — same downstream behavior as `NoopAdapter`. We don't fall back to `NoopAdapter` in the factory, so misconfiguration is debuggable (logs say "Umami disabled: missing website id" rather than "no provider").

### Adapters

**`NoopAdapter`** — `isEnabled()` returns `false`. `forwardEvent` returns `{ status: 'analytics disabled' }`.

**`PlausibleAdapter`** — same logic as current `PlausibleAnalytics.forwardEvent`:
- Reads `PUBLIC_ANALYTICS_DOMAIN` and `PUBLIC_ANALYTICS_API_HOST`.
- `isEnabled()` requires both to be non-empty.
- Translates envelope → `{ domain, name, url, referrer, props }`.

**`UmamiAdapter`** — new:
- Reads `PUBLIC_ANALYTICS_WEBSITE_ID`, `PUBLIC_ANALYTICS_API_HOST`, and `PUBLIC_ANALYTICS_DOMAIN`.
- `isEnabled()` requires all three to be non-empty.
- Translates envelope + requestContext → Umami `{ type, payload }`.
  - `hostname` ← `env.PUBLIC_ANALYTICS_DOMAIN`
  - `website` ← `env.PUBLIC_ANALYTICS_WEBSITE_ID`
  - `data` ← `envelope.props`
- POSTs with `User-Agent: requestContext.userAgent` (must be non-empty — if missing, sends a fallback like `Wayfinder/1.0` so Umami doesn't reject).

### Server route (`/api/events/+server.js`)

```js
export async function POST({ request }) {
  const envelope = await request.json();
  const adapter = createAdapter(dynamicEnv.env);
  const ctx = { userAgent: request.headers.get('user-agent') ?? '' };
  try {
    const data = await adapter.forwardEvent(envelope, ctx);
    return new Response(JSON.stringify(data), { status: 200, ... });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message ?? 'Unknown error' }),
      { status: error.upstreamStatus ?? 500, ... }
    );
  }
}
```

## Environment variables

### Removed

- `PUBLIC_ANALYTICS_ENABLED` — superseded by `PUBLIC_ANALYTICS_PROVIDER` (set to `none` to disable).

### Kept (unchanged)

| Var | Used by | Notes |
|---|---|---|
| `PUBLIC_ANALYTICS_DOMAIN` | Plausible, Umami | Plausible: site domain sent as `domain`. Umami: site domain sent as `payload.hostname`. |
| `PUBLIC_ANALYTICS_API_HOST` | Plausible, Umami | Upstream base URL. Plausible appends `/api/event`; Umami appends `/api/send`. |

### Added

| Var | Type | Required | Notes |
|---|---|---|---|
| `PUBLIC_ANALYTICS_PROVIDER` | enum: `none` \| `plausible` \| `umami` | no (default `none`) | Single switch. Replaces the boolean. |
| `PUBLIC_ANALYTICS_WEBSITE_ID` | string, allowEmpty | no | Required at runtime when provider=umami. Ignored by Plausible. |

`.env.example` updates: drop `PUBLIC_ANALYTICS_ENABLED`, add `PUBLIC_ANALYTICS_PROVIDER` and `PUBLIC_ANALYTICS_WEBSITE_ID` with commented example values.

## File-by-file change summary

**New:**
- `src/lib/Analytics/index.js`
- `src/lib/Analytics/Analytics.js`
- `src/lib/Analytics/createAdapter.js`
- `src/lib/Analytics/adapters/PlausibleAdapter.js`
- `src/lib/Analytics/adapters/UmamiAdapter.js`
- `src/lib/Analytics/adapters/NoopAdapter.js`
- `src/tests/lib/Analytics/Analytics.test.js`
- `src/tests/lib/Analytics/createAdapter.test.js`
- `src/tests/lib/Analytics/adapters/PlausibleAdapter.test.js`
- `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
- `src/tests/lib/Analytics/adapters/NoopAdapter.test.js`

**Renamed:**
- `src/lib/Analytics/plausibleUtils.js` → `src/lib/Analytics/analyticsUtils.js` (function name `analyticsDistanceToStop` unchanged)

**Deleted:**
- `src/lib/Analytics/PlausibleAnalytics.js` (logic split into `Analytics.js` + `adapters/PlausibleAdapter.js`)
- `src/tests/lib/PlausibleAnalytics.test.js` (replaced by the per-adapter and facade tests above)

**Modified:**
- `src/routes/api/events/+server.js` — use factory + pass requestContext
- `src/tests/api/events.test.js` — cover both adapters via env mocking
- `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/stops/[stopID]/+page.svelte` — import from `$lib/Analytics`
- `src/components/search/SearchField.svelte`, `src/components/stops/StopPane.svelte` — same import update
- `env-schema.json` — drop `PUBLIC_ANALYTICS_ENABLED`; add `PUBLIC_ANALYTICS_PROVIDER` and `PUBLIC_ANALYTICS_WEBSITE_ID`
- `.env.example` — same change
- `vitest-setup.js` — mock new env vars (default to `PUBLIC_ANALYTICS_PROVIDER='none'`)
- `CLAUDE.md` — update env-var section if it references the removed vars

## TDD red-to-green sequence

Each numbered step is one red→green cycle. Run `npm run test` between steps. Commit at each green step so we can bisect if needed.

1. **NoopAdapter** — disabled-by-default, returns `{ status: 'analytics disabled' }`.
2. **UmamiAdapter** — payload shape, `User-Agent` forwarding, hostname sourced from `PUBLIC_ANALYTICS_DOMAIN`, `isEnabled()` requires website id + api host + domain, error path preserves `upstreamStatus`.
3. **PlausibleAdapter** — extracted from current `PlausibleAnalytics.forwardEvent`. Same env vars (`PUBLIC_ANALYTICS_DOMAIN`, `PUBLIC_ANALYTICS_API_HOST`) and same payload as today.
4. **createAdapter factory** — returns each concrete class for each provider value; defaults to `NoopAdapter`.
5. **Analytics facade** — builds generic envelope, populates browser context fields when `window` is available, POSTs to `/api/events`, merges `defaultProperties`, short-circuits when provider=none. Cover all five `report*` methods.
6. **`/api/events` route** — uses factory, passes `{ userAgent }`, forwards adapter response, propagates `upstreamStatus`.
7. **env-schema + .env.example + vitest-setup** — drop `PUBLIC_ANALYTICS_ENABLED`, add `PUBLIC_ANALYTICS_PROVIDER` and `PUBLIC_ANALYTICS_WEBSITE_ID`. Default mock value `PUBLIC_ANALYTICS_PROVIDER='none'`.
8. **Call-site import migration** — update the five Svelte files. Existing component tests should still pass; if any test references the old module path, fix it here.
9. **Rename `plausibleUtils.js` → `analyticsUtils.js`** and update imports in `+page.svelte` + `stops/[stopID]/+page.svelte`.
10. **Manual verification** against `https://analytics.sound-transit.onebusawaycloud.com/`, website id `79eab5f4-0c4d-492b-9b60-ecf018859f03`. Configure `.env`, run `npm run dev`, exercise pageview / search / stop / route / arrival flows, confirm events appear in the Umami dashboard.

## Open risks

- **User-Agent fallback.** If a request reaches `/api/events` without a `User-Agent` (curl, bots), the Umami adapter inserts `Wayfinder/1.0`. Umami will still accept it but the visitor will look like a bot. Acceptable — analytics noise is bounded.
- **Browser context in tests.** The facade's calls to `navigator.language` / `window.screen` need to work under jsdom (they do) and not throw on SSR. The facade only collects these inside `report*` methods, which are only called from `onMount`/event handlers — never during SSR.
