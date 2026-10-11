# GTFS-Flex Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show on-demand (GTFS-Flex) zones on the map, an on-demand card on stops, and a URL-addressable service detail sheet with hours and booking deadlines, backed by maglev's `/api/ondemand`.

**Architecture:** Thin SvelteKit raw-fetch proxies (with server-side support detection) pass maglev JSON to the browser. All flex logic — parsing, the normative booking-deadline evaluator, availability/status, hours, colours, zoom levels, copy — lives in pure modules under `src/lib/onDemand/`, tested with Vitest. A `.svelte.js` state module caches fetches; three Svelte components (zones layer, stop card, detail sheet) render it; each map provider gains a polygon API.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Vitest + jsdom + Testing Library, `temporal-polyfill` (global `Temporal`), Leaflet / Google Maps / ArcGIS Maps SDK, svelte-i18n.

**Spec:** `docs/superpowers/specs/2026-09-29-gtfs-flex-core-design.md`

**Worktree:** `/Users/aaron/repos/onebusaway/.worktrees/wayfinder-gtfs-flex` (branch `feat/gtfs-flex-core`). Run every command from there.

## Global Constraints

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`); follow existing component patterns.
- Prettier: tabs, single quotes, 100-column print width. Run `npm run format` before each commit; `npm run lint` must pass.
- `Temporal` is a global installed by `temporal-polyfill/global` (root layout, `hooks.server.js`, `vitest-setup.js`). **Never touch `Temporal` at module top level** — only inside functions — because module evaluation order is not guaranteed relative to the polyfill import.
- Format dates for display with `Intl.DateTimeFormat(locale, { timeZone, … }).format(new Date(instant.epochMilliseconds))`, never with Temporal's own `toLocaleString` (see the note in `src/lib/dateTimeFormat.js`).
- "Now" is always the device clock (`Temporal.Now.instant()`), passed as a parameter into pure functions. Never use the envelope `currentTime`.
- Agency timezone comes only from `references.agencies[].timezone` via the service's `agencyId`.
- Booking messages (`message`, `pickupMessage`, `dropOffMessage`) are rendered verbatim, never parsed.
- No service-kind badge or subtitle anywhere. Absent `eligibility` renders nothing.
- No env feature flag. Support is detected at runtime; `unsupported` hides every flex surface.
- Strings go only into `src/locales/en.json` under the `ondemand` namespace (other locales fall back to English).
- Server-only modules end in `.server.js` (they read private env). Never import them from components.
- Commit messages: conventional prefix like the repo (`feat(ondemand): …`, `test(ondemand): …`), imperative, ≤ 72-column body explaining why. No agent attribution / Co-Authored-By lines.
- Zone thresholds: street ≤ 4 km visible height, region ≤ 65 km, hidden above. Zone palette: `#3b82f6, #d97706, #7c3aed, #db2777, #0891b2, #65a30d`; brand `#78aa36`.
- Unsupported-verdict TTL: 1 hour. Client cache TTL: 10 minutes. Timer re-evaluation: `nextChangeInstant + 1 s`.

## Review Focus

1. **A booking rule id that doesn't resolve, or a service whose agency has no/invalid timezone** — the service must still render (name, hours) with status unknown, never throw. Covered in Task 5 (`dangling id`, `missing timezone`) and Task 14 (sheet renders with unknown status).
2. **The same stop re-rendered every 30 s by the arrivals poll** — the stop card must not refetch or flicker. Covered in Task 13 (`does not refetch when the stop object is replaced with the same ids`).
3. **A server without `/api/ondemand` (stock maglev serves HTML with 200)** — no zones, no card, no errors in the console beyond one log line; cold `/map/ondemand/x` redirects home. Covered in Task 1 (HTML 200 → unsupported), Task 8 (501 flips state), Task 12 (layer clears), Task 15 (redirect).
4. **Map panned quickly: an older viewport response arrives after a newer one** — stale zones must not replace fresh ones. Covered in Task 12 (`discards a stale response`).
5. **`clearAllPolylines()` called by route/trip flows while zones are drawn** — zones must survive. Covered in Tasks 9–11 (`clearAllPolylines leaves polygons`).

---

## File Structure

| File                                                                           | Responsibility                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/lib/onDemand/serverSupport.server.js`                                     | Process-wide supported/unsupported verdict with 1 h expiry                                |
| `src/lib/onDemand/upstream.server.js`                                          | Fetch maglev `/api/ondemand`, classify replies, agency filter, map results to `Response`s |
| `src/lib/onDemand/params.js`                                                   | Pure query-parameter validation for the proxies                                           |
| `src/routes/api/oba/ondemand/services-for-location/+server.js`                 | Proxy                                                                                     |
| `src/routes/api/oba/ondemand/service/[id]/+server.js`                          | Proxy                                                                                     |
| `src/lib/agencyFilter.js` (modify)                                             | Keep flex-only stops whose `onDemandServiceIds` match the filter                          |
| `src/lib/onDemand/models.js`                                                   | Parse wire JSON into services joined with references; small lookups                       |
| `src/lib/onDemand/serviceDetails.js`                                           | Where-section summary and service bounds                                                  |
| `src/lib/onDemand/instants.js`                                                 | Instant comparison helpers and `scheduleAt` timer                                         |
| `src/lib/onDemand/bookingDeadline.js`                                          | Normative per-(rule, date) booking evaluator                                              |
| `src/lib/onDemand/bookingResolution.js`                                        | Service-level booking line (port of iOS `OnDemandBookingResolution`)                      |
| `src/lib/onDemand/availability.js`                                             | Status, tier, tag, nextChangeInstant; sort                                                |
| `src/lib/onDemand/hours.js`                                                    | "When" rows                                                                               |
| `src/lib/onDemand/colors.js`                                                   | Zone colour assignment                                                                    |
| `src/lib/onDemand/zones.js`                                                    | Zoom level and zone style                                                                 |
| `src/lib/onDemand/copy.js`                                                     | Status/booking-line/tag strings via `t`                                                   |
| `src/lib/onDemand/onDemandState.svelte.js`                                     | Reactive support state, highlight, fetch caches                                           |
| `src/lib/MapHelpers/zoneGeometry.js`                                           | GeoJSON polygon ring extraction and orientation                                           |
| `src/lib/mapPanes.js` (modify)                                                 | `ZONE_PANE`                                                                               |
| `src/lib/Provider/{OpenStreetMap,Google,ArcGIS}MapProvider.svelte.js` (modify) | Polygon API + `fitToBounds`                                                               |
| `src/components/map/OnDemandZonesLayer.svelte`                                 | Renderless zones layer                                                                    |
| `src/components/map/MapView.svelte` (modify)                                   | Mount the layer, emit viewport ticks                                                      |
| `src/components/stops/OnDemandStopCard.svelte`                                 | Stop card                                                                                 |
| `src/components/stops/StopPane.svelte`, `StopBottomSheet.svelte` (modify)      | Mount card, flex-only empty copy, thread selection handler                                |
| `src/components/ondemand/OnDemandServiceSheet.svelte`                          | Detail sheet                                                                              |
| `src/routes/(map)/map/ondemand/[serviceId]/+page.server.js`, `+page.svelte`    | Route                                                                                     |
| `src/components/MapExperience.svelte` (modify)                                 | Sheet branch, cold-load seeding, close                                                    |
| `src/lib/urls.js` (modify)                                                     | `onDemandServicePath`                                                                     |
| `src/locales/en.json` (modify)                                                 | `ondemand` strings                                                                        |
| `src/tests/fixtures/flex-booking-vectors.json`                                 | Mirror of maglev vectors                                                                  |
| `src/tests/fixtures/onDemand.js`                                               | Wire-JSON builders for tests                                                              |

---

### Task 1: Server support detection and upstream fetch

**Files:**

- Create: `src/lib/onDemand/serverSupport.server.js`
- Create: `src/lib/onDemand/upstream.server.js`
- Test: `src/tests/lib/onDemand/upstream.server.test.js`

**Interfaces:**

- Produces:

  - `isKnownUnsupported(nowMs?: number): boolean`
  - `isUnsupportedReply(reply: UpstreamReply): boolean`
  - `recordProbeReply(reply: UpstreamReply, nowMs?: number): void`
  - `resetOnDemandSupportForTesting(): void`
  - `UNSUPPORTED_TTL_MS = 3_600_000`
  - `fetchOnDemand(path: string, params: Record<string, string|number|null|undefined>): Promise<UpstreamReply>` where `UpstreamReply = { status: number, body: any, isEnvelope: boolean }`
  - `loadServicesForLocation(params): Promise<OnDemandResult>` and `loadServiceEntry(id: string, geometryDetail: string|null): Promise<OnDemandResult>` where `OnDemandResult = { kind: 'ok', body } | { kind: 'notFound' } | { kind: 'unsupported' } | { kind: 'error' }`
  - `onDemandResponse(result: OnDemandResult): Response` (200 body / 404 `{error:'not_found'}` / 501 `{error:'ondemand_unsupported'}` / 502 `{error:'upstream_error'}`)

- [ ] **Step 1: Write the failing tests**

`src/tests/lib/onDemand/upstream.server.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrivateEnv = vi.hoisted(() => ({ PRIVATE_OBA_AGENCY_FILTER: '' }));
vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockPrivateEnv;
	}
}));
vi.mock('$env/static/private', () => ({ PRIVATE_OBA_API_KEY: 'secret' }));

import {
	fetchOnDemand,
	loadServicesForLocation,
	loadServiceEntry,
	onDemandResponse
} from '$lib/onDemand/upstream.server.js';
import {
	isKnownUnsupported,
	isUnsupportedReply,
	recordProbeReply,
	resetOnDemandSupportForTesting,
	UNSUPPORTED_TTL_MS
} from '$lib/onDemand/serverSupport.server.js';

function reply(status, body, contentType = 'application/json') {
	const text = typeof body === 'string' ? body : JSON.stringify(body);
	return new Response(text, { status, headers: { 'content-type': contentType } });
}
const envelope = (data, code = 200) => ({ code, currentTime: 0, text: 'OK', version: 2, data });

describe('serverSupport', () => {
	beforeEach(() => resetOnDemandSupportForTesting());

	it('classifies a raw 404, a non-envelope 2xx and an envelope code 404 as unsupported', () => {
		expect(isUnsupportedReply({ status: 404, body: null, isEnvelope: false })).toBe(true);
		expect(isUnsupportedReply({ status: 200, body: null, isEnvelope: false })).toBe(true);
		expect(isUnsupportedReply({ status: 200, body: { code: 404 }, isEnvelope: true })).toBe(true);
		expect(isUnsupportedReply({ status: 200, body: { code: 200 }, isEnvelope: true })).toBe(false);
		expect(isUnsupportedReply({ status: 500, body: null, isEnvelope: false })).toBe(false);
	});

	it('remembers an unsupported verdict for one hour, then forgets it', () => {
		recordProbeReply({ status: 404, body: null, isEnvelope: false }, 1_000);
		expect(isKnownUnsupported(1_000 + UNSUPPORTED_TTL_MS - 1)).toBe(true);
		expect(isKnownUnsupported(1_000 + UNSUPPORTED_TTL_MS)).toBe(false);
	});

	it('clears the verdict when the server answers with an OK envelope', () => {
		recordProbeReply({ status: 404, body: null, isEnvelope: false }, 1_000);
		recordProbeReply({ status: 200, body: { code: 200 }, isEnvelope: true }, 2_000);
		expect(isKnownUnsupported(2_001)).toBe(false);
	});
});

describe('fetchOnDemand', () => {
	beforeEach(() => vi.restoreAllMocks());

	it('adds the key, drops empty params and flags envelopes', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(reply(200, envelope({ list: [] })));
		const result = await fetchOnDemand('services-for-location.json', {
			lat: 47.6,
			lon: -122.3,
			radius: null,
			geometryDetail: ''
		});
		const calledUrl = new URL(fetchMock.mock.calls[0][0]);
		expect(calledUrl.pathname).toBe('/api/ondemand/services-for-location.json');
		expect(calledUrl.searchParams.get('key')).toBe('secret');
		expect(calledUrl.searchParams.get('lat')).toBe('47.6');
		expect(calledUrl.searchParams.has('radius')).toBe(false);
		expect(calledUrl.searchParams.has('geometryDetail')).toBe(false);
		expect(result).toMatchObject({ status: 200, isEnvelope: true });
	});

	it('treats an HTML body as a non-envelope', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, '<html></html>', 'text/html'));
		const result = await fetchOnDemand('services-for-location.json', {});
		expect(result).toEqual({ status: 200, body: null, isEnvelope: false });
	});
});

describe('loadServicesForLocation', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		resetOnDemandSupportForTesting();
		mockPrivateEnv.PRIVATE_OBA_AGENCY_FILTER = '';
	});

	it('returns the body on an OK envelope and records support', async () => {
		const body = envelope({ list: [{ id: '1_a', agencyId: '1' }], references: {} });
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, body));
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'ok', body });
		expect(isKnownUnsupported()).toBe(false);
	});

	it('marks the server unsupported on stock maglev HTML and stops calling upstream', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(reply(200, '<html></html>', 'text/html'));
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'unsupported' });
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'unsupported' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('is a transient error on 5xx and on network failure', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reply(503, 'down', 'text/plain'));
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'error' });
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'error' });
		expect(isKnownUnsupported()).toBe(false);
	});

	it('removes services outside the agency filter', async () => {
		mockPrivateEnv.PRIVATE_OBA_AGENCY_FILTER = '1';
		const body = envelope({
			list: [
				{ id: '1_a', agencyId: '1' },
				{ id: '2_b', agencyId: '2' }
			],
			references: {}
		});
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, body));
		const result = await loadServicesForLocation({ lat: 1, lon: 2 });
		expect(result.body.data.list.map((s) => s.id)).toEqual(['1_a']);
	});
});

describe('loadServiceEntry', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		resetOnDemandSupportForTesting();
		mockPrivateEnv.PRIVATE_OBA_AGENCY_FILTER = '';
	});

	it('encodes the id and passes geometryDetail', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(reply(200, envelope({ entry: { id: '1_a b', agencyId: '1' } })));
		await loadServiceEntry('1_a b', 'simplified');
		const calledUrl = new URL(fetchMock.mock.calls[0][0]);
		expect(calledUrl.pathname).toBe('/api/ondemand/service/1_a%20b.json');
		expect(calledUrl.searchParams.get('geometryDetail')).toBe('simplified');
	});

	it('is not found on 404 without changing the support verdict', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(404, envelope(null, 404)));
		expect(await loadServiceEntry('1_x', null)).toEqual({ kind: 'notFound' });
		expect(isKnownUnsupported()).toBe(false);
	});

	it('is not found when the service belongs to a filtered-out agency', async () => {
		mockPrivateEnv.PRIVATE_OBA_AGENCY_FILTER = '1';
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			reply(200, envelope({ entry: { id: '2_b', agencyId: '2' } }))
		);
		expect(await loadServiceEntry('2_b', null)).toEqual({ kind: 'notFound' });
	});

	it('short-circuits to unsupported once the verdict is known', async () => {
		recordProbeReply({ status: 404, body: null, isEnvelope: false });
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		expect(await loadServiceEntry('1_a', null)).toEqual({ kind: 'unsupported' });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('onDemandResponse', () => {
	it.each([
		[{ kind: 'notFound' }, 404, { error: 'not_found' }],
		[{ kind: 'unsupported' }, 501, { error: 'ondemand_unsupported' }],
		[{ kind: 'error' }, 502, { error: 'upstream_error' }],
		[{ kind: 'ok', body: { code: 200 } }, 200, { code: 200 }]
	])('maps %j to %i', async (result, status, json) => {
		const response = onDemandResponse(result);
		expect(response.status).toBe(status);
		expect(await response.json()).toEqual(json);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/onDemand/upstream.server.test.js`
Expected: FAIL — cannot resolve `$lib/onDemand/upstream.server.js`.

- [ ] **Step 3: Implement `serverSupport.server.js`**

```js
/**
 * Whether this deployment's OBA server serves `/api/ondemand`. One verdict per
 * process: a Wayfinder deployment talks to exactly one OBA server. Only the
 * services-for-location reply is a probe; a 404 for one service id is an
 * ordinary not-found and never reaches here.
 */

/** An unsupported verdict expires so an upgraded server is noticed without a restart. */
export const UNSUPPORTED_TTL_MS = 60 * 60 * 1000;

let verdict = { state: 'unknown', at: 0 };

/**
 * @param {{ status: number, body: any, isEnvelope: boolean }} reply
 * @returns {boolean}
 */
export function isUnsupportedReply(reply) {
	if (reply.status === 404) return true;
	const isSuccess = reply.status >= 200 && reply.status < 300;
	// Stock maglev answers unknown paths with its HTML single-page app and a 200.
	if (isSuccess && !reply.isEnvelope) return true;
	return reply.isEnvelope && reply.body.code === 404;
}

/**
 * @param {{ status: number, body: any, isEnvelope: boolean }} reply
 * @param {number} [nowMs]
 */
export function recordProbeReply(reply, nowMs = Date.now()) {
	if (isUnsupportedReply(reply)) {
		verdict = { state: 'unsupported', at: nowMs };
	} else if (reply.isEnvelope && reply.body.code === 200) {
		verdict = { state: 'supported', at: nowMs };
	}
}

/**
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isKnownUnsupported(nowMs = Date.now()) {
	return verdict.state === 'unsupported' && nowMs - verdict.at < UNSUPPORTED_TTL_MS;
}

export function resetOnDemandSupportForTesting() {
	verdict = { state: 'unknown', at: 0 };
}
```

- [ ] **Step 4: Implement `upstream.server.js`**

```js
import { json } from '@sveltejs/kit';
import { PUBLIC_OBA_SERVER_URL } from '$env/static/public';
import { PRIVATE_OBA_API_KEY } from '$env/static/private';
import { buildURL } from '$lib/urls.js';
import { getAgencyFilter } from '$lib/agencyFilter.js';
import {
	isKnownUnsupported,
	isUnsupportedReply,
	recordProbeReply
} from '$lib/onDemand/serverSupport.server.js';

/**
 * @typedef {{ status: number, body: any, isEnvelope: boolean }} UpstreamReply
 * @typedef {{ kind: 'ok', body: any } | { kind: 'notFound' } | { kind: 'unsupported' } | { kind: 'error' }} OnDemandResult
 */

/**
 * GET a maglev `/api/ondemand/{path}`. Throws only on network failure.
 * @param {string} path - e.g. "services-for-location.json"
 * @param {Record<string, string | number | null | undefined>} params
 * @returns {Promise<UpstreamReply>}
 */
export async function fetchOnDemand(path, params) {
	const query = { key: PRIVATE_OBA_API_KEY };
	for (const [name, value] of Object.entries(params)) {
		if (value != null && value !== '') query[name] = String(value);
	}
	const response = await fetch(buildURL(PUBLIC_OBA_SERVER_URL, `api/ondemand/${path}`, query));
	const body = parseJson(await response.text());
	const isEnvelope = body !== null && typeof body === 'object' && typeof body.code === 'number';
	return { status: response.status, body: isEnvelope ? body : null, isEnvelope };
}

function parseJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/**
 * @param {Record<string, string | number | null | undefined>} params - validated query
 * @returns {Promise<OnDemandResult>}
 */
export async function loadServicesForLocation(params) {
	if (isKnownUnsupported()) return { kind: 'unsupported' };
	const reply = await fetchOrNull('services-for-location.json', params);
	if (!reply) return { kind: 'error' };
	recordProbeReply(reply);
	if (isUnsupportedReply(reply)) return { kind: 'unsupported' };
	if (!isOkEnvelope(reply)) return { kind: 'error' };
	return { kind: 'ok', body: withoutFilteredServices(reply.body) };
}

/**
 * @param {string} id - combined service id
 * @param {string | null} geometryDetail
 * @returns {Promise<OnDemandResult>}
 */
export async function loadServiceEntry(id, geometryDetail) {
	if (isKnownUnsupported()) return { kind: 'unsupported' };
	const reply = await fetchOrNull(`service/${encodeURIComponent(id)}.json`, { geometryDetail });
	if (!reply) return { kind: 'error' };
	const isNotFound = reply.status === 404 || (reply.isEnvelope && reply.body.code === 404);
	if (isNotFound) return { kind: 'notFound' };
	if (!isOkEnvelope(reply)) return { kind: 'error' };
	const agencyIds = getAgencyFilter();
	if (agencyIds && !agencyIds.has(reply.body.data?.entry?.agencyId)) return { kind: 'notFound' };
	return { kind: 'ok', body: reply.body };
}

/**
 * @param {OnDemandResult} result
 * @returns {Response}
 */
export function onDemandResponse(result) {
	switch (result.kind) {
		case 'ok':
			return json(result.body);
		case 'notFound':
			return json({ error: 'not_found' }, { status: 404 });
		case 'unsupported':
			return json({ error: 'ondemand_unsupported' }, { status: 501 });
		default:
			return json({ error: 'upstream_error' }, { status: 502 });
	}
}

async function fetchOrNull(path, params) {
	try {
		return await fetchOnDemand(path, params);
	} catch (error) {
		console.error(`ondemand ${path} request failed:`, error);
		return null;
	}
}

function isOkEnvelope(reply) {
	return reply.isEnvelope && reply.body.code === 200;
}

function withoutFilteredServices(body) {
	const agencyIds = getAgencyFilter();
	if (!agencyIds || !Array.isArray(body.data?.list)) return body;
	const list = body.data.list.filter((service) => agencyIds.has(service.agencyId));
	return { ...body, data: { ...body.data, list } };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/onDemand/upstream.server.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/onDemand src/tests/lib/onDemand
git commit -m "feat(ondemand): fetch maglev ondemand and detect support

Adds the server-side upstream client for /api/ondemand. The
services-for-location reply doubles as the probe: a 404, an HTML 200
or an envelope code 404 marks the server unsupported for an hour so
proxies can answer 501 without calling upstream."
```

---

### Task 2: Proxy routes, parameter validation, agency filter

**Files:**

- Create: `src/lib/onDemand/params.js`
- Create: `src/routes/api/oba/ondemand/services-for-location/+server.js`
- Create: `src/routes/api/oba/ondemand/service/[id]/+server.js`
- Modify: `src/lib/agencyFilter.js` (`filterStops`)
- Test: `src/tests/lib/onDemand/params.test.js`, `src/tests/api/ondemand.test.js`, extend the existing agency filter test (find it with `grep -rl "filterStops" src/tests src/lib/__tests__`), extend `src/tests/api/stops-for-location.test.js`

**Interfaces:**

- Consumes: `loadServicesForLocation`, `loadServiceEntry`, `onDemandResponse` (Task 1).
- Produces:

  - `GEOMETRY_DETAILS = ['none', 'simplified', 'full']`
  - `parseGeometryDetail(value: string|null): { value: string|null } | { error: string }`
  - `parseLocationQuery(searchParams: URLSearchParams): { params: {lat, lon, radius?, latSpan?, lonSpan?, geometryDetail?} } | { error: string }`
  - Routes `GET /api/oba/ondemand/services-for-location` and `GET /api/oba/ondemand/service/[id]` returning the Task 1 status codes; 400 `{ error }` for invalid input.

- [ ] **Step 1: Write the failing tests**

`src/tests/lib/onDemand/params.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseGeometryDetail, parseLocationQuery } from '$lib/onDemand/params.js';

const query = (s) => new URLSearchParams(s);

describe('parseGeometryDetail', () => {
	it('accepts the three levels and absence', () => {
		expect(parseGeometryDetail(null)).toEqual({ value: null });
		for (const level of ['none', 'simplified', 'full']) {
			expect(parseGeometryDetail(level)).toEqual({ value: level });
		}
	});
	it('rejects anything else', () => {
		expect(parseGeometryDetail('bogus')).toHaveProperty('error');
	});
});

describe('parseLocationQuery', () => {
	it('requires finite lat and lon in range', () => {
		expect(parseLocationQuery(query('lon=1'))).toHaveProperty('error');
		expect(parseLocationQuery(query('lat=91&lon=1'))).toHaveProperty('error');
		expect(parseLocationQuery(query('lat=1&lon=abc'))).toHaveProperty('error');
	});
	it('accepts a radius in (0, 20000]', () => {
		expect(parseLocationQuery(query('lat=1&lon=2&radius=500'))).toEqual({
			params: { lat: 1, lon: 2, radius: 500 }
		});
		expect(parseLocationQuery(query('lat=1&lon=2&radius=0'))).toHaveProperty('error');
		expect(parseLocationQuery(query('lat=1&lon=2&radius=20001'))).toHaveProperty('error');
	});
	it('requires both spans, positive', () => {
		expect(
			parseLocationQuery(query('lat=1&lon=2&latSpan=0.1&lonSpan=0.2&geometryDetail=simplified'))
		).toEqual({
			params: { lat: 1, lon: 2, latSpan: 0.1, lonSpan: 0.2, geometryDetail: 'simplified' }
		});
		expect(parseLocationQuery(query('lat=1&lon=2&latSpan=0.1'))).toHaveProperty('error');
		expect(parseLocationQuery(query('lat=1&lon=2&latSpan=-1&lonSpan=1'))).toHaveProperty('error');
	});
	it('rejects an invalid geometryDetail', () => {
		expect(parseLocationQuery(query('lat=1&lon=2&geometryDetail=x'))).toHaveProperty('error');
	});
});
```

`src/tests/api/ondemand.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const upstream = vi.hoisted(() => ({
	loadServicesForLocation: vi.fn(),
	loadServiceEntry: vi.fn()
}));
vi.mock('$lib/onDemand/upstream.server.js', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, ...upstream };
});
vi.mock('$env/static/private', () => ({ PRIVATE_OBA_API_KEY: 'secret' }));

import { GET as servicesForLocation } from '../../routes/api/oba/ondemand/services-for-location/+server.js';
import { GET as service } from '../../routes/api/oba/ondemand/service/[id]/+server.js';

describe('GET /api/oba/ondemand/services-for-location', () => {
	beforeEach(() => vi.clearAllMocks());

	it('400s on invalid input without calling upstream', async () => {
		const response = await servicesForLocation({
			url: new URL('http://x/api/oba/ondemand/services-for-location?lat=abc&lon=1')
		});
		expect(response.status).toBe(400);
		expect(upstream.loadServicesForLocation).not.toHaveBeenCalled();
	});

	it('passes validated params and relays the result', async () => {
		upstream.loadServicesForLocation.mockResolvedValue({ kind: 'unsupported' });
		const response = await servicesForLocation({
			url: new URL(
				'http://x/api/oba/ondemand/services-for-location?lat=1&lon=2&latSpan=0.1&lonSpan=0.2&geometryDetail=simplified'
			)
		});
		expect(upstream.loadServicesForLocation).toHaveBeenCalledWith({
			lat: 1,
			lon: 2,
			latSpan: 0.1,
			lonSpan: 0.2,
			geometryDetail: 'simplified'
		});
		expect(response.status).toBe(501);
	});
});

describe('GET /api/oba/ondemand/service/[id]', () => {
	beforeEach(() => vi.clearAllMocks());

	it('400s on an invalid geometryDetail', async () => {
		const response = await service({
			params: { id: '1_a' },
			url: new URL('http://x/api/oba/ondemand/service/1_a?geometryDetail=huge')
		});
		expect(response.status).toBe(400);
	});

	it('relays a not-found', async () => {
		upstream.loadServiceEntry.mockResolvedValue({ kind: 'notFound' });
		const response = await service({
			params: { id: '1_a' },
			url: new URL('http://x/api/oba/ondemand/service/1_a')
		});
		expect(upstream.loadServiceEntry).toHaveBeenCalledWith('1_a', null);
		expect(response.status).toBe(404);
	});
});
```

Agency filter — add to the existing `filterStops` test file:

```js
it('keeps a flex-only stop whose on-demand service belongs to a target agency', () => {
	const stops = [
		{ id: '1_flex', routeIds: [], onDemandServiceIds: ['1_77652'] },
		{ id: '2_flex', routeIds: [], onDemandServiceIds: ['2_1'] }
	];
	expect(filterStops(stops, new Set(['1'])).map((s) => s.id)).toEqual(['1_flex']);
});
```

Passthrough — add to `src/tests/api/stops-for-location.test.js` (follow its existing SDK mock):

```js
it('passes onDemandServiceIds through untouched', async () => {
	// Arrange the file's existing oba.stops.list mock to return one stop entry that
	// carries onDemandServiceIds: ['1_77652'], then:
	const body = await response.json();
	expect(body.data.list[0].onDemandServiceIds).toEqual(['1_77652']);
});
```

(Write it concretely using that file's existing arrange pattern; the assertion above is the requirement.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/onDemand/params.test.js src/tests/api/ondemand.test.js`
Expected: FAIL — modules missing. The agency filter test fails because the flex-only stop is dropped.

- [ ] **Step 3: Implement `params.js`**

```js
export const GEOMETRY_DETAILS = ['none', 'simplified', 'full'];
export const MAX_RADIUS_METERS = 20000;

/**
 * @param {string | null} value
 * @returns {{ value: string | null } | { error: string }}
 */
export function parseGeometryDetail(value) {
	if (value == null || value === '') return { value: null };
	if (GEOMETRY_DETAILS.includes(value)) return { value };
	return { error: `geometryDetail must be one of ${GEOMETRY_DETAILS.join(', ')}` };
}

/**
 * Validates a services-for-location query: lat/lon required; either a radius or
 * both spans; optional geometryDetail.
 * @param {URLSearchParams} searchParams
 * @returns {{ params: Record<string, number | string> } | { error: string }}
 */
export function parseLocationQuery(searchParams) {
	const lat = finiteNumber(searchParams.get('lat'));
	const lon = finiteNumber(searchParams.get('lon'));
	if (lat == null || lat < -90 || lat > 90) return { error: 'lat must be between -90 and 90' };
	if (lon == null || lon < -180 || lon > 180) return { error: 'lon must be between -180 and 180' };
	const params = { lat, lon };

	const radiusError = addRadius(params, searchParams.get('radius'));
	if (radiusError) return { error: radiusError };
	const spanError = addSpans(params, searchParams.get('latSpan'), searchParams.get('lonSpan'));
	if (spanError) return { error: spanError };

	const detail = parseGeometryDetail(searchParams.get('geometryDetail'));
	if ('error' in detail) return { error: detail.error };
	if (detail.value) params.geometryDetail = detail.value;
	return { params };
}

function addRadius(params, raw) {
	if (raw == null || raw === '') return null;
	const radius = finiteNumber(raw);
	if (radius == null || radius <= 0 || radius > MAX_RADIUS_METERS) {
		return `radius must be greater than 0 and at most ${MAX_RADIUS_METERS}`;
	}
	params.radius = radius;
	return null;
}

function addSpans(params, rawLatSpan, rawLonSpan) {
	const hasLatSpan = rawLatSpan != null && rawLatSpan !== '';
	const hasLonSpan = rawLonSpan != null && rawLonSpan !== '';
	if (!hasLatSpan && !hasLonSpan) return null;
	const latSpan = finiteNumber(rawLatSpan);
	const lonSpan = finiteNumber(rawLonSpan);
	if (latSpan == null || lonSpan == null || latSpan <= 0 || lonSpan <= 0) {
		return 'latSpan and lonSpan must both be positive numbers';
	}
	params.latSpan = latSpan;
	params.lonSpan = lonSpan;
	return null;
}

function finiteNumber(raw) {
	if (raw == null || raw === '') return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}
```

- [ ] **Step 4: Implement the two routes**

`src/routes/api/oba/ondemand/services-for-location/+server.js`:

```js
import { json } from '@sveltejs/kit';
import { parseLocationQuery } from '$lib/onDemand/params.js';
import { loadServicesForLocation, onDemandResponse } from '$lib/onDemand/upstream.server.js';

export async function GET({ url }) {
	const parsed = parseLocationQuery(url.searchParams);
	if ('error' in parsed) return json({ error: parsed.error }, { status: 400 });
	return onDemandResponse(await loadServicesForLocation(parsed.params));
}
```

`src/routes/api/oba/ondemand/service/[id]/+server.js`:

```js
import { json } from '@sveltejs/kit';
import { parseGeometryDetail } from '$lib/onDemand/params.js';
import { loadServiceEntry, onDemandResponse } from '$lib/onDemand/upstream.server.js';

export async function GET({ params, url }) {
	const detail = parseGeometryDetail(url.searchParams.get('geometryDetail'));
	if ('error' in detail) return json({ error: detail.error }, { status: 400 });
	return onDemandResponse(await loadServiceEntry(params.id, detail.value));
}
```

- [ ] **Step 5: Update `filterStops` in `src/lib/agencyFilter.js`**

Replace the body's filter callback and update the JSDoc param type to `Array<{routeIds?: string[], onDemandServiceIds?: string[]}>`:

```js
return stops.filter((stop) => {
	// On-demand service ids share the route id's agency prefix, so a flex-only
	// stop (no routeIds) is kept when its service belongs to a target agency.
	const ids = [...(stop.routeIds ?? []), ...(stop.onDemandServiceIds ?? [])];
	return ids.some((id) => routeBelongsToAgency(id, agencyIds));
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/onDemand src/tests/api`
Expected: PASS (including all pre-existing API tests).

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/lib/onDemand/params.js src/routes/api/oba/ondemand src/lib/agencyFilter.js src/tests
git commit -m "feat(ondemand): proxy ondemand endpoints

Adds /api/oba/ondemand/services-for-location and service/[id]
proxies with input validation. The agency filter now keeps flex-only
stops, which have no routeIds but do carry onDemandServiceIds."
```

---

### Task 3: Models, service details and test fixtures

**Files:**

- Create: `src/lib/onDemand/models.js`
- Create: `src/lib/onDemand/serviceDetails.js`
- Create: `src/tests/fixtures/onDemand.js`
- Test: `src/tests/lib/onDemand/models.test.js`, `src/tests/lib/onDemand/serviceDetails.test.js`

**Interfaces:**

- Produces (`models.js`):
  - Typedefs `OnDemandService { id, agencyId, routeId, name, description, url, serviceKind, matchReason, rules: AvailabilityRule[], agency: object|null, route: object|null, refs: OnDemandRefs }`, `AvailabilityRule { fromIds, toIds, startPickupTime, endPickupTime, endDropOffTime, calendarIds, pickupType, dropOffType, pickupBookingRuleId, dropOffBookingRuleId, safeDurationFactor, safeDurationOffset }`, `OnDemandRefs { agencies, routes, stops, serviceAreas, locationGroups, bookingRules, calendars }` (each a `Map<id, object>`).
  - Booking rules keep wire field names (`bookingType`, `priorNoticeDurationMin`, `priorNoticeDurationMax`, `priorNoticeLastDay`, `priorNoticeLastTime`, `priorNoticeStartDay`, `priorNoticeStartTime`, `priorNoticeCalendarId`, `message`, `pickupMessage`, `dropOffMessage`, `phoneNumber`, `infoUrl`, `bookingUrl`). `bookingType` is the wire integer, or `null` when not an integer.
  - Calendars keep wire shape `{ id, days: string[], startDate: string|null, endDate: string|null, exceptedDates: string[] }`.
  - `parseServiceList(body) → { services: OnDemandService[], outOfRange: boolean, refs: OnDemandRefs }`
  - `parseServiceEntry(body) → { service: OnDemandService, refs: OnDemandRefs }`
  - `onDemandServiceIds(entity) → string[]`
  - `resolvePickupBookingRule(service, rule) → { bookingRule: object|null, dangling: boolean }`
  - `contactBookingRule(service) → object|null`
  - `serviceCalendars(service) → Calendar[]` (the calendars the rules reference)
  - `drawableAreas(service) → ServiceArea[]` (referenced by any rule's fromIds/toIds and having `geometry`)
- Produces (`serviceDetails.js`):
  - `whereSummary(service) → { show: boolean, serviceAreaNames: string[], serviceAreaCount: number, dropOffNames: string[] | null }`
  - `serviceBounds(service) → { north, south, east, west } | null` (union of the bbox of every referenced service area)
- Produces (`src/tests/fixtures/onDemand.js`): `envelope`, `bookingRuleJson`, `ruleJson`, `serviceJson`, `referencesJson`, `entryBody`, `listBody`, `parsedService`.

- [ ] **Step 1: Create the fixture builders**

`src/tests/fixtures/onDemand.js`:

```js
import { parseServiceEntry } from '$lib/onDemand/models.js';

export const envelope = (data, code = 200) => ({
	code,
	currentTime: 0,
	text: 'OK',
	version: 2,
	data
});

export const square = (west, south, east, north) => ({
	type: 'Polygon',
	coordinates: [
		[
			[west, south],
			[east, south],
			[east, north],
			[west, north],
			[west, south]
		]
	]
});

/** Alexandria-style prior-day booking: book by 17:00 the day before, opens 14 days out. */
export function bookingRuleJson(overrides = {}) {
	return {
		id: 'br_prior',
		bookingType: 2,
		priorNoticeDurationMin: null,
		priorNoticeDurationMax: null,
		priorNoticeLastDay: 1,
		priorNoticeLastTime: '17:00:00',
		priorNoticeStartDay: 14,
		priorNoticeStartTime: '00:00:00',
		priorNoticeCalendarId: null,
		message: 'Call to book your ride.',
		pickupMessage: null,
		dropOffMessage: null,
		phoneNumber: '703-746-5222',
		infoUrl: null,
		bookingUrl: null,
		...overrides
	};
}

export function ruleJson(overrides = {}) {
	return {
		fromIds: ['zone_a'],
		toIds: ['zone_a'],
		startPickupTime: '05:00:00',
		endPickupTime: '24:50:00',
		endDropOffTime: null,
		calendarIds: ['cal_mon_sat'],
		pickupType: 2,
		dropOffType: 2,
		pickupBookingRuleId: 'br_prior',
		dropOffBookingRuleId: null,
		safeDurationFactor: null,
		safeDurationOffset: null,
		...overrides
	};
}

export function serviceJson(overrides = {}) {
	return {
		id: '5088_77652',
		agencyId: '5088',
		routeId: '5088_77652',
		name: 'DASH On Demand',
		description: null,
		url: 'https://dashbus.com/ondemand',
		serviceKind: 'zone',
		rules: [ruleJson()],
		...overrides
	};
}

export function referencesJson(overrides = {}) {
	return {
		agencies: [{ id: '5088', name: 'DASH', timezone: 'America/Los_Angeles' }],
		routes: [{ id: '5088_77652', agencyId: '5088', shortName: 'OD', color: '0072CE' }],
		stops: [],
		trips: [],
		stopTimes: [],
		situations: [],
		serviceAreas: [
			{
				id: 'zone_a',
				name: 'West End',
				bbox: [-77.14, 38.79, -77.05, 38.84],
				geometry: square(-77.14, 38.79, -77.05, 38.84)
			}
		],
		locationGroups: [],
		bookingRules: [bookingRuleJson()],
		calendars: [
			{
				id: 'cal_mon_sat',
				days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
				startDate: '2025-12-01',
				endDate: '2026-12-01',
				exceptedDates: []
			}
		],
		...overrides
	};
}

export const entryBody = (service = serviceJson(), references = referencesJson()) =>
	envelope({ entry: service, references });

export const listBody = (services = [serviceJson()], references = referencesJson(), extra = {}) =>
	envelope({ limitExceeded: false, outOfRange: false, list: services, references, ...extra });

export const parsedService = (serviceOverrides = {}, referenceOverrides = {}) =>
	parseServiceEntry(entryBody(serviceJson(serviceOverrides), referencesJson(referenceOverrides)))
		.service;
```

- [ ] **Step 2: Write the failing tests**

`src/tests/lib/onDemand/models.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
	parseServiceEntry,
	parseServiceList,
	onDemandServiceIds,
	resolvePickupBookingRule,
	contactBookingRule,
	serviceCalendars,
	drawableAreas
} from '$lib/onDemand/models.js';
import {
	entryBody,
	listBody,
	serviceJson,
	referencesJson,
	ruleJson,
	bookingRuleJson,
	parsedService,
	envelope
} from '../../fixtures/onDemand.js';

describe('parseServiceEntry', () => {
	it('joins the service to its agency and route', () => {
		const { service } = parseServiceEntry(entryBody());
		expect(service.agency.timezone).toBe('America/Los_Angeles');
		expect(service.route.color).toBe('0072CE');
		expect(service.rules[0].calendarIds).toEqual(['cal_mon_sat']);
	});

	it('maps unknown enum values to unknown and never throws on missing references', () => {
		const body = envelope({
			entry: serviceJson({ serviceKind: 'hovercraft', rules: undefined }),
			references: {}
		});
		const { service, refs } = parseServiceEntry(body);
		expect(service.serviceKind).toBe('unknown');
		expect(service.rules).toEqual([]);
		expect(service.agency).toBeNull();
		expect(refs.bookingRules.size).toBe(0);
	});

	it('keeps an out-of-range bookingType as data but nulls a non-integer one', () => {
		const refs = referencesJson({
			bookingRules: [
				bookingRuleJson({ bookingType: 7 }),
				bookingRuleJson({ id: 'x', bookingType: 'a' })
			]
		});
		const { refs: parsed } = parseServiceEntry(entryBody(serviceJson(), refs));
		expect(parsed.bookingRules.get('br_prior').bookingType).toBe(7);
		expect(parsed.bookingRules.get('x').bookingType).toBeNull();
	});
});

describe('parseServiceList', () => {
	it('shares one reference index across services and reports outOfRange', () => {
		const second = serviceJson({ id: '5088_2', routeId: null, name: 'Second' });
		const { services, outOfRange, refs } = parseServiceList(
			listBody([serviceJson(), second], referencesJson(), { outOfRange: true })
		);
		expect(services.map((s) => s.id)).toEqual(['5088_77652', '5088_2']);
		expect(services[1].route).toBeNull();
		expect(services[0].refs).toBe(refs);
		expect(outOfRange).toBe(true);
	});

	it('maps an unknown matchReason to unknown', () => {
		const { services } = parseServiceList(listBody([serviceJson({ matchReason: 'telepathy' })]));
		expect(services[0].matchReason).toBe('unknown');
	});
});

describe('lookups', () => {
	it('onDemandServiceIds defaults to an empty list', () => {
		expect(onDemandServiceIds({})).toEqual([]);
		expect(onDemandServiceIds(null)).toEqual([]);
		expect(onDemandServiceIds({ onDemandServiceIds: ['1_a'] })).toEqual(['1_a']);
	});

	it('resolvePickupBookingRule distinguishes none from dangling', () => {
		const service = parsedService({
			rules: [
				ruleJson({ pickupBookingRuleId: null }),
				ruleJson({ pickupBookingRuleId: 'missing' }),
				ruleJson()
			]
		});
		expect(resolvePickupBookingRule(service, service.rules[0])).toEqual({
			bookingRule: null,
			dangling: false
		});
		expect(resolvePickupBookingRule(service, service.rules[1])).toEqual({
			bookingRule: null,
			dangling: true
		});
		expect(resolvePickupBookingRule(service, service.rules[2]).bookingRule.id).toBe('br_prior');
	});

	it('contactBookingRule prefers the first rule with a resolvable pickup rule', () => {
		const service = parsedService({
			rules: [ruleJson({ pickupBookingRuleId: null }), ruleJson()]
		});
		expect(contactBookingRule(service).phoneNumber).toBe('703-746-5222');
	});

	it('contactBookingRule falls back to the first booking rule in references', () => {
		const service = parsedService({ rules: [ruleJson({ pickupBookingRuleId: null })] });
		expect(contactBookingRule(service).id).toBe('br_prior');
	});

	it('serviceCalendars returns only the calendars the rules reference', () => {
		const refs = referencesJson({
			calendars: [
				...referencesJson().calendars,
				{ id: 'other', days: ['sun'], startDate: null, endDate: null, exceptedDates: [] }
			]
		});
		const service = parsedService({}, refs);
		expect(serviceCalendars(service).map((c) => c.id)).toEqual(['cal_mon_sat']);
	});

	it('drawableAreas skips areas without geometry and unreferenced areas', () => {
		const refs = referencesJson({
			serviceAreas: [
				{ ...referencesJson().serviceAreas[0] },
				{ id: 'zone_b', name: 'No geometry', bbox: [0, 0, 1, 1] },
				{
					id: 'zone_c',
					name: 'Unreferenced',
					bbox: [0, 0, 1, 1],
					geometry: { type: 'Polygon', coordinates: [] }
				}
			]
		});
		const service = parsedService({ rules: [ruleJson({ toIds: ['zone_b'] })] }, refs);
		expect(drawableAreas(service).map((a) => a.id)).toEqual(['zone_a']);
	});
});
```

`src/tests/lib/onDemand/serviceDetails.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { whereSummary, serviceBounds } from '$lib/onDemand/serviceDetails.js';
import { parsedService, referencesJson, ruleJson, square } from '../../fixtures/onDemand.js';

const twoZones = referencesJson({
	serviceAreas: [
		{
			id: 'zone_a',
			name: 'West End',
			bbox: [-77.14, 38.79, -77.05, 38.84],
			geometry: square(-77.14, 38.79, -77.05, 38.84)
		},
		{
			id: 'zone_b',
			name: null,
			bbox: [-77.2, 38.7, -77.1, 38.8],
			geometry: square(-77.2, 38.7, -77.1, 38.8)
		}
	],
	locationGroups: [{ id: 'grp', name: 'Hospitals', stopIds: ['s1'] }]
});

describe('whereSummary', () => {
	it('is hidden for a single-area zone service', () => {
		expect(whereSummary(parsedService()).show).toBe(false);
	});

	it('shows zone-to-zone drop-off names and counts unnamed areas', () => {
		const service = parsedService(
			{ rules: [ruleJson({ fromIds: ['zone_a'], toIds: ['zone_b', 'grp'] })] },
			twoZones
		);
		expect(whereSummary(service)).toEqual({
			show: true,
			serviceAreaNames: ['West End'],
			serviceAreaCount: 1,
			dropOffNames: ['Hospitals']
		});
	});

	it('shows for a multi-area service with identical from and to', () => {
		const service = parsedService(
			{ rules: [ruleJson({ fromIds: ['zone_a', 'zone_b'], toIds: ['zone_b', 'zone_a'] })] },
			twoZones
		);
		const summary = whereSummary(service);
		expect(summary.show).toBe(true);
		expect(summary.serviceAreaCount).toBe(2);
		expect(summary.dropOffNames).toBeNull();
	});
});

describe('serviceBounds', () => {
	it('unions the bboxes of the referenced areas', () => {
		const service = parsedService(
			{ rules: [ruleJson({ fromIds: ['zone_a'], toIds: ['zone_b'] })] },
			twoZones
		);
		expect(serviceBounds(service)).toEqual({
			west: -77.2,
			south: 38.7,
			east: -77.05,
			north: 38.84
		});
	});

	it('is null when no area has a bbox', () => {
		expect(serviceBounds(parsedService({}, referencesJson({ serviceAreas: [] })))).toBeNull();
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/onDemand/models.test.js src/tests/lib/onDemand/serviceDetails.test.js`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement `models.js`**

```js
/**
 * Parsing for maglev's /api/ondemand responses. Parsing never throws on
 * well-formed JSON: unknown enum values become 'unknown', missing arrays become
 * [], missing scalars become null. Services are joined with their references so
 * later code needs no lookups beyond `service.refs`.
 */

const SERVICE_KINDS = new Set(['zone', 'zoneToZone', 'stopGroup', 'deviatedRoute']);
const MATCH_REASONS = new Set([
	'areaContainsPoint',
	'stopWithinRadius',
	'areaNearby',
	'areaIntersectsViewport',
	'stopWithinViewport'
]);

/**
 * @typedef {Object} OnDemandRefs
 * @property {Map<string, any>} agencies
 * @property {Map<string, any>} routes
 * @property {Map<string, any>} stops
 * @property {Map<string, any>} serviceAreas
 * @property {Map<string, any>} locationGroups
 * @property {Map<string, any>} bookingRules
 * @property {Map<string, any>} calendars
 */

/**
 * @typedef {Object} AvailabilityRule
 * @property {string[]} fromIds
 * @property {string[]} toIds
 * @property {string | null} startPickupTime
 * @property {string | null} endPickupTime
 * @property {string | null} endDropOffTime
 * @property {string[]} calendarIds
 * @property {number | null} pickupType
 * @property {number | null} dropOffType
 * @property {string | null} pickupBookingRuleId
 * @property {string | null} dropOffBookingRuleId
 * @property {number | null} safeDurationFactor
 * @property {number | null} safeDurationOffset
 */

/**
 * @typedef {Object} OnDemandService
 * @property {string} id
 * @property {string} agencyId
 * @property {string | null} routeId
 * @property {string} name
 * @property {string | null} description
 * @property {string | null} url
 * @property {string} serviceKind
 * @property {string | null} matchReason
 * @property {AvailabilityRule[]} rules
 * @property {any | null} agency
 * @property {any | null} route
 * @property {OnDemandRefs} refs
 */

const arrayOr = (value) => (Array.isArray(value) ? value : []);
const orNull = (value) => value ?? null;
const indexById = (items) => new Map(arrayOr(items).map((item) => [item.id, item]));

/**
 * @param {any} raw - `data.references`
 * @returns {OnDemandRefs}
 */
export function parseReferences(raw) {
	const references = raw ?? {};
	return {
		agencies: indexById(references.agencies),
		routes: indexById(references.routes),
		stops: indexById(references.stops),
		serviceAreas: indexById(arrayOr(references.serviceAreas).map(parseServiceArea)),
		locationGroups: indexById(
			arrayOr(references.locationGroups).map((group) => ({
				id: group.id,
				name: orNull(group.name),
				stopIds: arrayOr(group.stopIds)
			}))
		),
		bookingRules: indexById(arrayOr(references.bookingRules).map(parseBookingRule)),
		calendars: indexById(arrayOr(references.calendars).map(parseCalendar))
	};
}

function parseServiceArea(area) {
	return {
		id: area.id,
		name: orNull(area.name),
		description: orNull(area.description),
		bbox: Array.isArray(area.bbox) && area.bbox.length === 4 ? area.bbox : null,
		geometry: orNull(area.geometry),
		distanceToArea: orNull(area.distanceToArea),
		nearestPointOnBoundary: orNull(area.nearestPointOnBoundary)
	};
}

function parseBookingRule(rule) {
	return {
		id: rule.id,
		bookingType: Number.isInteger(rule.bookingType) ? rule.bookingType : null,
		priorNoticeDurationMin: orNull(rule.priorNoticeDurationMin),
		priorNoticeDurationMax: orNull(rule.priorNoticeDurationMax),
		priorNoticeLastDay: orNull(rule.priorNoticeLastDay),
		priorNoticeLastTime: orNull(rule.priorNoticeLastTime),
		priorNoticeStartDay: orNull(rule.priorNoticeStartDay),
		priorNoticeStartTime: orNull(rule.priorNoticeStartTime),
		priorNoticeCalendarId: orNull(rule.priorNoticeCalendarId),
		message: orNull(rule.message),
		pickupMessage: orNull(rule.pickupMessage),
		dropOffMessage: orNull(rule.dropOffMessage),
		phoneNumber: orNull(rule.phoneNumber),
		infoUrl: orNull(rule.infoUrl),
		bookingUrl: orNull(rule.bookingUrl)
	};
}

function parseCalendar(calendar) {
	return {
		id: calendar.id,
		days: arrayOr(calendar.days),
		startDate: orNull(calendar.startDate),
		endDate: orNull(calendar.endDate),
		exceptedDates: arrayOr(calendar.exceptedDates)
	};
}

/** @returns {AvailabilityRule} */
function parseRule(rule) {
	return {
		fromIds: arrayOr(rule.fromIds),
		toIds: arrayOr(rule.toIds),
		startPickupTime: orNull(rule.startPickupTime),
		endPickupTime: orNull(rule.endPickupTime),
		endDropOffTime: orNull(rule.endDropOffTime),
		calendarIds: arrayOr(rule.calendarIds),
		pickupType: orNull(rule.pickupType),
		dropOffType: orNull(rule.dropOffType),
		pickupBookingRuleId: orNull(rule.pickupBookingRuleId),
		dropOffBookingRuleId: orNull(rule.dropOffBookingRuleId),
		safeDurationFactor: orNull(rule.safeDurationFactor),
		safeDurationOffset: orNull(rule.safeDurationOffset)
	};
}

/**
 * @param {any} raw
 * @param {OnDemandRefs} refs
 * @returns {OnDemandService}
 */
function parseService(raw, refs) {
	const routeId = orNull(raw.routeId);
	return {
		id: raw.id,
		agencyId: raw.agencyId,
		routeId,
		name: raw.name ?? raw.id,
		description: orNull(raw.description),
		url: orNull(raw.url),
		serviceKind: SERVICE_KINDS.has(raw.serviceKind) ? raw.serviceKind : 'unknown',
		matchReason:
			raw.matchReason == null
				? null
				: MATCH_REASONS.has(raw.matchReason)
					? raw.matchReason
					: 'unknown',
		rules: arrayOr(raw.rules).map(parseRule),
		agency: refs.agencies.get(raw.agencyId) ?? null,
		route: routeId ? (refs.routes.get(routeId) ?? null) : null,
		refs
	};
}

/**
 * @param {any} body - services-for-location response envelope
 * @returns {{ services: OnDemandService[], outOfRange: boolean, refs: OnDemandRefs }}
 */
export function parseServiceList(body) {
	const data = body?.data ?? {};
	const refs = parseReferences(data.references);
	return {
		services: arrayOr(data.list).map((raw) => parseService(raw, refs)),
		outOfRange: data.outOfRange === true,
		refs
	};
}

/**
 * @param {any} body - service/{id} response envelope
 * @returns {{ service: OnDemandService, refs: OnDemandRefs }}
 */
export function parseServiceEntry(body) {
	const data = body?.data ?? {};
	const refs = parseReferences(data.references);
	return { service: parseService(data.entry ?? {}, refs), refs };
}

/**
 * @param {{ onDemandServiceIds?: string[] } | null | undefined} entity - a stop or route
 * @returns {string[]}
 */
export function onDemandServiceIds(entity) {
	return arrayOr(entity?.onDemandServiceIds);
}

/**
 * A null id means no booking is needed; a non-null id that references carry no
 * rule for is dangling, which the booking logic treats as unknown.
 * @param {OnDemandService} service
 * @param {AvailabilityRule} rule
 * @returns {{ bookingRule: any | null, dangling: boolean }}
 */
export function resolvePickupBookingRule(service, rule) {
	if (rule.pickupBookingRuleId == null) return { bookingRule: null, dangling: false };
	const bookingRule = service.refs.bookingRules.get(rule.pickupBookingRuleId) ?? null;
	return { bookingRule, dangling: bookingRule == null };
}

/**
 * The booking rule whose phone, URLs and messages the UI shows: the pickup rule
 * of the first availability rule that has one, else the first in references.
 * @param {OnDemandService} service
 */
export function contactBookingRule(service) {
	for (const rule of service.rules) {
		const { bookingRule } = resolvePickupBookingRule(service, rule);
		if (bookingRule) return bookingRule;
	}
	return service.refs.bookingRules.values().next().value ?? null;
}

/**
 * @param {OnDemandService} service
 * @returns {Array<{ id: string, days: string[], startDate: string | null, endDate: string | null, exceptedDates: string[] }>}
 */
export function serviceCalendars(service) {
	const ids = new Set(service.rules.flatMap((rule) => rule.calendarIds));
	return [...ids].map((id) => service.refs.calendars.get(id)).filter(Boolean);
}

/**
 * @param {OnDemandService} service
 * @returns {string[]} ids from every rule's fromIds and toIds, first-seen order
 */
export function referencedLocationIds(service) {
	return [...new Set(service.rules.flatMap((rule) => [...rule.fromIds, ...rule.toIds]))];
}

/**
 * @param {OnDemandService} service
 */
export function drawableAreas(service) {
	return referencedLocationIds(service)
		.map((id) => service.refs.serviceAreas.get(id))
		.filter((area) => area?.geometry);
}
```

- [ ] **Step 5: Implement `serviceDetails.js`**

```js
import { referencedLocationIds } from '$lib/onDemand/models.js';

/**
 * What the detail sheet's "Where" section shows. It is shown when the service
 * spans several areas or some rule drops off somewhere other than it picks up.
 * @param {import('./models.js').OnDemandService} service
 * @returns {{ show: boolean, serviceAreaNames: string[], serviceAreaCount: number, dropOffNames: string[] | null }}
 */
export function whereSummary(service) {
	const { refs } = service;
	const fromIds = unique(service.rules.flatMap((rule) => rule.fromIds));
	const areaCount = referencedLocationIds(service).filter((id) => refs.serviceAreas.has(id)).length;
	const differingRules = service.rules.filter((rule) => !sameSet(rule.fromIds, rule.toIds));

	const serviceAreaNames = fromIds
		.map((id) => refs.serviceAreas.get(id)?.name ?? refs.locationGroups.get(id)?.name ?? null)
		.filter(Boolean);
	const dropOffNames = differingRules.length
		? unique(differingRules.flatMap((rule) => rule.toIds))
				.map(
					(id) =>
						refs.serviceAreas.get(id)?.name ??
						refs.locationGroups.get(id)?.name ??
						refs.stops.get(id)?.name ??
						null
				)
				.filter(Boolean)
		: null;

	return {
		show: areaCount > 1 || differingRules.length > 0,
		serviceAreaNames,
		serviceAreaCount: fromIds.length,
		dropOffNames
	};
}

/**
 * @param {import('./models.js').OnDemandService} service
 * @returns {{ north: number, south: number, east: number, west: number } | null}
 */
export function serviceBounds(service) {
	const boxes = referencedLocationIds(service)
		.map((id) => service.refs.serviceAreas.get(id)?.bbox)
		.filter(Boolean);
	if (!boxes.length) return null;
	return {
		west: Math.min(...boxes.map((box) => box[0])),
		south: Math.min(...boxes.map((box) => box[1])),
		east: Math.max(...boxes.map((box) => box[2])),
		north: Math.max(...boxes.map((box) => box[3]))
	};
}

function unique(values) {
	return [...new Set(values)];
}

function sameSet(a, b) {
	const setA = new Set(a);
	const setB = new Set(b);
	return setA.size === setB.size && [...setA].every((value) => setB.has(value));
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/onDemand`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/lib/onDemand/models.js src/lib/onDemand/serviceDetails.js src/tests/fixtures/onDemand.js src/tests/lib/onDemand
git commit -m "feat(ondemand): parse on-demand services

Parses ondemand envelopes into services joined with their references,
tolerating unknown enum values and missing fields so a newer server
never breaks the page."
```

---

### Task 4: Booking-deadline evaluator and shared vectors

**Files:**

- Create: `src/lib/onDemand/instants.js`
- Create: `src/lib/onDemand/bookingDeadline.js`
- Create: `src/tests/fixtures/flex-booking-vectors.json` (byte-for-byte copy)
- Test: `src/tests/lib/onDemand/bookingDeadline.test.js`, `src/tests/lib/onDemand/instants.test.js`

**Interfaces:**

- Produces (`instants.js`): `compareInstants(a, b)`, `minInstant(list)` (ignores nulls; null when empty), `earliestAfter(list, now)` (earliest non-null instant strictly after `now`, or null), `scheduleAt(instant, callback, nowMs?) → cancel()` (fires at `instant + 1 s`, clamped to `[0, 2^31 − 1]` ms; a null instant schedules nothing).
- Produces (`bookingDeadline.js`):

  - `LOOKAHEAD_DAYS = 400`
  - `parseGtfsTime(value: string|null) → number|null` (seconds; may exceed 86400)
  - `createEvaluator(timeZone: string, calendars: Calendar[]) → Evaluator` with:
    - `timeZone`
    - `anchor(date: Temporal.PlainDate) → Temporal.Instant`
    - `instant(date, seconds) → Temporal.Instant`
    - `serviceDate(now: Temporal.Instant) → Temporal.PlainDate`
    - `isActive(calendarId, date) → boolean`, `isRuleActive(rule, date) → boolean`, `hasUsableCalendar(rule) → boolean`
    - `countBack(date, count, calendarId|null) → Temporal.PlainDate|null`
    - `evaluate(rule, bookingRule|null, date, now) → { state: 'notYetOpen'|'open'|'closedForDate'|'unknown', cutoffInstant: Instant|null, openInstant: Instant|null }`
    - `walkServiceDates(rule, bookingRule|null, now, visit(date, evaluation) → boolean)` (visit returns `false` to stop)
    - `nextBookableServiceDate(rule, bookingRule|null, now) → Temporal.PlainDate|null`

- [ ] **Step 1: Copy the vectors**

```bash
cp /Users/aaron/repos/onebusaway/maglev/testdata/flex-booking-vectors.json src/tests/fixtures/flex-booking-vectors.json
cmp /Users/aaron/repos/onebusaway/maglev/testdata/flex-booking-vectors.json src/tests/fixtures/flex-booking-vectors.json
```

Add the fixture path to `.prettierignore` (create the entry if the file exists; check with `cat .prettierignore`) so formatting never rewrites the mirror.

- [ ] **Step 2: Write the failing tests**

`src/tests/lib/onDemand/bookingDeadline.test.js`:

```js
import { describe, it, expect } from 'vitest';
import vectors from '../../fixtures/flex-booking-vectors.json';
import { createEvaluator, parseGtfsTime, LOOKAHEAD_DAYS } from '$lib/onDemand/bookingDeadline.js';

const instantOrNull = (value) => (value ? Temporal.Instant.from(value) : null);
const sameInstant = (actual, expected) =>
	expected == null ? actual === null : actual !== null && actual.equals(expected);

describe('booking-deadline vectors (mirrors maglev testdata/flex-booking-vectors.json)', () => {
	it('has all 22 vectors', () => {
		expect(vectors.vectors).toHaveLength(22);
	});

	for (const vector of vectors.vectors) {
		it(vector.name, () => {
			const evaluator = createEvaluator(vector.timezone ?? vectors.timezone, vectors.calendars);
			const now = Temporal.Instant.from(vector.now);
			const travelDate = Temporal.PlainDate.from(vector.travelDate);
			const result = evaluator.evaluate(vector.rule, vector.bookingRule, travelDate, now);

			expect(result.state).toBe(vector.expected.state);
			expect(sameInstant(result.cutoffInstant, instantOrNull(vector.expected.cutoffInstant))).toBe(
				true
			);
			expect(sameInstant(result.openInstant, instantOrNull(vector.expected.openInstant))).toBe(
				true
			);
			const next = evaluator.nextBookableServiceDate(vector.rule, vector.bookingRule, now);
			expect(next?.toString() ?? null).toBe(vector.expected.nextBookableServiceDate);
		});
	}
});

describe('parseGtfsTime', () => {
	it('parses times past 24:00 and rejects junk', () => {
		expect(parseGtfsTime('24:50:00')).toBe(89400);
		expect(parseGtfsTime('7:05:09')).toBe(25509);
		expect(parseGtfsTime(null)).toBeNull();
		expect(parseGtfsTime('noon')).toBeNull();
	});
});

describe('countBack', () => {
	const weekdays = {
		id: 'wk',
		days: ['mon', 'tue', 'wed', 'thu', 'fri'],
		startDate: '2026-01-01',
		endDate: '2026-12-31',
		exceptedDates: []
	};
	const date = (s) => Temporal.PlainDate.from(s);

	it('returns the date itself for zero', () => {
		const evaluator = createEvaluator('America/Detroit', [weekdays]);
		expect(evaluator.countBack(date('2026-03-16'), 0, 'wk').toString()).toBe('2026-03-16');
	});

	it('counts civil days with no calendar, or a calendar references do not carry', () => {
		const evaluator = createEvaluator('America/Detroit', [weekdays]);
		expect(evaluator.countBack(date('2026-03-16'), 2, null).toString()).toBe('2026-03-14');
		expect(evaluator.countBack(date('2026-03-16'), 2, 'absent').toString()).toBe('2026-03-14');
	});

	it('is null for an unparseable startDate or a calendar with no days', () => {
		const evaluator = createEvaluator('America/Detroit', [
			{ ...weekdays, id: 'bad', startDate: 'soon' },
			{ ...weekdays, id: 'empty', days: [] }
		]);
		expect(evaluator.countBack(date('2026-03-16'), 1, 'bad')).toBeNull();
		expect(evaluator.countBack(date('2026-03-16'), 1, 'empty')).toBeNull();
	});

	it('succeeds on exactly the 400th day back and fails beyond it', () => {
		const evaluator = createEvaluator('America/Detroit', [
			{
				id: 'every',
				days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
				startDate: '2020-01-01',
				endDate: '2030-01-01',
				exceptedDates: []
			}
		]);
		const travel = date('2026-03-16');
		expect(evaluator.countBack(travel, LOOKAHEAD_DAYS, 'every').toString()).toBe(
			travel.subtract({ days: LOOKAHEAD_DAYS }).toString()
		);
		expect(evaluator.countBack(travel, LOOKAHEAD_DAYS + 1, 'every')).toBeNull();
	});
});

describe('evaluate', () => {
	it('is unknown for a booking type outside 0-2', () => {
		const evaluator = createEvaluator('America/Detroit', vectors.calendars);
		const rule = {
			startPickupTime: '05:30:00',
			endPickupTime: '18:00:00',
			calendarIds: ['MC_mon-tues-wed-thurs-fri']
		};
		const result = evaluator.evaluate(
			rule,
			{ bookingType: 7 },
			Temporal.PlainDate.from('2026-03-11'),
			Temporal.Now.instant()
		);
		expect(result).toEqual({ state: 'unknown', cutoffInstant: null, openInstant: null });
	});
});
```

`src/tests/lib/onDemand/instants.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { minInstant, earliestAfter, scheduleAt } from '$lib/onDemand/instants.js';

const at = (s) => Temporal.Instant.from(s);

describe('instants', () => {
	afterEach(() => vi.useRealTimers());

	it('minInstant ignores nulls', () => {
		expect(minInstant([null, at('2026-03-11T10:00Z'), at('2026-03-11T09:00Z')]).toString()).toBe(
			'2026-03-11T09:00:00Z'
		);
		expect(minInstant([null])).toBeNull();
	});

	it('earliestAfter skips instants at or before now', () => {
		const now = at('2026-03-11T10:00Z');
		expect(
			earliestAfter([now, at('2026-03-11T09:00Z'), at('2026-03-11T11:00Z')], now).toString()
		).toBe('2026-03-11T11:00:00Z');
		expect(earliestAfter([now], now)).toBeNull();
	});

	it('scheduleAt fires one second after the instant and can be cancelled', () => {
		vi.useFakeTimers();
		const callback = vi.fn();
		const nowMs = Date.now();
		const cancel = scheduleAt(
			Temporal.Instant.fromEpochMilliseconds(nowMs + 5_000),
			callback,
			nowMs
		);
		vi.advanceTimersByTime(5_999);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledTimes(1);
		cancel();
		const second = vi.fn();
		scheduleAt(null, second)();
		vi.runAllTimers();
		expect(second).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/onDemand/bookingDeadline.test.js src/tests/lib/onDemand/instants.test.js`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement `instants.js`**

```js
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const REFRESH_SLACK_MS = 1000;

/**
 * @param {Temporal.Instant} a
 * @param {Temporal.Instant} b
 */
export function compareInstants(a, b) {
	return Temporal.Instant.compare(a, b);
}

/**
 * @param {Array<Temporal.Instant | null | undefined>} instants
 * @returns {Temporal.Instant | null}
 */
export function minInstant(instants) {
	let best = null;
	for (const candidate of instants) {
		if (candidate && (!best || compareInstants(candidate, best) < 0)) best = candidate;
	}
	return best;
}

/**
 * @param {Array<Temporal.Instant | null | undefined>} instants
 * @param {Temporal.Instant} now
 * @returns {Temporal.Instant | null}
 */
export function earliestAfter(instants, now) {
	return minInstant(
		instants.filter((candidate) => candidate && compareInstants(candidate, now) > 0)
	);
}

/**
 * Runs `callback` one second after `instant`, so status re-evaluates once the
 * boundary has safely passed. Returns a cancel function.
 * @param {Temporal.Instant | null} instant
 * @param {() => void} callback
 * @param {number} [nowMs]
 * @returns {() => void}
 */
export function scheduleAt(instant, callback, nowMs = Date.now()) {
	if (!instant) return () => {};
	const delay = instant.epochMilliseconds - nowMs + REFRESH_SLACK_MS;
	const timer = setTimeout(callback, Math.min(Math.max(delay, 0), MAX_TIMEOUT_MS));
	return () => clearTimeout(timer);
}
```

- [ ] **Step 5: Implement `bookingDeadline.js`**

```js
/**
 * Booking-deadline evaluation, normative per wiki "GTFS-Flex Support" §2.5 as
 * refined by maglev docs/superpowers/specs/2026-09-24-gtfs-flex-implementation-design.md §6.
 * Shared with iOS (BookingDeadlineEvaluator.swift) and Android; the vectors in
 * src/tests/fixtures/flex-booking-vectors.json pin all three to one algorithm.
 *
 * All arithmetic is in service days of the agency timezone. A service day's
 * times are offsets from its DST-safe anchor, local noon minus 12 hours.
 */

export const LOOKAHEAD_DAYS = 400;

const SECONDS_PER_DAY = 86400;
const WEEKDAY_NUMBERS = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const UNKNOWN = Object.freeze({ state: 'unknown', cutoffInstant: null, openInstant: null });

/**
 * @param {string | null | undefined} value - GTFS "H:MM:SS"; hours may exceed 24
 * @returns {number | null} seconds since the service-day anchor
 */
export function parseGtfsTime(value) {
	if (typeof value !== 'string') return null;
	const match = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(value.trim());
	if (!match) return null;
	return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function parsePlainDate(value) {
	if (!value) return null;
	try {
		return Temporal.PlainDate.from(value);
	} catch {
		return null;
	}
}

const compareDates = (a, b) => Temporal.PlainDate.compare(a, b);

/**
 * @param {string} timeZone - IANA agency timezone
 * @param {Array<{ id: string, days: string[], startDate: string | null, endDate: string | null, exceptedDates: string[] }>} calendars
 */
export function createEvaluator(timeZone, calendars) {
	const calendarsById = new Map(
		calendars.map((calendar) => [
			calendar.id,
			{
				startDate: parsePlainDate(calendar.startDate),
				endDate: parsePlainDate(calendar.endDate),
				days: new Set(calendar.days.map((day) => WEEKDAY_NUMBERS[day]).filter(Boolean)),
				exceptedDates: new Set(calendar.exceptedDates)
			}
		])
	);

	function anchor(date) {
		return date
			.toZonedDateTime({ timeZone, plainTime: '12:00' })
			.subtract({ hours: 12 })
			.toInstant();
	}

	function instant(date, seconds) {
		return anchor(date).add({ seconds });
	}

	function serviceDate(now) {
		return now.toZonedDateTimeISO(timeZone).toPlainDate();
	}

	function isActive(calendarId, date) {
		const calendar = calendarsById.get(calendarId);
		if (!calendar?.startDate || !calendar.endDate) return false;
		if (compareDates(date, calendar.startDate) < 0 || compareDates(date, calendar.endDate) > 0) {
			return false;
		}
		return calendar.days.has(date.dayOfWeek) && !calendar.exceptedDates.has(date.toString());
	}

	function isRuleActive(rule, date) {
		return rule.calendarIds.some((id) => isActive(id, date));
	}

	function hasUsableCalendar(rule) {
		return rule.calendarIds.some((id) => {
			const calendar = calendarsById.get(id);
			return Boolean(calendar?.startDate && calendar.endDate);
		});
	}

	/**
	 * Steps back `count` active days of `calendarId` from `date`. A calendar the
	 * references don't carry counts civil days, matching iOS. Fails (null) when
	 * the walk passes the calendar's start, the calendar has no usable days, or
	 * it would need more than LOOKAHEAD_DAYS steps.
	 */
	function countBack(date, count, calendarId) {
		if (!(count > 0)) return date;
		const calendar = calendarId == null ? null : calendarsById.get(calendarId);
		if (!calendar) return date.subtract({ days: count });
		if (calendar.days.size === 0 || !calendar.startDate) return null;

		let remaining = count;
		let cursor = date;
		for (let stepped = 0; stepped < LOOKAHEAD_DAYS; stepped++) {
			cursor = cursor.subtract({ days: 1 });
			if (compareDates(cursor, calendar.startDate) < 0) return null;
			if (isActive(calendarId, cursor)) {
				remaining -= 1;
				if (remaining === 0) return cursor;
			}
		}
		return null;
	}

	function latestPickup(rule, date) {
		return instant(date, parseGtfsTime(rule.endPickupTime) ?? SECONDS_PER_DAY);
	}

	// Type 1: minutes before pickup. A null minimum would invent the latest
	// possible deadline, the worst failure, so it is unknown instead.
	// priorNoticeCalendarId is honoured only for type 2.
	function sameDayDeadlines(rule, bookingRule, date) {
		if (bookingRule.priorNoticeDurationMin == null) return null;
		const cutoff = latestPickup(rule, date).subtract({
			minutes: bookingRule.priorNoticeDurationMin
		});
		let open = null;
		if (bookingRule.priorNoticeDurationMax != null) {
			open = instant(date, parseGtfsTime(rule.startPickupTime) ?? 0).subtract({
				minutes: bookingRule.priorNoticeDurationMax
			});
		} else if (bookingRule.priorNoticeStartDay != null) {
			open = instant(
				date.subtract({ days: bookingRule.priorNoticeStartDay }),
				parseGtfsTime(bookingRule.priorNoticeStartTime) ?? 0
			);
		}
		return { cutoff, open };
	}

	// Type 2: prior day(s). A missing last time means 00:00, never later than
	// any real deadline.
	function priorDayDeadlines(bookingRule, date) {
		if (bookingRule.priorNoticeLastDay == null) return null;
		const calendarId = bookingRule.priorNoticeCalendarId;
		const lastDayDate = countBack(date, bookingRule.priorNoticeLastDay, calendarId);
		if (!lastDayDate) return null;
		const cutoff = instant(lastDayDate, parseGtfsTime(bookingRule.priorNoticeLastTime) ?? 0);
		if (bookingRule.priorNoticeStartDay == null) return { cutoff, open: null };
		const startDayDate = countBack(date, bookingRule.priorNoticeStartDay, calendarId);
		if (!startDayDate) return null;
		return {
			cutoff,
			open: instant(startDayDate, parseGtfsTime(bookingRule.priorNoticeStartTime) ?? 0)
		};
	}

	function deadlinesFor(rule, bookingRule, date) {
		switch (bookingRule.bookingType) {
			case 0:
				// Notice fields are forbidden for real-time booking and ignored.
				return { cutoff: latestPickup(rule, date), open: null };
			case 1:
				return sameDayDeadlines(rule, bookingRule, date);
			case 2:
				return priorDayDeadlines(bookingRule, date);
			default:
				return null;
		}
	}

	function evaluate(rule, bookingRule, date, now) {
		if (!bookingRule) return { state: 'open', cutoffInstant: null, openInstant: null };
		const deadlines = deadlinesFor(rule, bookingRule, date);
		if (!deadlines) return UNKNOWN;
		let state = 'open';
		if (deadlines.open && Temporal.Instant.compare(now, deadlines.open) < 0) state = 'notYetOpen';
		else if (Temporal.Instant.compare(now, deadlines.cutoff) > 0) state = 'closedForDate';
		return { state, cutoffInstant: deadlines.cutoff, openInstant: deadlines.open };
	}

	function lastServiceDate(rule) {
		const endDates = rule.calendarIds.map((id) => calendarsById.get(id)?.endDate).filter(Boolean);
		if (!endDates.length) return null;
		return endDates.reduce((latest, date) => (compareDates(date, latest) > 0 ? date : latest));
	}

	function nextActiveServiceDate(rule, from) {
		const last = lastServiceDate(rule);
		if (!last) return null;
		let cursor = from;
		for (let stepped = 0; stepped < LOOKAHEAD_DAYS && compareDates(cursor, last) <= 0; stepped++) {
			if (isRuleActive(rule, cursor)) return cursor;
			cursor = cursor.add({ days: 1 });
		}
		return null;
	}

	/** Visits each active service day of `rule` from the agency-local today, in order. */
	function walkServiceDates(rule, bookingRule, now, visit) {
		let cursor = serviceDate(now);
		for (let stepped = 0; stepped < LOOKAHEAD_DAYS; stepped++) {
			const candidate = nextActiveServiceDate(rule, cursor);
			if (!candidate) return;
			if (visit(candidate, evaluate(rule, bookingRule, candidate, now)) === false) return;
			cursor = candidate.add({ days: 1 });
		}
	}

	/** Earliest active day from today whose booking is open; unknown days are skipped. */
	function nextBookableServiceDate(rule, bookingRule, now) {
		let found = null;
		walkServiceDates(rule, bookingRule, now, (date, evaluation) => {
			if (evaluation.state !== 'open') return true;
			found = date;
			return false;
		});
		return found;
	}

	return {
		timeZone,
		anchor,
		instant,
		serviceDate,
		isActive,
		isRuleActive,
		hasUsableCalendar,
		countBack,
		evaluate,
		walkServiceDates,
		nextBookableServiceDate
	};
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/onDemand/bookingDeadline.test.js src/tests/lib/onDemand/instants.test.js`
Expected: PASS, all 22 vectors green. If a vector fails, compare against iOS `OBAKitCore/Models/OnDemand/BookingDeadlineEvaluator.swift` in `/Users/aaron/repos/onebusaway/.worktrees/ios-gtfs-flex`. Never edit the vector file.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/lib/onDemand/instants.js src/lib/onDemand/bookingDeadline.js src/tests/fixtures/flex-booking-vectors.json src/tests/lib/onDemand .prettierignore
git commit -m "feat(ondemand): evaluate booking deadlines

Implements the normative booking-deadline algorithm shared with iOS
and Android, pinned by the 22 vectors mirrored from maglev testdata."
```

---

### Task 5: Booking resolution, availability and sort

**Files:**

- Create: `src/lib/onDemand/bookingResolution.js`
- Create: `src/lib/onDemand/availability.js`
- Test: `src/tests/lib/onDemand/availability.test.js`

**Interfaces:**

- Consumes: `createEvaluator`, `parseGtfsTime`, `LOOKAHEAD_DAYS` (Task 4); `minInstant`, `earliestAfter`, `compareInstants` (Task 4); `resolvePickupBookingRule`, `serviceCalendars` (Task 3).
- Produces:

  - `resolveBooking(service, evaluator, now) → { resolution: Resolution, nextChangeInstant: Instant|null }` where `Resolution = { kind: 'bookBy', cutoff: Instant, travelDate: PlainDate } | { kind: 'opensAt', instant: Instant } | { kind: 'noNoticeRequired' } | { kind: 'closed' } | { kind: 'unknown' }`
  - `TIER = { OPEN_NOW: 1, SAME_DAY: 2, ADVANCE: 3, ELIGIBILITY: 4, UNKNOWN: 5 }`
  - `isValidTimeZone(tz) → boolean`
  - `evaluateAvailability(service, now) → Availability` where `Availability = { status: Status, tier: 1|2|3|5, bookingTier: 'realTime'|'sameDay'|'advance'|null, nextBookableServiceDate: PlainDate|null, nextChangeInstant: Instant|null, resolution: Resolution, timeZone: string|null, today: PlainDate|null }` and `Status = { kind: 'openNow', until: Instant|null } | { kind: 'opensAt', instant } | { kind: 'bookingOpens', instant } | { kind: 'bookBy', deadline, travelDate } | { kind: 'closed' } | { kind: 'unknown' }`
  - `sortByAvailability(items: Array<{ service, availability }>, locale?: string) → same array type, new array`

- [ ] **Step 1: Write the failing tests**

`src/tests/lib/onDemand/availability.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { evaluateAvailability, sortByAvailability, TIER } from '$lib/onDemand/availability.js';
import { resolveBooking } from '$lib/onDemand/bookingResolution.js';
import { createEvaluator } from '$lib/onDemand/bookingDeadline.js';
import { serviceCalendars } from '$lib/onDemand/models.js';
import {
	parsedService,
	referencesJson,
	ruleJson,
	bookingRuleJson
} from '../../fixtures/onDemand.js';

const at = (s) => Temporal.Instant.from(s);
const DETROIT = [{ id: '5088', name: 'MTA', timezone: 'America/Detroit' }];
const WEEKDAYS = {
	id: 'wk',
	days: ['mon', 'tue', 'wed', 'thu', 'fri'],
	startDate: '2026-01-01',
	endDate: '2026-12-31',
	exceptedDates: []
};
const EVERY_DAY = {
	...WEEKDAYS,
	id: 'all',
	days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
};

/** A Detroit weekday service 07:00–18:00 with the given pickup booking rule. */
function detroitService(bookingRule, ruleOverrides = {}, refOverrides = {}) {
	return parsedService(
		{
			rules: [
				ruleJson({
					startPickupTime: '07:00:00',
					endPickupTime: '18:00:00',
					calendarIds: ['wk'],
					pickupBookingRuleId: bookingRule ? bookingRule.id : null,
					...ruleOverrides
				})
			]
		},
		{
			agencies: DETROIT,
			calendars: [WEEKDAYS, EVERY_DAY],
			bookingRules: bookingRule ? [bookingRule] : [],
			...refOverrides
		}
	);
}
const realTime = bookingRuleJson({
	id: 'rt',
	bookingType: 0,
	priorNoticeLastDay: null,
	priorNoticeLastTime: null,
	priorNoticeStartDay: null,
	priorNoticeStartTime: null
});
const sameDay60 = bookingRuleJson({
	id: 'sd',
	bookingType: 1,
	priorNoticeDurationMin: 60,
	priorNoticeLastDay: null,
	priorNoticeLastTime: null,
	priorNoticeStartDay: null,
	priorNoticeStartTime: null
});

describe('resolveBooking', () => {
	const resolve = (service, now) =>
		resolveBooking(
			service,
			createEvaluator(service.agency.timezone, serviceCalendars(service)),
			now
		);

	it('books the Alexandria prior-day service by 17:00 the day before', () => {
		const { resolution } = resolve(parsedService(), at('2026-03-10T16:59:00-07:00'));
		expect(resolution.kind).toBe('bookBy');
		expect(resolution.cutoff.equals(at('2026-03-10T17:00:00-07:00'))).toBe(true);
		expect(resolution.travelDate.toString()).toBe('2026-03-11');
	});

	it('needs no notice when the pickup booking rule id is null', () => {
		expect(resolve(detroitService(null), at('2026-03-11T12:00:00-04:00')).resolution.kind).toBe(
			'noNoticeRequired'
		);
	});

	it('is unknown when a pickup booking rule id dangles', () => {
		const service = detroitService(null, { pickupBookingRuleId: 'missing' });
		expect(resolve(service, at('2026-03-11T12:00:00-04:00')).resolution.kind).toBe('unknown');
	});

	it('opens later when every date is not yet bookable', () => {
		const opensLater = bookingRuleJson({
			id: 'ol',
			priorNoticeLastDay: 1,
			priorNoticeStartDay: 1,
			priorNoticeStartTime: '12:00:00'
		});
		const oneDay = { ...WEEKDAYS, id: 'one', startDate: '2026-03-20', endDate: '2026-03-20' };
		const service = detroitService(opensLater, { calendarIds: ['one'] }, { calendars: [oneDay] });
		const { resolution } = resolve(service, at('2026-03-10T12:00:00-04:00'));
		expect(resolution.kind).toBe('opensAt');
		expect(resolution.instant.equals(at('2026-03-19T12:00:00-04:00'))).toBe(true);
	});

	it('is closed when the calendar has ended', () => {
		const ended = { ...WEEKDAYS, id: 'old', startDate: '2025-01-01', endDate: '2025-12-31' };
		const service = detroitService(realTime, { calendarIds: ['old'] }, { calendars: [ended] });
		expect(resolve(service, at('2026-03-11T12:00:00-04:00')).resolution.kind).toBe('closed');
	});

	it('is unknown for a service with no rules', () => {
		const service = parsedService({ rules: [] }, { agencies: DETROIT });
		expect(resolve(service, at('2026-03-11T12:00:00-04:00')).resolution.kind).toBe('unknown');
	});
});

describe('evaluateAvailability', () => {
	it('is open now until the window ends for a running real-time service', () => {
		const result = evaluateAvailability(detroitService(realTime), at('2026-03-11T12:00:00-04:00'));
		expect(result.status.kind).toBe('openNow');
		expect(result.status.until.equals(at('2026-03-11T18:00:00-04:00'))).toBe(true);
		expect(result.tier).toBe(TIER.OPEN_NOW);
		expect(result.bookingTier).toBe('realTime');
		expect(result.nextChangeInstant.equals(at('2026-03-11T18:00:00-04:00'))).toBe(true);
	});

	it('opens at the next window after hours', () => {
		const result = evaluateAvailability(detroitService(realTime), at('2026-03-11T19:00:00-04:00'));
		expect(result.status.kind).toBe('opensAt');
		expect(result.status.instant.equals(at('2026-03-12T07:00:00-04:00'))).toBe(true);
		expect(result.tier).toBe(TIER.ADVANCE);
	});

	it('reads "Open" with no end for a continuous all-hours service', () => {
		const service = detroitService(null, {
			startPickupTime: null,
			endPickupTime: null,
			calendarIds: ['all']
		});
		const result = evaluateAvailability(service, at('2026-03-11T12:00:00-04:00'));
		expect(result.status).toEqual({ kind: 'openNow', until: null });
	});

	it('shows the prior-day deadline for an advance service', () => {
		const result = evaluateAvailability(parsedService(), at('2026-03-10T16:59:00-07:00'));
		expect(result.status.kind).toBe('bookBy');
		expect(result.status.travelDate.toString()).toBe('2026-03-11');
		expect(result.bookingTier).toBe('advance');
		expect(result.tier).toBe(TIER.ADVANCE);
	});

	it('opens at the next window when running past a same-day cutoff (ruling I4)', () => {
		const result = evaluateAvailability(detroitService(sameDay60), at('2026-03-11T17:30:00-04:00'));
		expect(result.status.kind).toBe('opensAt');
		expect(result.status.instant.equals(at('2026-03-12T07:00:00-04:00'))).toBe(true);
	});

	it('keeps a window running past midnight open on the next civil day', () => {
		const service = detroitService(realTime, {
			startPickupTime: '05:00:00',
			endPickupTime: '24:50:00',
			calendarIds: ['all']
		});
		const result = evaluateAvailability(service, at('2026-03-12T00:30:00-04:00'));
		expect(result.status.kind).toBe('openNow');
		expect(result.status.until.equals(at('2026-03-12T00:50:00-04:00'))).toBe(true);
	});

	it('is unknown without a valid agency timezone', () => {
		const service = parsedService(
			{},
			{ agencies: [{ id: '5088', name: 'X', timezone: 'Mars/Olympus' }] }
		);
		const result = evaluateAvailability(service, at('2026-03-11T12:00:00Z'));
		expect(result.status.kind).toBe('unknown');
		expect(result.tier).toBe(TIER.UNKNOWN);
		expect(result.nextChangeInstant).toBeNull();
	});

	it('is closed with tier 5 when every calendar has ended', () => {
		const ended = { ...WEEKDAYS, id: 'old', startDate: '2025-01-01', endDate: '2025-12-31' };
		const service = detroitService(realTime, { calendarIds: ['old'] }, { calendars: [ended] });
		const result = evaluateAvailability(service, at('2026-03-11T12:00:00-04:00'));
		expect(result.status.kind).toBe('closed');
		expect(result.tier).toBe(TIER.UNKNOWN);
	});

	it('is unknown with tier 5 for a service with no rules', () => {
		const result = evaluateAvailability(parsedService({ rules: [] }), at('2026-03-11T12:00:00Z'));
		expect(result.status.kind).toBe('unknown');
		expect(result.tier).toBe(TIER.UNKNOWN);
	});
});

describe('sortByAvailability', () => {
	it('orders by tier, then by name with numeric collation', () => {
		const item = (name, tier) => ({ service: { name }, availability: { tier } });
		const sorted = sortByAvailability(
			[item('Zone 10', 3), item('Zone 2', 3), item('Beta', 1), item('Alpha', 5)],
			'en'
		);
		expect(sorted.map((entry) => entry.service.name)).toEqual([
			'Beta',
			'Zone 2',
			'Zone 10',
			'Alpha'
		]);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/onDemand/availability.test.js`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement `bookingResolution.js`**

```js
import { resolvePickupBookingRule } from '$lib/onDemand/models.js';
import { compareInstants, earliestAfter, minInstant } from '$lib/onDemand/instants.js';

/**
 * The service-level booking line, a port of iOS OnDemandBookingResolution:
 * the earliest bookable candidate wins (same date: the earliest cutoff);
 * otherwise the earliest not-yet-open instant; otherwise unknown if any rule
 * couldn't be evaluated, else closed.
 * @param {import('./models.js').OnDemandService} service
 * @param {ReturnType<import('./bookingDeadline.js').createEvaluator>} evaluator
 * @param {Temporal.Instant} now
 */
export function resolveBooking(service, evaluator, now) {
	if (service.rules.length === 0)
		return { resolution: { kind: 'unknown' }, nextChangeInstant: null };

	const bookable = [];
	const notYetOpen = [];
	let sawUnknown = false;
	for (const rule of service.rules) {
		const outcome = ruleOutcome(rule, service, evaluator, now);
		if (outcome.kind === 'unresolved')
			return { resolution: { kind: 'unknown' }, nextChangeInstant: null };
		if (outcome.kind === 'bookable') bookable.push(outcome);
		else if (outcome.kind === 'notYetOpen') notYetOpen.push(outcome.openInstant);
		else if (outcome.kind === 'unknown') sawUnknown = true;
	}

	const boundaries = [
		...bookable.map((candidate) => candidate.evaluation.cutoffInstant),
		...notYetOpen
	];
	return {
		resolution: resolved(bookable, notYetOpen, sawUnknown),
		nextChangeInstant: earliestAfter(boundaries, now)
	};
}

function ruleOutcome(rule, service, evaluator, now) {
	const { bookingRule, dangling } = resolvePickupBookingRule(service, rule);
	if (dangling) return { kind: 'unresolved' };
	if (!evaluator.hasUsableCalendar(rule)) return { kind: 'unknown' };

	let candidate = null;
	let firstOpenInstant = null;
	let sawUnknown = false;
	evaluator.walkServiceDates(rule, bookingRule, now, (travelDate, evaluation) => {
		if (evaluation.state === 'open') {
			candidate = { travelDate, evaluation };
			return false;
		}
		if (evaluation.state === 'notYetOpen') firstOpenInstant ??= evaluation.openInstant;
		else if (evaluation.state === 'unknown') sawUnknown = true;
		return true;
	});

	if (candidate) return { kind: 'bookable', ...candidate };
	if (firstOpenInstant) return { kind: 'notYetOpen', openInstant: firstOpenInstant };
	return { kind: sawUnknown ? 'unknown' : 'settled' };
}

function resolved(bookable, notYetOpen, sawUnknown) {
	if (bookable.length) {
		const best = bookable.reduce((winner, candidate) =>
			compareCandidates(candidate, winner) < 0 ? candidate : winner
		);
		const cutoff = best.evaluation.cutoffInstant;
		return cutoff
			? { kind: 'bookBy', cutoff, travelDate: best.travelDate }
			: { kind: 'noNoticeRequired' };
	}
	if (notYetOpen.length) return { kind: 'opensAt', instant: minInstant(notYetOpen) };
	return { kind: sawUnknown ? 'unknown' : 'closed' };
}

function compareCandidates(a, b) {
	const byDate = Temporal.PlainDate.compare(a.travelDate, b.travelDate);
	if (byDate !== 0) return byDate;
	const cutoffA = a.evaluation.cutoffInstant;
	const cutoffB = b.evaluation.cutoffInstant;
	if (!cutoffA || !cutoffB) return cutoffA ? -1 : cutoffB ? 1 : 0;
	return compareInstants(cutoffA, cutoffB);
}
```

- [ ] **Step 4: Implement `availability.js`**

```js
import { createEvaluator, LOOKAHEAD_DAYS, parseGtfsTime } from '$lib/onDemand/bookingDeadline.js';
import { resolveBooking } from '$lib/onDemand/bookingResolution.js';
import { compareInstants, earliestAfter } from '$lib/onDemand/instants.js';
import { resolvePickupBookingRule, serviceCalendars } from '$lib/onDemand/models.js';

/**
 * What a rider can do with a service right now: a port of the DRT UI design
 * §2.5–2.6 and iOS OnDemandAvailability. Pure; surfaces render the result and
 * re-evaluate at `nextChangeInstant`.
 */

export const TIER = { OPEN_NOW: 1, SAME_DAY: 2, ADVANCE: 3, ELIGIBILITY: 4, UNKNOWN: 5 };

const BOOKING_TIERS = ['realTime', 'sameDay', 'advance'];
const SECONDS_PER_DAY = 86400;

/**
 * @param {string | null | undefined} timeZone
 * @returns {boolean}
 */
export function isValidTimeZone(timeZone) {
	if (!timeZone) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return true;
	} catch {
		return false;
	}
}

function unknownAvailability() {
	return {
		status: { kind: 'unknown' },
		tier: TIER.UNKNOWN,
		bookingTier: null,
		nextBookableServiceDate: null,
		nextChangeInstant: null,
		resolution: { kind: 'unknown' },
		timeZone: null,
		today: null
	};
}

/**
 * @param {import('./models.js').OnDemandService} service
 * @param {Temporal.Instant} now
 */
export function evaluateAvailability(service, now) {
	const timeZone = service.agency?.timezone;
	if (!isValidTimeZone(timeZone)) return unknownAvailability();

	const evaluator = createEvaluator(timeZone, serviceCalendars(service));
	const today = evaluator.serviceDate(now);
	const context = { service, evaluator, timeZone };

	// Windows pass 24:00, so the previous service day is checked too.
	const containing = windowsOn(context, [today.subtract({ days: 1 }), today]).filter(
		(window) => compareInstants(window.start, now) <= 0 && compareInstants(now, window.end) < 0
	);
	const runningNow = containing.length > 0;
	const runningUntil = runningNow ? runningUntilInstant(context, containing) : null;
	const nextRunStart = runningNow ? null : nextWindowStart(context, now, today, false);
	const firstActiveDate = firstDateWithService(context, today);
	const bookingTier = bookingTierOn(context, firstActiveDate);
	const bookableNow = containing.some((window) => isOpen(context, window.rule, window.date, now));
	const nextBookableServiceDate = earliestNextBookable(context, now);
	const { resolution, nextChangeInstant: bookingChange } = resolveBooking(service, evaluator, now);

	// A running service past its cutoff opens again at the first window starting
	// at or after the current one's end (ruling I4).
	const nextOpening =
		runningNow && !bookableNow
			? nextWindowStart(context, runningUntil ?? now, today, true)
			: nextRunStart;

	const status = chooseStatus({
		bookingTier,
		resolution,
		runningNow,
		bookableNow,
		runningUntil,
		nextOpening,
		hasUsableCalendar: service.rules.some((rule) => evaluator.hasUsableCalendar(rule)),
		hasServiceDay: firstActiveDate != null
	});

	// The tier depends on "today", so the agency-local midnight is always a change.
	const nextMidnight = evaluator.anchor(today.add({ days: 1 }));
	return {
		status,
		tier: usabilityTier(status, nextBookableServiceDate, today),
		bookingTier,
		nextBookableServiceDate,
		nextChangeInstant: earliestAfter(
			[runningUntil, nextRunStart, bookingChange, nextMidnight],
			now
		),
		resolution,
		timeZone,
		today
	};
}

function usabilityTier(status, nextBookableServiceDate, today) {
	if (status.kind === 'openNow') return TIER.OPEN_NOW;
	if (status.kind === 'closed' || status.kind === 'unknown') return TIER.UNKNOWN;
	if (!nextBookableServiceDate) return TIER.UNKNOWN;
	return nextBookableServiceDate.equals(today) ? TIER.SAME_DAY : TIER.ADVANCE;
}

function chooseStatus({
	bookingTier,
	resolution,
	runningNow,
	bookableNow,
	runningUntil,
	nextOpening,
	hasUsableCalendar,
	hasServiceDay
}) {
	if (bookingTier === 'advance') {
		switch (resolution.kind) {
			case 'bookBy':
				return { kind: 'bookBy', deadline: resolution.cutoff, travelDate: resolution.travelDate };
			case 'opensAt':
				return { kind: 'bookingOpens', instant: resolution.instant };
			case 'closed':
				return { kind: 'closed' };
			default:
				return { kind: 'unknown' };
		}
	}
	if (runningNow && bookableNow) return { kind: 'openNow', until: runningUntil };
	if (nextOpening) return { kind: 'opensAt', instant: nextOpening };
	// Running past the cutoff on the last service day: nothing is left to book.
	if (runningNow) return { kind: 'closed' };
	if (!hasUsableCalendar) return { kind: 'unknown' };
	return hasServiceDay ? { kind: 'unknown' } : { kind: 'closed' };
}

// An all-day rule spans true wall-clock midnight to midnight, not the anchor's
// fixed 24 hours, so a DST day doesn't open a gap between consecutive windows.
function windowFor({ evaluator, timeZone }, rule, date) {
	const start = parseGtfsTime(rule.startPickupTime);
	const end = parseGtfsTime(rule.endPickupTime);
	if (start == null && end == null) {
		return {
			rule,
			date,
			start: date.toZonedDateTime({ timeZone }).toInstant(),
			end: date.add({ days: 1 }).toZonedDateTime({ timeZone }).toInstant()
		};
	}
	return {
		rule,
		date,
		start: evaluator.instant(date, start ?? 0),
		end: evaluator.instant(date, end ?? SECONDS_PER_DAY)
	};
}

function windowsOn(context, dates) {
	return dates.flatMap((date) =>
		context.service.rules
			.filter((rule) => context.evaluator.isRuleActive(rule, date))
			.map((rule) => windowFor(context, rule, date))
	);
}

// Null when the latest end touches the next service day's first window, so a
// continuous service reads "Open" rather than "until 12:00 AM".
function runningUntilInstant(context, containing) {
	const latest = containing.reduce((a, b) => (compareInstants(b.end, a.end) > 0 ? b : a));
	const nextDayWindows = windowsOn(context, [latest.date.add({ days: 1 })]);
	const abuts = nextDayWindows.some((window) => compareInstants(window.start, latest.end) <= 0);
	return abuts ? null : latest.end;
}

function nextWindowStart(context, after, today, inclusive) {
	let best = null;
	for (let offset = -1; offset <= LOOKAHEAD_DAYS; offset++) {
		const date = today.add({ days: offset });
		if (best && compareInstants(context.evaluator.anchor(date), best) >= 0) break;
		for (const window of windowsOn(context, [date])) {
			const order = compareInstants(window.start, after);
			const isAfter = inclusive ? order >= 0 : order > 0;
			if (isAfter && (!best || compareInstants(window.start, best) < 0)) best = window.start;
		}
	}
	return best;
}

function firstDateWithService({ service, evaluator }, today) {
	for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset++) {
		const date = today.add({ days: offset });
		if (service.rules.some((rule) => evaluator.isRuleActive(rule, date))) return date;
	}
	return null;
}

// The least demanding pickup booking type among rules active on the next
// service day. A null id counts as real time; a dangling id is skipped.
function bookingTierOn({ service, evaluator }, date) {
	if (!date) return null;
	const types = service.rules
		.filter((rule) => evaluator.isRuleActive(rule, date))
		.map((rule) => {
			if (rule.pickupBookingRuleId == null) return 0;
			return resolvePickupBookingRule(service, rule).bookingRule?.bookingType;
		})
		.filter((type) => type === 0 || type === 1 || type === 2);
	return types.length ? BOOKING_TIERS[Math.min(...types)] : null;
}

function isOpen({ service, evaluator }, rule, date, now) {
	const { bookingRule, dangling } = resolvePickupBookingRule(service, rule);
	if (dangling) return false;
	return evaluator.evaluate(rule, bookingRule, date, now).state === 'open';
}

function earliestNextBookable({ service, evaluator }, now) {
	let earliest = null;
	for (const rule of service.rules) {
		const { bookingRule, dangling } = resolvePickupBookingRule(service, rule);
		if (dangling) continue;
		const date = evaluator.nextBookableServiceDate(rule, bookingRule, now);
		if (date && (!earliest || Temporal.PlainDate.compare(date, earliest) < 0)) earliest = date;
	}
	return earliest;
}

/**
 * @template {{ service: { name: string }, availability: { tier: number } }} T
 * @param {T[]} items
 * @param {string} [locale]
 * @returns {T[]}
 */
export function sortByAvailability(items, locale) {
	const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
	return [...items].sort(
		(a, b) =>
			a.availability.tier - b.availability.tier || collator.compare(a.service.name, b.service.name)
	);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/onDemand`
Expected: PASS. If a scenario disagrees, check against iOS `OnDemandAvailability.swift` / `OnDemandBookingResolution.swift` in the iOS worktree. The iOS behaviour wins, and the test expectation above follows it.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/onDemand/bookingResolution.js src/lib/onDemand/availability.js src/tests/lib/onDemand/availability.test.js
git commit -m "feat(ondemand): compute service availability

Ports the shared availability model: open-now, opens-at and
booking-deadline statuses, the soonest-usable tier, and the instant at
which the status next changes, all in the agency timezone."
```

---

### Task 6: Hours rows, zone colours and zone levels/styles

**Files:**

- Create: `src/lib/onDemand/hours.js`
- Create: `src/lib/onDemand/colors.js`
- Create: `src/lib/onDemand/zones.js`
- Test: `src/tests/lib/onDemand/hours.test.js`, `src/tests/lib/onDemand/zones.test.js`

**Interfaces:**

- Consumes: `parseGtfsTime` (Task 4); service model (Task 3).
- Produces:
  - `hoursRows(service, { locale: string, today: Temporal.PlainDate }) → HoursRow[]` where `HoursRow = { kind: 'hours', days: string, start: string, end: string, startNextDay: boolean, endNextDay: boolean } | { kind: 'allHours', days: string } | { kind: 'noService', days: string }`
  - `formatDayRanges(days: string[] /* 'mon'..'sun' */, locale) → string`
  - `ZONE_BRAND_COLOR`, `ZONE_FALLBACK_PALETTE`, `normalizeHexColor(value) → string|null`, `assignZoneColors(services) → Map<string, string>`
  - `ZONE_STREET_MAX_KM = 4`, `ZONE_REGION_MAX_KM = 65`, `zoneLevel(bounds: {north, south}) → 'street'|'region'|'hidden'`, `zoneStyle({ level: 'street'|'region', color, highlight: 'none'|'selected'|'dimmed' }) → { color, fillOpacity, weight, opacity, halo: {weight, opacity}|null, interactive }`

Before writing `normalizeHexColor`, check `src/lib/colorUtils.js` and `src/lib/colors.js` for an existing hex normaliser. If one fits, reuse it and drop `normalizeHexColor` from this task.

- [ ] **Step 1: Write the failing tests**

`src/tests/lib/onDemand/hours.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { hoursRows, formatDayRanges } from '$lib/onDemand/hours.js';
import { parsedService, ruleJson } from '../../fixtures/onDemand.js';

const today = Temporal.PlainDate.from('2026-03-11');
// ICU may put a narrow no-break space before AM/PM; compare with plain spaces.
const rowsOf = (service) =>
	JSON.parse(
		JSON.stringify(hoursRows(service, { locale: 'en-US', today })).replace(/\u202f/g, ' ')
	);
const cal = (id, days, endDate = '2026-12-31') => ({
	id,
	days,
	startDate: '2026-01-01',
	endDate,
	exceptedDates: []
});

describe('formatDayRanges', () => {
	it('collapses consecutive days into ranges', () => {
		expect(formatDayRanges(['mon', 'tue', 'wed', 'thu', 'fri'], 'en-US')).toBe('Mon–Fri');
		expect(formatDayRanges(['mon', 'wed'], 'en-US')).toBe('Mon, Wed');
		expect(formatDayRanges(['sat', 'sun'], 'en-US')).toBe('Sat–Sun');
	});
});

describe('hoursRows', () => {
	it('merges weekday and Saturday rules with equal hours and marks Sunday as no service', () => {
		const service = parsedService(
			{
				rules: [
					ruleJson({ startPickupTime: '07:00:00', endPickupTime: '18:00:00', calendarIds: ['wk'] }),
					ruleJson({ startPickupTime: '07:00:00', endPickupTime: '18:00:00', calendarIds: ['sat'] })
				]
			},
			{ calendars: [cal('wk', ['mon', 'tue', 'wed', 'thu', 'fri']), cal('sat', ['sat'])] }
		);
		expect(rowsOf(service)).toEqual([
			{
				kind: 'hours',
				days: 'Mon–Sat',
				start: '7:00 AM',
				end: '6:00 PM',
				startNextDay: false,
				endNextDay: false
			},
			{ kind: 'noService', days: 'Sun' }
		]);
	});

	it('marks a window past midnight as next day', () => {
		const service = parsedService(
			{},
			{ calendars: [cal('cal_mon_sat', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])] }
		);
		const [row] = rowsOf(service);
		expect(row).toMatchObject({ start: '5:00 AM', end: '12:50 AM', endNextDay: true });
	});

	it('reads all service hours for a rule without times, and lists Sat–Sun for a weekday calendar', () => {
		const service = parsedService(
			{ rules: [ruleJson({ startPickupTime: null, endPickupTime: null, calendarIds: ['wk'] })] },
			{ calendars: [cal('wk', ['mon', 'tue', 'wed', 'thu', 'fri'])] }
		);
		expect(rowsOf(service)).toEqual([
			{ kind: 'allHours', days: 'Mon–Fri' },
			{ kind: 'noService', days: 'Sat–Sun' }
		]);
	});

	it('ignores calendars that ended before today when finding no-service days', () => {
		const service = parsedService(
			{
				rules: [
					ruleJson({ startPickupTime: '07:00:00', endPickupTime: '18:00:00', calendarIds: ['wk'] }),
					ruleJson({
						startPickupTime: '09:00:00',
						endPickupTime: '12:00:00',
						calendarIds: ['oldsun']
					})
				]
			},
			{
				calendars: [
					cal('wk', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']),
					cal('oldsun', ['sun'], '2025-12-31')
				]
			}
		);
		expect(rowsOf(service).at(-1)).toEqual({ kind: 'noService', days: 'Sun' });
	});
});
```

`src/tests/lib/onDemand/zones.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
	assignZoneColors,
	normalizeHexColor,
	ZONE_BRAND_COLOR,
	ZONE_FALLBACK_PALETTE
} from '$lib/onDemand/colors.js';
import { zoneLevel, zoneStyle } from '$lib/onDemand/zones.js';

describe('zoneLevel', () => {
	it('uses the visible height in km', () => {
		expect(zoneLevel({ north: 0.03, south: 0 })).toBe('street'); // ~3.3 km
		expect(zoneLevel({ north: 0.5, south: 0 })).toBe('region'); // ~55.7 km
		expect(zoneLevel({ north: 1, south: 0 })).toBe('hidden'); // ~111 km
	});
});

describe('zoneStyle', () => {
	it('fills region zones and strokes street zones with a halo', () => {
		expect(zoneStyle({ level: 'region', color: '#111111', highlight: 'none' })).toEqual({
			color: '#111111',
			fillOpacity: 0.2,
			weight: 2,
			opacity: 1,
			halo: null,
			interactive: true
		});
		expect(zoneStyle({ level: 'street', color: '#111111', highlight: 'none' })).toEqual({
			color: '#111111',
			fillOpacity: 0,
			weight: 4,
			opacity: 1,
			halo: { weight: 10, opacity: 0.25 },
			interactive: false
		});
	});
	it('thickens the selected zone and dims the others', () => {
		expect(zoneStyle({ level: 'region', color: '#111111', highlight: 'selected' }).weight).toBe(4);
		const dimmed = zoneStyle({ level: 'region', color: '#111111', highlight: 'dimmed' });
		expect(dimmed.opacity).toBe(0.6);
		expect(dimmed.fillOpacity).toBeCloseTo(0.12);
	});
});

describe('colors', () => {
	it('normalizes GTFS hex colours', () => {
		expect(normalizeHexColor('0072CE')).toBe('#0072ce');
		expect(normalizeHexColor('#ABCDEF')).toBe('#abcdef');
		expect(normalizeHexColor('red')).toBeNull();
		expect(normalizeHexColor(null)).toBeNull();
	});
	it('assigns route colours, the brand colour, and palette colours on collision in id order', () => {
		const colors = assignZoneColors([
			{ id: 'b', route: null },
			{ id: 'a', route: null },
			{ id: 'c', route: { color: '0072CE' } }
		]);
		expect(colors.get('a')).toBe(ZONE_BRAND_COLOR);
		expect(colors.get('b')).toBe(ZONE_FALLBACK_PALETTE[0]);
		expect(colors.get('c')).toBe('#0072ce');
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/onDemand/hours.test.js src/tests/lib/onDemand/zones.test.js`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement `hours.js`**

```js
import { parseGtfsTime } from '$lib/onDemand/bookingDeadline.js';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SECONDS_PER_DAY = 86400;

/**
 * Rows for the detail sheet's "When" section: rules merged by identical hours,
 * then one muted row for weekdays no current calendar covers.
 * @param {import('./models.js').OnDemandService} service
 * @param {{ locale: string, today: Temporal.PlainDate }} options
 */
export function hoursRows(service, { locale, today }) {
	const groups = new Map();
	for (const rule of service.rules) {
		const days = ruleWeekdays(service, rule, () => true);
		if (!days.size) continue;
		const start = parseGtfsTime(rule.startPickupTime);
		const end = parseGtfsTime(rule.endPickupTime);
		const isAllHours = start == null && end == null;
		const key = isAllHours ? 'all' : `${start ?? 0}-${end ?? SECONDS_PER_DAY}`;
		const group = groups.get(key) ?? {
			days: new Set(),
			start: start ?? 0,
			end: end ?? SECONDS_PER_DAY,
			isAllHours
		};
		days.forEach((day) => group.days.add(day));
		groups.set(key, group);
	}

	const rows = [...groups.values()]
		.sort((a, b) => firstDayIndex(a.days) - firstDayIndex(b.days) || a.start - b.start)
		.map((group) => toRow(group, locale));

	const covered = new Set(
		service.rules.flatMap((rule) => [
			...ruleWeekdays(service, rule, (calendar) => isCurrent(calendar, today))
		])
	);
	const missing = WEEKDAYS.filter((day) => !covered.has(day));
	if (missing.length) rows.push({ kind: 'noService', days: formatDayRanges(missing, locale) });
	return rows;
}

function ruleWeekdays(service, rule, includeCalendar) {
	return new Set(
		rule.calendarIds
			.map((id) => service.refs.calendars.get(id))
			.filter((calendar) => calendar && includeCalendar(calendar))
			.flatMap((calendar) => calendar.days)
			.filter((day) => WEEKDAYS.includes(day))
	);
}

function isCurrent(calendar, today) {
	return calendar.endDate == null || calendar.endDate >= today.toString();
}

function firstDayIndex(days) {
	return Math.min(...[...days].map((day) => WEEKDAYS.indexOf(day)));
}

function toRow(group, locale) {
	const days = formatDayRanges([...group.days], locale);
	if (group.isAllHours) return { kind: 'allHours', days };
	return {
		kind: 'hours',
		days,
		start: formatWallClock(group.start, locale),
		end: formatWallClock(group.end, locale),
		startNextDay: group.start >= SECONDS_PER_DAY,
		endNextDay: group.end >= SECONDS_PER_DAY
	};
}

function formatWallClock(seconds, locale) {
	const date = new Date((seconds % SECONDS_PER_DAY) * 1000);
	return new Intl.DateTimeFormat(locale, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC'
	}).format(date);
}

/**
 * @param {string[]} days - GTFS weekday keys ('mon'…'sun'), any order
 * @param {string} locale
 * @returns {string} e.g. "Mon–Fri", "Mon, Wed"
 */
export function formatDayRanges(days, locale) {
	const indexes = WEEKDAYS.map((_, index) => index).filter((index) =>
		days.includes(WEEKDAYS[index])
	);
	const runs = [];
	for (const index of indexes) {
		const run = runs.at(-1);
		if (run && run.at(-1) === index - 1) run.push(index);
		else runs.push([index]);
	}
	// 2024-01-01 was a Monday.
	const name = (index) =>
		new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
			new Date(Date.UTC(2024, 0, 1 + index))
		);
	return runs
		.map((run) => (run.length >= 2 ? `${name(run[0])}–${name(run.at(-1))}` : name(run[0])))
		.join(', ');
}
```

- [ ] **Step 4: Implement `colors.js` and `zones.js`**

`colors.js`:

```js
export const ZONE_BRAND_COLOR = '#78aa36';
export const ZONE_FALLBACK_PALETTE = [
	'#3b82f6',
	'#d97706',
	'#7c3aed',
	'#db2777',
	'#0891b2',
	'#65a30d'
];

/**
 * @param {string | null | undefined} value - GTFS route colour, with or without '#'
 * @returns {string | null} lower-case '#rrggbb'
 */
export function normalizeHexColor(value) {
	if (!value) return null;
	const hex = String(value).trim().replace(/^#/, '');
	return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}

/**
 * One colour per service: its route colour, else the brand green. A colour
 * already taken in this set yields the next unused palette colour, assigned in
 * service-id order so the result is stable across redraws.
 * @param {Array<{ id: string, route?: { color?: string } | null }>} services
 * @returns {Map<string, string>}
 */
export function assignZoneColors(services) {
	const colors = new Map();
	const used = new Set();
	const ordered = [...services].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	for (const service of ordered) {
		const base = normalizeHexColor(service.route?.color) ?? ZONE_BRAND_COLOR;
		const color = used.has(base) ? (ZONE_FALLBACK_PALETTE.find((c) => !used.has(c)) ?? base) : base;
		used.add(color);
		colors.set(service.id, color);
	}
	return colors;
}
```

`zones.js`:

```js
export const ZONE_STREET_MAX_KM = 4;
export const ZONE_REGION_MAX_KM = 65;
const KM_PER_DEGREE_LATITUDE = 111.32;
const DIMMED_OPACITY = 0.6;

/**
 * @param {{ north: number, south: number }} bounds
 * @returns {'street' | 'region' | 'hidden'}
 */
export function zoneLevel(bounds) {
	const visibleHeightKm = (bounds.north - bounds.south) * KM_PER_DEGREE_LATITUDE;
	if (visibleHeightKm <= ZONE_STREET_MAX_KM) return 'street';
	if (visibleHeightKm <= ZONE_REGION_MAX_KM) return 'region';
	return 'hidden';
}

/**
 * Region zones are filled and clickable; street zones are a stroke with a halo
 * and never capture clicks meant for stops or the map.
 * @param {{ level: 'street' | 'region', color: string, highlight: 'none' | 'selected' | 'dimmed' }} options
 */
export function zoneStyle({ level, color, highlight }) {
	const base =
		level === 'street'
			? {
					color,
					fillOpacity: 0,
					weight: 4,
					opacity: 1,
					halo: { weight: 10, opacity: 0.25 },
					interactive: false
				}
			: { color, fillOpacity: 0.2, weight: 2, opacity: 1, halo: null, interactive: true };
	if (highlight === 'selected') return { ...base, weight: base.weight + 2 };
	if (highlight !== 'dimmed') return base;
	return {
		...base,
		opacity: DIMMED_OPACITY,
		fillOpacity: base.fillOpacity * DIMMED_OPACITY,
		halo: base.halo && { ...base.halo, opacity: base.halo.opacity * DIMMED_OPACITY }
	};
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/onDemand`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/onDemand/hours.js src/lib/onDemand/colors.js src/lib/onDemand/zones.js src/tests/lib/onDemand
git commit -m "feat(ondemand): add hours, zone colour and zoom helpers

Groups service hours into weekday ranges with a no-service row,
assigns collision-free zone colours, and picks street, region or
hidden zone styling from the visible map height."
```

---

### Task 7: Copy and English strings

**Files:**

- Create: `src/lib/onDemand/copy.js`
- Modify: `src/locales/en.json` (add the `ondemand` object at the top level, after `trip_details`)
- Test: `src/tests/lib/onDemand/copy.test.js`

**Interfaces:**

- Consumes: `Status`, `Resolution` shapes (Task 5).
- Produces (all take `ctx = { t, locale, timeZone, now }`, where `t` is svelte-i18n's `$t`):

  - `formatStatus(status, ctx, variant: 'row'|'detail') → string|null`
  - `formatBookingLine(resolution, ctx) → string`
  - `formatRelativeDateTime(instant, ctx) → string`
  - `formatTravelDate(plainDate, locale) → string`
  - `bookingTagKey(bookingTier) → string|null` (an i18n key)

- [ ] **Step 1: Add the strings to `src/locales/en.json`**

```json
	"ondemand": {
		"card_title": "On-demand service",
		"status_open": "Open",
		"status_open_until": "Open · until {time}",
		"status_open_now_until": "Open now · until {time}",
		"status_opens": "Opens {when}",
		"status_booking_opens": "Booking opens {when}",
		"status_book_by": "Book by {when}",
		"status_closed": "Closed",
		"book_by_for_ride": "Book by {deadline} for a ride on {date}",
		"no_notice_required": "No advance booking required",
		"booking_closed": "Booking has closed for upcoming service",
		"booking_unknown": "This agency has not published a booking deadline. Contact them to book.",
		"tag_no_notice": "No notice needed",
		"tag_same_day": "Same-day booking",
		"tag_advance": "Advance booking",
		"call": "Call {phone}",
		"book_online": "Book online",
		"open_agency_website": "Open agency website",
		"more_information": "More information",
		"where": "Where",
		"service_area": "Service area",
		"drop_off": "Drop-off",
		"zone_count": "{count, plural, one {# zone} other {# zones}}",
		"when": "When",
		"all_service_hours": "All service hours",
		"no_service": "No service",
		"next_day": "(next day)",
		"how_to_book": "How to book",
		"not_available": "This on-demand service is not available in this region.",
		"load_failed": "Couldn't load this on-demand service.",
		"retry": "Try again",
		"flex_only_empty_arrivals": "No scheduled departures here. On-demand service is available.",
		"close": "Close",
		"today_at": "today at {time}",
		"tomorrow_at": "tomorrow at {time}",
		"yesterday_at": "yesterday at {time}"
	}
```

- [ ] **Step 2: Write the failing tests**

`src/tests/lib/onDemand/copy.test.js`:

```js
import { describe, it, expect } from 'vitest';
import en from '../../../locales/en.json';
import {
	formatStatus,
	formatBookingLine,
	formatRelativeDateTime,
	formatTravelDate,
	bookingTagKey
} from '$lib/onDemand/copy.js';

/** A tiny English `t` with {name} interpolation. Plural keys are not used here. */
function t(key, options = {}) {
	const template = key.split('.').reduce((node, part) => node?.[part], en);
	return template.replace(/\{(\w+)\}/g, (_, name) => options.values?.[name] ?? `{${name}}`);
}
const at = (s) => Temporal.Instant.from(s);
const ctx = {
	t,
	locale: 'en-US',
	timeZone: 'America/Detroit',
	now: at('2026-03-11T12:00:00-04:00')
};
const clean = (s) => s.replace(/ /g, ' ');

describe('formatRelativeDateTime', () => {
	it('uses today and tomorrow words within a day', () => {
		expect(clean(formatRelativeDateTime(at('2026-03-11T17:00:00-04:00'), ctx))).toBe(
			'today at 5:00 PM'
		);
		expect(clean(formatRelativeDateTime(at('2026-03-12T07:00:00-04:00'), ctx))).toBe(
			'tomorrow at 7:00 AM'
		);
		expect(clean(formatRelativeDateTime(at('2026-03-15T07:00:00-04:00'), ctx))).toBe(
			'Mar 15, 7:00 AM'
		);
	});
});

describe('formatStatus', () => {
	it('renders each status', () => {
		const until = at('2026-03-11T18:00:00-04:00');
		expect(clean(formatStatus({ kind: 'openNow', until }, ctx, 'row'))).toBe(
			'Open · until 6:00 PM'
		);
		expect(clean(formatStatus({ kind: 'openNow', until }, ctx, 'detail'))).toBe(
			'Open now · until 6:00 PM'
		);
		expect(formatStatus({ kind: 'openNow', until: null }, ctx, 'row')).toBe('Open');
		expect(
			clean(formatStatus({ kind: 'opensAt', instant: at('2026-03-12T07:00:00-04:00') }, ctx, 'row'))
		).toBe('Opens tomorrow at 7:00 AM');
		expect(formatStatus({ kind: 'closed' }, ctx, 'row')).toBe('Closed');
		expect(formatStatus({ kind: 'unknown' }, ctx, 'row')).toBeNull();
	});
});

describe('formatBookingLine', () => {
	it('renders the full deadline line', () => {
		const line = formatBookingLine(
			{
				kind: 'bookBy',
				cutoff: at('2026-03-11T17:00:00-04:00'),
				travelDate: Temporal.PlainDate.from('2026-03-12')
			},
			ctx
		);
		expect(clean(line)).toBe('Book by today at 5:00 PM for a ride on Thu, Mar 12');
	});
	it('covers the other resolutions', () => {
		expect(formatBookingLine({ kind: 'noNoticeRequired' }, ctx)).toBe(
			'No advance booking required'
		);
		expect(formatBookingLine({ kind: 'closed' }, ctx)).toBe(
			'Booking has closed for upcoming service'
		);
		expect(formatBookingLine({ kind: 'unknown' }, ctx)).toMatch(/has not published/);
	});
});

describe('small helpers', () => {
	it('formats travel dates and tag keys', () => {
		expect(formatTravelDate(Temporal.PlainDate.from('2026-03-12'), 'en-US')).toBe('Thu, Mar 12');
		expect(bookingTagKey('sameDay')).toBe('ondemand.tag_same_day');
		expect(bookingTagKey(null)).toBeNull();
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/onDemand/copy.test.js`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement `copy.js`**

```js
/**
 * Rider-facing strings for on-demand statuses and booking lines. Times are in
 * the agency timezone; `now` decides the today/tomorrow wording.
 * @typedef {{ t: (key: string, options?: object) => string, locale: string, timeZone: string, now: Temporal.Instant }} CopyContext
 */

const TAG_KEYS = {
	realTime: 'ondemand.tag_no_notice',
	sameDay: 'ondemand.tag_same_day',
	advance: 'ondemand.tag_advance'
};
const RELATIVE_DAY_KEYS = {
	'-1': 'ondemand.yesterday_at',
	0: 'ondemand.today_at',
	1: 'ondemand.tomorrow_at'
};

/** @param {'realTime' | 'sameDay' | 'advance' | null} bookingTier */
export function bookingTagKey(bookingTier) {
	return TAG_KEYS[bookingTier] ?? null;
}

function formatTime(instant, { locale, timeZone }) {
	return new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit' }).format(
		new Date(instant.epochMilliseconds)
	);
}

/**
 * "today at 5:00 PM", "tomorrow at 7:00 AM", else "Mar 15, 7:00 AM".
 * @param {Temporal.Instant} instant
 * @param {CopyContext} ctx
 */
export function formatRelativeDateTime(instant, ctx) {
	const day = instant.toZonedDateTimeISO(ctx.timeZone).toPlainDate();
	const today = ctx.now.toZonedDateTimeISO(ctx.timeZone).toPlainDate();
	const dayOffset = today.until(day, { largestUnit: 'days' }).days;
	const key = RELATIVE_DAY_KEYS[dayOffset];
	if (key) return ctx.t(key, { values: { time: formatTime(instant, ctx) } });
	return new Intl.DateTimeFormat(ctx.locale, {
		timeZone: ctx.timeZone,
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(new Date(instant.epochMilliseconds));
}

/**
 * @param {Temporal.PlainDate} date
 * @param {string} locale
 * @returns {string} e.g. "Thu, Mar 12"
 */
export function formatTravelDate(date, locale) {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}

/**
 * @param {import('./availability.js').Status} status
 * @param {CopyContext} ctx
 * @param {'row' | 'detail'} variant - the detail sheet says "Open now"
 * @returns {string | null}
 */
export function formatStatus(status, ctx, variant) {
	switch (status.kind) {
		case 'openNow': {
			if (!status.until) return ctx.t('ondemand.status_open');
			const key =
				variant === 'detail' ? 'ondemand.status_open_now_until' : 'ondemand.status_open_until';
			return ctx.t(key, { values: { time: formatTime(status.until, ctx) } });
		}
		case 'opensAt':
			return ctx.t('ondemand.status_opens', {
				values: { when: formatRelativeDateTime(status.instant, ctx) }
			});
		case 'bookingOpens':
			return ctx.t('ondemand.status_booking_opens', {
				values: { when: formatRelativeDateTime(status.instant, ctx) }
			});
		case 'bookBy':
			return ctx.t('ondemand.status_book_by', {
				values: { when: formatRelativeDateTime(status.deadline, ctx) }
			});
		case 'closed':
			return ctx.t('ondemand.status_closed');
		default:
			return null;
	}
}

/**
 * @param {import('./bookingResolution.js').Resolution} resolution
 * @param {CopyContext} ctx
 * @returns {string}
 */
export function formatBookingLine(resolution, ctx) {
	switch (resolution.kind) {
		case 'bookBy':
			return ctx.t('ondemand.book_by_for_ride', {
				values: {
					deadline: formatRelativeDateTime(resolution.cutoff, ctx),
					date: formatTravelDate(resolution.travelDate, ctx.locale)
				}
			});
		case 'opensAt':
			return ctx.t('ondemand.status_booking_opens', {
				values: { when: formatRelativeDateTime(resolution.instant, ctx) }
			});
		case 'noNoticeRequired':
			return ctx.t('ondemand.no_notice_required');
		case 'closed':
			return ctx.t('ondemand.booking_closed');
		default:
			return ctx.t('ondemand.booking_unknown');
	}
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/onDemand/copy.test.js && npx vitest run src/tests` (the second run checks that no locale-parity test broke)
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/onDemand/copy.js src/locales/en.json src/tests/lib/onDemand/copy.test.js
git commit -m "feat(ondemand): add on-demand copy and English strings

Formats statuses and booking lines in the agency timezone with
today/tomorrow wording. Strings land in en.json only; other locales
fall back to English until translated."
```

---

### Task 8: Client state and fetch caches

**Files:**

- Create: `src/lib/onDemand/onDemandState.svelte.js`
- Test: `src/tests/lib/onDemand/onDemandState.test.js`

**Interfaces:**

- Consumes: `parseServiceList`, `parseServiceEntry` (Task 3).
- Produces:

  - `onDemandState` — `$state({ support: 'unknown'|'supported'|'unsupported', highlighted: OnDemandService|null })`
  - `CACHE_TTL_MS = 600_000`
  - `fetchServicesForViewport({ lat, lon, latSpan, lonSpan }) → Promise<{ services, outOfRange, refs } | null>`
  - `fetchService(id, geometryDetail: 'none'|'simplified'|'full') → Promise<{ service, refs } | { notFound: true } | null>`
  - `seedService(id, geometryDetail, body)` — primes the cache from a server-loaded envelope
  - `setHighlightedService(service|null)`
  - `resetOnDemandStateForTesting()`

- [ ] **Step 1: Write the failing tests**

`src/tests/lib/onDemand/onDemandState.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	onDemandState,
	fetchServicesForViewport,
	fetchService,
	seedService,
	resetOnDemandStateForTesting,
	CACHE_TTL_MS
} from '$lib/onDemand/onDemandState.svelte.js';
import { entryBody, listBody } from '../../fixtures/onDemand.js';

const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
const status = (code) => new Response(JSON.stringify({ error: 'x' }), { status: code });
const viewport = { lat: 38.8, lon: -77.1, latSpan: 0.2, lonSpan: 0.3 };

describe('onDemandState', () => {
	beforeEach(() => {
		resetOnDemandStateForTesting();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('requests simplified geometry for the viewport and records support', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(listBody()));
		const result = await fetchServicesForViewport(viewport);
		expect(result.services).toHaveLength(1);
		const url = new URL(fetchMock.mock.calls[0][0], 'http://x');
		expect(url.pathname).toBe('/api/oba/ondemand/services-for-location');
		expect(url.searchParams.get('geometryDetail')).toBe('simplified');
		expect(onDemandState.support).toBe('supported');
	});

	it('caches viewports rounded to two decimals for ten minutes', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok(listBody()));
		await fetchServicesForViewport(viewport);
		await fetchServicesForViewport({ ...viewport, lat: 38.801 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(CACHE_TTL_MS + 1);
		await fetchServicesForViewport(viewport);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('shares one in-flight request between identical callers', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok(entryBody()));
		await Promise.all([fetchService('5088_77652', 'none'), fetchService('5088_77652', 'none')]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('goes unsupported on a 501 and stops fetching', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(status(501));
		expect(await fetchServicesForViewport(viewport)).toBeNull();
		expect(onDemandState.support).toBe('unsupported');
		expect(await fetchService('5088_77652', 'none')).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('reports not-found and failures distinctly', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(status(404))
			.mockResolvedValueOnce(status(502));
		expect(await fetchService('a', 'none')).toEqual({ notFound: true });
		expect(await fetchService('b', 'none')).toBeNull();
		expect(onDemandState.support).toBe('unknown');
	});

	it('lets a simplified entry satisfy a none request, but not the reverse', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok(entryBody()));
		seedService('5088_77652', 'simplified', entryBody());
		await fetchService('5088_77652', 'none');
		expect(fetchMock).not.toHaveBeenCalled();
		seedService('x', 'none', entryBody());
		await fetchService('x', 'simplified');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/onDemand/onDemandState.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `onDemandState.svelte.js`**

```js
import { parseServiceEntry, parseServiceList } from '$lib/onDemand/models.js';

/**
 * Browser-side on-demand state shared by the zones layer, the stop card and the
 * detail sheet. `support` flips to 'unsupported' on the first 501 from a proxy;
 * from then on no surface renders and no request is made for the session.
 */
export const onDemandState = $state({
	/** @type {'unknown' | 'supported' | 'unsupported'} */
	support: 'unknown',
	/** @type {import('./models.js').OnDemandService | null} */
	highlighted: null
});

export const CACHE_TTL_MS = 10 * 60 * 1000;

// Which cached geometry levels can answer a request for each level.
const SATISFIES = { none: ['none', 'simplified'], simplified: ['simplified'], full: ['full'] };

const viewportCache = new Map();
const serviceCache = new Map();
const inFlight = new Map();

function readCache(cache, key) {
	const hit = cache.get(key);
	if (!hit) return undefined;
	if (Date.now() - hit.at > CACHE_TTL_MS) {
		cache.delete(key);
		return undefined;
	}
	return hit.value;
}

function writeCache(cache, key, value) {
	cache.set(key, { at: Date.now(), value });
}

function shared(key, request) {
	if (!inFlight.has(key)) {
		inFlight.set(
			key,
			request().finally(() => inFlight.delete(key))
		);
	}
	return inFlight.get(key);
}

/** @returns {Promise<{ kind: 'ok', body: any } | { kind: 'notFound' } | { kind: 'unsupported' } | { kind: 'error' }>} */
async function request(url) {
	let response;
	try {
		response = await fetch(url);
	} catch {
		return { kind: 'error' };
	}
	if (response.status === 501) {
		onDemandState.support = 'unsupported';
		return { kind: 'unsupported' };
	}
	if (response.status === 404) return { kind: 'notFound' };
	if (!response.ok) return { kind: 'error' };
	try {
		const body = await response.json();
		onDemandState.support = 'supported';
		return { kind: 'ok', body };
	} catch {
		return { kind: 'error' };
	}
}

/**
 * @param {{ lat: number, lon: number, latSpan: number, lonSpan: number }} viewport
 */
export async function fetchServicesForViewport({ lat, lon, latSpan, lonSpan }) {
	if (onDemandState.support === 'unsupported') return null;
	const key = [lat, lon, latSpan, lonSpan].map((value) => value.toFixed(2)).join(',');
	const cached = readCache(viewportCache, key);
	if (cached) return cached;

	const query = new URLSearchParams({
		lat: String(lat),
		lon: String(lon),
		latSpan: String(latSpan),
		lonSpan: String(lonSpan),
		geometryDetail: 'simplified'
	});
	const result = await shared(`viewport:${key}`, () =>
		request(`/api/oba/ondemand/services-for-location?${query}`)
	);
	if (result.kind !== 'ok') return null;
	const parsed = parseServiceList(result.body);
	writeCache(viewportCache, key, parsed);
	return parsed;
}

/**
 * @param {string} id
 * @param {'none' | 'simplified' | 'full'} geometryDetail
 */
export async function fetchService(id, geometryDetail) {
	if (onDemandState.support === 'unsupported') return null;
	for (const level of SATISFIES[geometryDetail]) {
		const cached = readCache(serviceCache, `${id}|${level}`);
		if (cached) return cached;
	}

	const url = `/api/oba/ondemand/service/${encodeURIComponent(id)}?geometryDetail=${geometryDetail}`;
	const result = await shared(`service:${id}|${geometryDetail}`, () => request(url));
	if (result.kind === 'notFound') return { notFound: true };
	if (result.kind !== 'ok') return null;
	const parsed = parseServiceEntry(result.body);
	writeCache(serviceCache, `${id}|${geometryDetail}`, parsed);
	return parsed;
}

/**
 * Primes the cache from a server-rendered load so the sheet doesn't refetch.
 * @param {string} id
 * @param {'none' | 'simplified' | 'full'} geometryDetail
 * @param {any} body - service/{id} envelope
 */
export function seedService(id, geometryDetail, body) {
	writeCache(serviceCache, `${id}|${geometryDetail}`, parseServiceEntry(body));
}

/** @param {import('./models.js').OnDemandService | null} service */
export function setHighlightedService(service) {
	onDemandState.highlighted = service;
}

export function resetOnDemandStateForTesting() {
	onDemandState.support = 'unknown';
	onDemandState.highlighted = null;
	viewportCache.clear();
	serviceCache.clear();
	inFlight.clear();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/onDemand/onDemandState.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/lib/onDemand/onDemandState.svelte.js src/tests/lib/onDemand/onDemandState.test.js
git commit -m "feat(ondemand): share on-demand state in the browser

Caches viewport and per-service fetches for ten minutes, dedupes
concurrent requests, and hides every on-demand surface for the
session once the server proves unsupported."
```

---

### Task 9: Zone geometry helpers and OpenStreetMap polygons

**Files:**

- Create: `src/lib/MapHelpers/zoneGeometry.js`
- Modify: `src/lib/mapPanes.js` (add `ZONE_PANE`, `ZONE_PANE_Z_INDEX`)
- Modify: `src/lib/Provider/OpenStreetMapProvider.svelte.js`
- Modify: `src/tests/mocks/mapProviders.js` (`createMockMapProvider`: add `createPolygon`, `setPolygonStyle`, `removePolygon`, `clearAllPolygons`, `fitToBounds`, and `getBoundingBox` if it's missing)
- Test: `src/tests/lib/MapHelpers/zoneGeometry.test.js`, extend `src/tests/lib/OpenStreetMapProvider.test.js`

**Interfaces:**

- Produces (`zoneGeometry.js`):
  - `polygonsOf(geometry) → Array<Array<Array<[lon, lat]>>>` (polygons → rings → positions; rings with fewer than 4 positions are dropped; a polygon without its exterior is dropped)
  - `isClockwise(ring) → boolean`
  - `orientRing(ring, clockwise: boolean) → ring`
- Produces (provider API, every provider, used by Task 12 and Task 14):

  - `createPolygon(geometry, { color, fillOpacity, weight, opacity, halo: {weight, opacity}|null, interactive, onClick }) → handle|null`
  - `setPolygonStyle(handle, style)`, `removePolygon(handle)`, `clearAllPolygons()`
  - `fitToBounds({ north, south, east, west }, { padding }) → void`
  - `ZONE_PANE = 'obaZones'`, `ZONE_PANE_Z_INDEX = 401` in `mapPanes.js`

- [ ] **Step 1: Write the failing tests**

`src/tests/lib/MapHelpers/zoneGeometry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { polygonsOf, isClockwise, orientRing } from '$lib/MapHelpers/zoneGeometry.js';

const ccwSquare = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1],
	[0, 0]
];

describe('zoneGeometry', () => {
	it('wraps a Polygon and passes a MultiPolygon through', () => {
		expect(polygonsOf({ type: 'Polygon', coordinates: [ccwSquare] })).toEqual([[ccwSquare]]);
		expect(
			polygonsOf({ type: 'MultiPolygon', coordinates: [[ccwSquare], [ccwSquare]] })
		).toHaveLength(2);
	});

	it('drops degenerate rings and unknown geometry', () => {
		expect(
			polygonsOf({
				type: 'Polygon',
				coordinates: [
					[
						[0, 0],
						[1, 1]
					]
				]
			})
		).toEqual([]);
		expect(polygonsOf({ type: 'Point', coordinates: [0, 0] })).toEqual([]);
		expect(polygonsOf(null)).toEqual([]);
	});

	it('detects and fixes winding', () => {
		expect(isClockwise(ccwSquare)).toBe(false);
		expect(isClockwise(orientRing(ccwSquare, true))).toBe(true);
		expect(orientRing(ccwSquare, false)).toBe(ccwSquare);
	});
});
```

Add to `src/tests/lib/OpenStreetMapProvider.test.js`. Reuse that file's `makeFakeL`; extend it so `Polygon` is a constructor that records `(latlngs, options)`, has `addTo` returning itself, plus `on`, `setStyle` and `remove`. Mirror how the file's fake `Polyline` is built:

```js
describe('polygons', () => {
	function makeProvider() {
		const provider = new OpenStreetMapProvider(vi.fn());
		provider.L = makeFakeL(makeFakeMarker());
		provider.map = { hasLayer: () => true, removeLayer: vi.fn(), fitBounds: vi.fn() };
		return provider;
	}
	const geometry = {
		type: 'Polygon',
		coordinates: [
			[
				[-77.1, 38.8],
				[-77.0, 38.8],
				[-77.0, 38.9],
				[-77.1, 38.9],
				[-77.1, 38.8]
			],
			[
				[-77.06, 38.84],
				[-77.04, 38.84],
				[-77.04, 38.86],
				[-77.06, 38.86],
				[-77.06, 38.84]
			]
		]
	};

	test('draws lat/lng rings with holes on the zone pane', () => {
		const provider = makeProvider();
		const polygon = provider.createPolygon(geometry, {
			color: '#78aa36',
			fillOpacity: 0.2,
			weight: 2,
			opacity: 1
		});
		expect(polygon.latlngs[0][0][0]).toEqual([38.8, -77.1]);
		expect(polygon.latlngs[0]).toHaveLength(2);
		expect(polygon.options).toMatchObject({
			pane: 'obaZones',
			fillOpacity: 0.2,
			interactive: false
		});
	});

	test('draws a halo underneath and wires clicks only when interactive', () => {
		const provider = makeProvider();
		const onClick = vi.fn();
		const polygon = provider.createPolygon(geometry, {
			color: '#78aa36',
			fillOpacity: 0,
			weight: 4,
			opacity: 1,
			halo: { weight: 10, opacity: 0.25 },
			interactive: true,
			onClick
		});
		expect(polygon._halo.options).toMatchObject({
			fill: false,
			weight: 10,
			opacity: 0.25,
			interactive: false
		});
		const clickHandler = polygon.on.mock.calls.find(([event]) => event === 'click')[1];
		clickHandler({ originalEvent: {} });
		expect(onClick).toHaveBeenCalled();
	});

	test('clearAllPolylines leaves polygons, clearAllPolygons removes them and their halos', () => {
		const provider = makeProvider();
		const polygon = provider.createPolygon(geometry, {
			color: '#000000',
			halo: { weight: 10, opacity: 0.25 }
		});
		provider.clearAllPolylines();
		expect(polygon.remove).not.toHaveBeenCalled();
		provider.clearAllPolygons();
		expect(polygon.remove).toHaveBeenCalled();
		expect(polygon._halo.remove).toHaveBeenCalled();
		expect(provider.polygons).toEqual([]);
	});

	test('returns null for geometry with no drawable ring', () => {
		expect(makeProvider().createPolygon({ type: 'Polygon', coordinates: [] }, {})).toBeNull();
	});

	test('fitToBounds frames the bounds with Leaflet padding', () => {
		const provider = makeProvider();
		provider.L.latLngBounds = vi.fn((a, b) => ({ a, b }));
		provider.fitToBounds({ north: 38.9, south: 38.8, east: -77.0, west: -77.1 }, { padding: 40 });
		expect(provider.map.fitBounds).toHaveBeenCalledWith(
			{ a: [38.8, -77.1], b: [38.9, -77.0] },
			expect.objectContaining({ padding: [40, 40] })
		);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/MapHelpers/zoneGeometry.test.js src/tests/lib/OpenStreetMapProvider.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `zoneGeometry.js`**

```js
/**
 * GeoJSON Polygon/MultiPolygon helpers for drawing on-demand zones. Positions
 * are GeoJSON [lon, lat]. Providers disagree on hole winding (Google fills by
 * the nonzero rule, ArcGIS wants clockwise exteriors), so rings are oriented
 * explicitly rather than trusting the feed.
 */

const MIN_RING_POSITIONS = 4;

/**
 * @param {any} geometry
 * @returns {Array<Array<Array<[number, number]>>>} polygons → rings → positions
 */
export function polygonsOf(geometry) {
	if (!geometry || !Array.isArray(geometry.coordinates)) return [];
	const polygons =
		geometry.type === 'Polygon'
			? [geometry.coordinates]
			: geometry.type === 'MultiPolygon'
				? geometry.coordinates
				: [];
	return polygons
		.map((rings) => (Array.isArray(rings) ? rings.filter(isDrawableRing) : []))
		.filter((rings) => rings.length > 0);
}

function isDrawableRing(ring) {
	return Array.isArray(ring) && ring.length >= MIN_RING_POSITIONS;
}

/**
 * Shoelace sign with x = lon, y = lat: negative area winds clockwise.
 * @param {Array<[number, number]>} ring
 */
export function isClockwise(ring) {
	let twiceArea = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const [x1, y1] = ring[i];
		const [x2, y2] = ring[i + 1];
		twiceArea += x1 * y2 - x2 * y1;
	}
	return twiceArea < 0;
}

/**
 * @param {Array<[number, number]>} ring
 * @param {boolean} clockwise
 */
export function orientRing(ring, clockwise) {
	return isClockwise(ring) === clockwise ? ring : [...ring].reverse();
}
```

- [ ] **Step 4: Add the pane constants to `mapPanes.js`**

```js
/**
 * On-demand zones sit below every route layer so routes and stops stay legible
 * over a filled zone.
 */
export const ZONE_PANE = 'obaZones';
export const ZONE_PANE_Z_INDEX = 401;
```

- [ ] **Step 5: Implement the OSM polygon API**

In `OpenStreetMapProvider.svelte.js`:

- Import `ZONE_PANE, ZONE_PANE_Z_INDEX` alongside `ROUTE_PANE_Z_INDEX`, and `polygonsOf` from `$lib/MapHelpers/zoneGeometry.js`.
- In the constructor add `this.polygons = []; // On-demand zones, kept apart from polylines`.
- In `initMap`, after the route-pane loop, add:

```js
this.map.createPane(ZONE_PANE);
this.map.getPane(ZONE_PANE).style.zIndex = String(ZONE_PANE_Z_INDEX);
```

- Add these methods after `clearAllPolylines`:

```js
	/**
	 * Draws an on-demand zone. Kept off this.polylines so route fitting and
	 * clearAllPolylines never touch zones.
	 * @param {any} geometry - GeoJSON Polygon or MultiPolygon
	 * @param {{ color?: string, fillOpacity?: number, weight?: number, opacity?: number, halo?: { weight: number, opacity: number } | null, interactive?: boolean, onClick?: () => void }} style
	 * @returns {any | null}
	 */
	createPolygon(geometry, style = {}) {
		if (!browser || !this.map) return null;
		const latLngs = polygonsOf(geometry).map((rings) =>
			rings.map((ring) => ring.map(([lon, lat]) => [lat, lon]))
		);
		if (!latLngs.length) return null;

		const halo = style.halo
			? new this.L.Polygon(latLngs, this._zoneHaloOptions(style)).addTo(this.map)
			: null;
		const polygon = new this.L.Polygon(latLngs, this._zoneOptions(style)).addTo(this.map);
		polygon._halo = halo;
		if (style.interactive && style.onClick) {
			polygon.on('click', (event) => {
				// Keep the click from reaching the map (context menu, deselect).
				this.L.DomEvent?.stopPropagation?.(event);
				style.onClick();
			});
		}
		this.polygons.push(polygon);
		return polygon;
	}

	_zoneOptions(style) {
		return {
			pane: ZONE_PANE,
			color: style.color,
			weight: style.weight ?? 2,
			opacity: style.opacity ?? 1,
			fillColor: style.color,
			fillOpacity: style.fillOpacity ?? 0.2,
			interactive: Boolean(style.interactive)
		};
	}

	_zoneHaloOptions(style) {
		return {
			pane: ZONE_PANE,
			color: style.color,
			weight: style.halo.weight,
			opacity: style.halo.opacity,
			fill: false,
			interactive: false
		};
	}

	setPolygonStyle(polygon, style) {
		if (!polygon) return;
		const { interactive: _ignored, pane: _pane, ...options } = this._zoneOptions(style);
		polygon.setStyle(options);
		if (polygon._halo && style.halo) {
			polygon._halo.setStyle({ color: style.color, weight: style.halo.weight, opacity: style.halo.opacity });
		}
	}

	removePolygon(polygon) {
		if (!polygon) return;
		polygon._halo?.remove();
		polygon.remove();
		this.polygons = this.polygons.filter((item) => item !== polygon);
	}

	clearAllPolygons() {
		for (const polygon of [...this.polygons]) this.removePolygon(polygon);
	}

	/**
	 * @param {{ north: number, south: number, east: number, west: number }} bounds
	 * @param {{ padding?: number | { top?: number, right?: number, bottom?: number, left?: number } }} [options]
	 */
	fitToBounds(bounds, options = {}) {
		if (!browser || !this.map) return;
		const latLngBounds = this.L.latLngBounds([bounds.south, bounds.west], [bounds.north, bounds.east]);
		this.map.fitBounds(latLngBounds, { ...toLeafletPadding(options.padding), animate: true });
	}
```

- In `destroy()`, call `this.clearAllPolygons();` next to `this.clearAllPolylines();`.
- If ESLint flags the unused destructured names in `setPolygonStyle`, build `options` explicitly instead: `{ color, weight, opacity, fillColor, fillOpacity }`.

- [ ] **Step 6: Extend `createMockMapProvider`**

In `src/tests/mocks/mapProviders.js`, inside the returned object:

```js
		// On-demand zones
		polygons: [],
		createPolygon: vi.fn(function (geometry, style = {}) {
			const polygon = { id: `polygon_${this.polygons.length}`, geometry, style };
			this.polygons.push(polygon);
			return polygon;
		}),
		setPolygonStyle: vi.fn((polygon, style) => {
			if (polygon) polygon.style = style;
		}),
		removePolygon: vi.fn(function (polygon) {
			this.polygons = this.polygons.filter((item) => item !== polygon);
		}),
		clearAllPolygons: vi.fn(function () {
			this.polygons = [];
		}),
		fitToBounds: vi.fn(),
```

Also add `getBoundingBox: vi.fn(() => ({ north: 47.7, south: 47.5, east: -122.2, west: -122.4 }))` if the mock doesn't have it yet. Check before adding.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/MapHelpers src/tests/lib/OpenStreetMapProvider.test.js src/tests/lib/mapProviderFactory.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
npm run format
git add src/lib/MapHelpers/zoneGeometry.js src/lib/mapPanes.js src/lib/Provider/OpenStreetMapProvider.svelte.js src/tests
git commit -m "feat(map): draw polygons on OpenStreetMap

Adds a polygon API for on-demand zones on its own Leaflet pane below
the routes, tracked apart from polylines so route clearing and
fitting never touch zones, plus a bounds fit."
```

---

### Task 10: Google Maps polygons

**Files:**

- Modify: `src/lib/Provider/GoogleMapProvider.svelte.js`
- Test: extend `src/tests/lib/GoogleMapProvider.test.js`

**Interfaces:**

- Consumes: `polygonsOf`, `orientRing` (Task 9).
- Produces: the same polygon API and `fitToBounds` as Task 9.

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/lib/GoogleMapProvider.test.js`. Follow that file's existing way of installing `window.google.maps` fakes; add a `Polygon` constructor that records its options and exposes `setOptions`, `setMap` and `addListener`, plus a `LatLngBounds` constructor:

```js
describe('polygons', () => {
	let provider;
	beforeEach(() => {
		provider = new GoogleMapProvider('key', vi.fn());
		provider.map = { fitBounds: vi.fn() };
	});
	const geometry = {
		type: 'Polygon',
		coordinates: [
			[
				[-77.1, 38.8],
				[-77.0, 38.8],
				[-77.0, 38.9],
				[-77.1, 38.9],
				[-77.1, 38.8]
			],
			[
				[-77.06, 38.84],
				[-77.06, 38.86],
				[-77.04, 38.86],
				[-77.04, 38.84],
				[-77.06, 38.84]
			]
		]
	};

	test('draws exterior and hole paths with opposite winding below the routes', () => {
		const polygon = provider.createPolygon(geometry, {
			color: '#78aa36',
			fillOpacity: 0.2,
			weight: 2,
			opacity: 1
		});
		const { paths, zIndex, clickable } = polygon.options;
		expect(paths).toHaveLength(2);
		const clockwise = (path) => isClockwise(path.map(({ lat, lng }) => [lng, lat]));
		expect(clockwise(paths[0])).not.toBe(clockwise(paths[1]));
		expect(zIndex).toBeLessThan(10);
		expect(clickable).toBe(false);
	});

	test('clearAllPolylines leaves polygons; clearAllPolygons removes them and halos', () => {
		const polygon = provider.createPolygon(geometry, {
			color: '#000000',
			halo: { weight: 10, opacity: 0.25 }
		});
		provider.clearAllPolylines();
		expect(polygon.setMap).not.toHaveBeenCalledWith(null);
		provider.clearAllPolygons();
		expect(polygon.setMap).toHaveBeenCalledWith(null);
		expect(polygon._halo.setMap).toHaveBeenCalledWith(null);
	});

	test('fitToBounds passes padding through', () => {
		provider.fitToBounds({ north: 38.9, south: 38.8, east: -77.0, west: -77.1 }, { padding: 40 });
		expect(provider.map.fitBounds).toHaveBeenCalledWith(expect.anything(), 40);
	});
});
```

(Import `isClockwise` from `$lib/MapHelpers/zoneGeometry.js` at the top of the file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/GoogleMapProvider.test.js`
Expected: FAIL — `createPolygon` is not a function.

- [ ] **Step 3: Implement**

In `GoogleMapProvider.svelte.js`:

- Import `polygonsOf, orientRing` from `$lib/MapHelpers/zoneGeometry.js`.
- Below `ROUTE_LAYER_Z_INDEX`, add:

```js
// Zones draw under every route casing (10) so routes stay legible over them.
const ZONE_Z_INDEX = 5;
```

- Constructor: `this.polygons = []; // On-demand zones, kept apart from polylines`.
- Methods, after `clearAllPolylines`:

```js
	/**
	 * Draws an on-demand zone. Google fills by winding, so exteriors are made
	 * counter-clockwise and holes clockwise.
	 * @param {any} geometry - GeoJSON Polygon or MultiPolygon
	 * @param {{ color?: string, fillOpacity?: number, weight?: number, opacity?: number, halo?: { weight: number, opacity: number } | null, interactive?: boolean, onClick?: () => void }} style
	 */
	createPolygon(geometry, style = {}) {
		if (!this.map || !window.google?.maps) return null;
		const paths = polygonsOf(geometry).flatMap((rings) =>
			rings.map((ring, index) =>
				orientRing(ring, index !== 0).map(([lng, lat]) => ({ lat, lng }))
			)
		);
		if (!paths.length) return null;

		const halo = style.halo
			? new google.maps.Polygon({
					paths,
					...this._zoneHaloOptions(style),
					clickable: false,
					zIndex: ZONE_Z_INDEX - 1,
					map: this.map
				})
			: null;
		const polygon = new google.maps.Polygon({
			paths,
			...this._zoneOptions(style),
			clickable: Boolean(style.interactive),
			zIndex: ZONE_Z_INDEX,
			map: this.map
		});
		polygon._halo = halo;
		if (style.interactive && style.onClick) polygon.addListener('click', () => style.onClick());
		this.polygons.push(polygon);
		return polygon;
	}

	_zoneOptions(style) {
		return {
			strokeColor: style.color,
			strokeOpacity: style.opacity ?? 1,
			strokeWeight: style.weight ?? 2,
			fillColor: style.color,
			fillOpacity: style.fillOpacity ?? 0.2
		};
	}

	_zoneHaloOptions(style) {
		return {
			strokeColor: style.color,
			strokeOpacity: style.halo.opacity,
			strokeWeight: style.halo.weight,
			fillOpacity: 0
		};
	}

	setPolygonStyle(polygon, style) {
		if (!polygon) return;
		polygon.setOptions(this._zoneOptions(style));
		if (polygon._halo && style.halo) polygon._halo.setOptions(this._zoneHaloOptions(style));
	}

	removePolygon(polygon) {
		if (!polygon) return;
		polygon._halo?.setMap(null);
		polygon.setMap(null);
		this.polygons = this.polygons.filter((item) => item !== polygon);
	}

	clearAllPolygons() {
		for (const polygon of [...this.polygons]) this.removePolygon(polygon);
	}

	/**
	 * @param {{ north: number, south: number, east: number, west: number }} bounds
	 * @param {{ padding?: number | { top?: number, right?: number, bottom?: number, left?: number } }} [options]
	 */
	fitToBounds(bounds, options = {}) {
		if (!this.map || !window.google?.maps) return;
		const latLngBounds = new google.maps.LatLngBounds(
			{ lat: bounds.south, lng: bounds.west },
			{ lat: bounds.north, lng: bounds.east }
		);
		this.map.fitBounds(latLngBounds, options.padding ?? 48);
	}
```

- In `destroy()`, call `this.clearAllPolygons();` next to `clearAllPolylines()`.
- If the file refers to `window.google.maps` rather than a bare `google`, use the same spelling.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/GoogleMapProvider.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/lib/Provider/GoogleMapProvider.svelte.js src/tests/lib/GoogleMapProvider.test.js
git commit -m "feat(map): draw polygons on Google Maps

Implements the zone polygon API below route casings, orienting holes
against their exterior because Google fills by winding."
```

---

### Task 11: ArcGIS polygons

**Files:**

- Modify: `src/lib/Provider/ArcGISMapProvider.svelte.js`
- Test: extend `src/tests/lib/ArcGISMapProvider.test.js`

**Interfaces:**

- Consumes: `polygonsOf`, `orientRing` (Task 9).
- Produces: the same polygon API and `fitToBounds` as Task 9.

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/lib/ArcGISMapProvider.test.js`. Use its `initializedProvider()` and module mocks, and add fakes for `@arcgis/core/geometry/Polygon.js`, `@arcgis/core/geometry/Extent.js` and `@arcgis/core/symbols/SimpleFillSymbol.js` the same way the file mocks `Polyline.js` and `SimpleLineSymbol.js`:

```js
describe('polygons', () => {
	const geometry = {
		type: 'Polygon',
		coordinates: [
			[
				[-77.1, 38.8],
				[-77.0, 38.8],
				[-77.0, 38.9],
				[-77.1, 38.9],
				[-77.1, 38.8]
			]
		]
	};

	test('adds zone graphics to a layer below the route layers', async () => {
		const provider = await initializedProvider();
		provider.createPolygon(geometry, { color: '#78aa36', fillOpacity: 0.2, weight: 2, opacity: 1 });
		const layers = provider.map.layers;
		expect(layers.indexOf(provider.zoneLayer)).toBeLessThan(
			layers.indexOf(provider.routeCasingLayer)
		);
		expect(
			provider.zoneLayer.graphics.length ?? provider.zoneLayer.add.mock.calls.length
		).toBeGreaterThan(0);
	});

	test('orients the exterior ring clockwise', async () => {
		const provider = await initializedProvider();
		const graphic = provider.createPolygon(geometry, { color: '#000000' });
		expect(isClockwise(graphic.geometry.rings[0])).toBe(true);
	});

	test('a click on an interactive zone calls onClick, but a stop hit wins', async () => {
		const provider = await initializedProvider();
		const onClick = vi.fn();
		const graphic = provider.createPolygon(geometry, {
			color: '#000000',
			interactive: true,
			onClick
		});
		provider._handleHitTestResults([{ graphic }]);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	test('clearAllPolylines leaves polygons', async () => {
		const provider = await initializedProvider();
		provider.createPolygon(geometry, { color: '#000000' });
		provider.clearAllPolylines();
		expect(provider.polygons).toHaveLength(1);
		provider.clearAllPolygons();
		expect(provider.polygons).toHaveLength(0);
	});
});
```

(Adapt the layer-graphics assertions to however the file's fake `GraphicsLayer` records additions; the requirement is that zone graphics are added to `zoneLayer` and that `zoneLayer` comes first.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/ArcGISMapProvider.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `ArcGISMapProvider.svelte.js`:

- Import `polygonsOf, orientRing` from `$lib/MapHelpers/zoneGeometry.js`.
- Constructor: `this.polygons = [];`.
- Add `import('@arcgis/core/geometry/Polygon.js')`, `import('@arcgis/core/geometry/Extent.js')` and `import('@arcgis/core/symbols/SimpleFillSymbol.js')` to the `Promise.all` list, and destructure them into `this.Polygon`, `this.Extent` and `this.SimpleFillSymbol` at the matching positions.
- Create `this.zoneLayer = new this.GraphicsLayer({ title: 'Wayfinder on-demand zones' });` and put it **first** in `layers: [...]`.
- In `_handleHitTestResults`, after the existing stop/vehicle lookup, fall back to zones when no stop or vehicle was hit:

```js
	_handleHitTestResults(results) {
		const hit = results.find(({ graphic }) =>
			[this.routeStopLayer, this.vehicleLayer].includes(graphic?.layer)
		);
		const attributes = hit?.graphic?.attributes;
		if (!attributes) {
			this._handleZoneHit(results);
			return;
		}
		// ...existing route-stop / vehicle branches unchanged...
	}

	_handleZoneHit(results) {
		const zone = results.find(({ graphic }) => graphic?._onZoneClick);
		zone?.graphic._onZoneClick();
	}
```

- Methods, after `clearAllPolylines`:

```js
	/**
	 * Draws an on-demand zone in its own layer beneath the routes. ArcGIS wants
	 * clockwise exterior rings and counter-clockwise holes.
	 * @param {any} geometry - GeoJSON Polygon or MultiPolygon
	 * @param {{ color?: string, fillOpacity?: number, weight?: number, opacity?: number, halo?: { weight: number, opacity: number } | null, interactive?: boolean, onClick?: () => void }} style
	 */
	createPolygon(geometry, style = {}) {
		if (!this.zoneLayer) return null;
		const rings = polygonsOf(geometry).flatMap((polygonRings) =>
			polygonRings.map((ring, index) => orientRing(ring, index === 0))
		);
		if (!rings.length) return null;

		const zoneGeometry = new this.Polygon({ rings, spatialReference: { wkid: 4326 } });
		const graphic = new this.Graphic({ geometry: zoneGeometry, symbol: this._zoneSymbol(style) });
		if (style.halo) {
			graphic._halo = new this.Graphic({ geometry: zoneGeometry, symbol: this._zoneHaloSymbol(style) });
			this.zoneLayer.add(graphic._halo);
		}
		graphic._onZoneClick = style.interactive && style.onClick ? style.onClick : null;
		this.zoneLayer.add(graphic);
		this.polygons.push(graphic);
		return graphic;
	}

	_zoneSymbol(style) {
		return new this.SimpleFillSymbol({
			color: this._colorWithOpacity(style.color, style.fillOpacity ?? 0.2),
			outline: {
				color: this._colorWithOpacity(style.color, style.opacity ?? 1),
				width: style.weight ?? 2
			}
		});
	}

	_zoneHaloSymbol(style) {
		return new this.SimpleFillSymbol({
			color: [0, 0, 0, 0],
			outline: {
				color: this._colorWithOpacity(style.color, style.halo.opacity),
				width: style.halo.weight
			}
		});
	}

	setPolygonStyle(graphic, style) {
		if (!graphic) return;
		graphic.symbol = this._zoneSymbol(style);
		if (graphic._halo && style.halo) graphic._halo.symbol = this._zoneHaloSymbol(style);
	}

	removePolygon(graphic) {
		if (!graphic) return;
		if (graphic._halo) this.zoneLayer?.remove(graphic._halo);
		this.zoneLayer?.remove(graphic);
		this.polygons = this.polygons.filter((item) => item !== graphic);
	}

	clearAllPolygons() {
		for (const graphic of [...this.polygons]) this.removePolygon(graphic);
	}

	/**
	 * @param {{ north: number, south: number, east: number, west: number }} bounds
	 * @param {{ padding?: number | { top?: number, right?: number, bottom?: number, left?: number } }} [options]
	 */
	fitToBounds(bounds, options = {}) {
		if (!this.view || !this.Extent) return;
		const target = new this.Extent({
			xmin: bounds.west,
			ymin: bounds.south,
			xmax: bounds.east,
			ymax: bounds.north,
			spatialReference: { wkid: 4326 }
		});
		// Mirror the padding handling fitToPolylines uses in this file.
		this.view.goTo(target, { animate: true }).catch(() => {});
	}
```

- For padding in `fitToBounds`, read `fitToPolylines` in this file and apply `options.padding` the same way it does (it uses `setPadding`/`view.padding`). The requirement is that a bottom sheet doesn't cover the framed zone.
- In `destroy()`: call `this.clearAllPolygons();` next to `clearAllPolylines()`, and set `this.zoneLayer = null;` next to the other layer nulls.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/lib/ArcGISMapProvider.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/lib/Provider/ArcGISMapProvider.svelte.js src/tests/lib/ArcGISMapProvider.test.js
git commit -m "feat(map): draw polygons on ArcGIS

Implements the zone polygon API in a graphics layer beneath the
routes. Zone clicks resolve through the existing hit test after stops
and vehicles, so a stop on top of a zone still wins."
```

---

### Task 12: Zones layer on the map

**Files:**

- Create: `src/components/map/OnDemandZonesLayer.svelte`
- Modify: `src/components/map/MapView.svelte`
- Modify: `src/lib/urls.js` (add `onDemandServicePath`; test it in `src/tests/lib/urls.test.js`)
- Test: `src/components/map/__tests__/OnDemandZonesLayer.test.js`

**Interfaces:**

- Consumes: `onDemandState`, `fetchServicesForViewport` (Task 8); `zoneLevel`, `zoneStyle` (Task 6); `assignZoneColors` (Task 6); `drawableAreas` (Task 3); provider polygon API (Tasks 9–11).
- Produces:

  - `onDemandServicePath(id) → '/map/ondemand/{encoded id}'`
  - `<OnDemandZonesLayer mapProvider active viewportTick />`, where `active: boolean` is true only in NORMAL map mode and `viewportTick: number` increments on each settled map move.
  - A zone click calls `pushState(onDemandServicePath(id), { onDemandServiceId: id })`.

- [ ] **Step 1: Add the path helper and its test**

```js
/**
 * Path for an on-demand service opened on the map; shareable and pushed onto
 * history when a zone or a stop-card row is tapped.
 * @param {string} id - combined service id (e.g. "5088_77652")
 * @returns {string}
 */
export function onDemandServicePath(id) {
	return `/map/ondemand/${encodeURIComponent(id)}`;
}
```

Add to `src/tests/lib/urls.test.js`: `expect(onDemandServicePath('1_a b')).toBe('/map/ondemand/1_a%20b')`.

- [ ] **Step 2: Write the failing component tests**

`src/components/map/__tests__/OnDemandZonesLayer.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { createMockMapProvider } from '../../../tests/mocks/mapProviders.js';

const fetchServicesForViewport = vi.hoisted(() => vi.fn());
vi.mock('$lib/onDemand/onDemandState.svelte.js', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, fetchServicesForViewport };
});
const pushState = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ pushState }));

import OnDemandZonesLayer from '../OnDemandZonesLayer.svelte';
import { onDemandState, resetOnDemandStateForTesting } from '$lib/onDemand/onDemandState.svelte.js';
import { parseServiceList } from '$lib/onDemand/models.js';
import { listBody, serviceJson } from '../../../tests/fixtures/onDemand.js';

const REGION = { north: 39.0, south: 38.6, east: -76.8, west: -77.4 }; // ~44 km tall
const STREET = { north: 38.83, south: 38.81, east: -77.05, west: -77.08 }; // ~2 km
const HIDDEN = { north: 40, south: 38, east: -76, west: -78 };
const flush = async () => {
	await tick();
	await Promise.resolve();
	await tick();
};

function setup(bounds = REGION, props = {}) {
	const provider = createMockMapProvider();
	provider.getBoundingBox = vi.fn(() => bounds);
	const view = render(OnDemandZonesLayer, {
		mapProvider: provider,
		active: true,
		viewportTick: 1,
		...props
	});
	return { provider, ...view };
}

describe('OnDemandZonesLayer', () => {
	beforeEach(() => {
		resetOnDemandStateForTesting();
		fetchServicesForViewport.mockReset();
		fetchServicesForViewport.mockResolvedValue(parseServiceList(listBody()));
		pushState.mockReset();
	});

	it('draws filled, clickable zones at region level', async () => {
		const { provider } = setup(REGION);
		await flush();
		expect(fetchServicesForViewport).toHaveBeenCalledWith(
			expect.objectContaining({ latSpan: expect.closeTo(0.4), lonSpan: expect.closeTo(0.6) })
		);
		const [, style] = provider.createPolygon.mock.calls[0];
		expect(style).toMatchObject({ fillOpacity: 0.2, interactive: true });
		style.onClick();
		expect(pushState).toHaveBeenCalledWith('/map/ondemand/5088_77652', {
			onDemandServiceId: '5088_77652'
		});
	});

	it('draws stroke-only, non-interactive zones at street level', async () => {
		const { provider } = setup(STREET);
		await flush();
		expect(provider.createPolygon.mock.calls[0][1]).toMatchObject({
			fillOpacity: 0,
			interactive: false,
			halo: { weight: 10 }
		});
	});

	it('neither fetches nor draws when zoomed out past the region level', async () => {
		const { provider } = setup(HIDDEN);
		await flush();
		expect(fetchServicesForViewport).not.toHaveBeenCalled();
		expect(provider.createPolygon).not.toHaveBeenCalled();
	});

	it('restyles instead of redrawing on a new tick with the same services', async () => {
		const { provider, rerender } = setup(REGION);
		await flush();
		await rerender({ viewportTick: 2 });
		await flush();
		expect(provider.createPolygon).toHaveBeenCalledTimes(1);
	});

	it('removes zones no longer returned', async () => {
		const { provider, rerender } = setup(REGION);
		await flush();
		fetchServicesForViewport.mockResolvedValue(parseServiceList(listBody([])));
		await rerender({ viewportTick: 2 });
		await flush();
		expect(provider.removePolygon).toHaveBeenCalled();
	});

	it('clears when the map leaves normal mode or the server is unsupported', async () => {
		const { provider, rerender } = setup(REGION);
		await flush();
		await rerender({ active: false });
		await flush();
		expect(provider.removePolygon).toHaveBeenCalled();
		provider.removePolygon.mockClear();
		await rerender({ active: true, viewportTick: 3 });
		await flush();
		onDemandState.support = 'unsupported';
		await flush();
		expect(provider.removePolygon).toHaveBeenCalled();
	});

	it('discards a stale response that resolves after a newer one', async () => {
		let resolveFirst;
		fetchServicesForViewport
			.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
			.mockResolvedValueOnce(parseServiceList(listBody([serviceJson({ id: '5088_new' })])));
		const { provider, rerender } = setup(REGION);
		await rerender({ viewportTick: 2 });
		await flush();
		resolveFirst(parseServiceList(listBody([serviceJson({ id: '5088_old' })])));
		await flush();
		const drawnIds = provider.createPolygon.mock.calls.map(
			([geometry, style]) => style.serviceId ?? geometry
		);
		expect(provider.polygons).toHaveLength(1);
		expect(drawnIds).toHaveLength(1);
	});

	it('draws the highlighted service bolder and dims the rest', async () => {
		const { provider } = setup(REGION);
		await flush();
		const other = parseServiceList(listBody([serviceJson({ id: '5088_other', routeId: null })]))
			.services[0];
		onDemandState.highlighted = other;
		await flush();
		const styles = provider.setPolygonStyle.mock.calls.map(([, style]) => style);
		expect(styles.some((style) => style.opacity === 0.6)).toBe(true);
		const created = provider.createPolygon.mock.calls.map(([, style]) => style);
		expect(created.some((style) => style.weight === 4)).toBe(true);
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/map/__tests__/OnDemandZonesLayer.test.js`
Expected: FAIL — component missing.

- [ ] **Step 4: Implement `OnDemandZonesLayer.svelte`**

```svelte
<!--
    @component
    Renderless: draws on-demand zones for the current viewport. Region level
    fills zones and opens a service on click; street level strokes them with a
    halo and leaves clicks to stops and the map; zoomed further out, nothing is
    fetched or drawn. Only active in the map's normal mode.

    @prop {import('$lib/types').MapProvider | null} mapProvider
    @prop {boolean} active - false outside normal map mode
    @prop {number} viewportTick - bumped by MapView each time the map settles
-->
<script>
	import { onDestroy, untrack } from 'svelte';
	import { pushState } from '$app/navigation';
	import { onDemandState, fetchServicesForViewport } from '$lib/onDemand/onDemandState.svelte.js';
	import { zoneLevel, zoneStyle } from '$lib/onDemand/zones.js';
	import { assignZoneColors } from '$lib/onDemand/colors.js';
	import { drawableAreas } from '$lib/onDemand/models.js';
	import { onDemandServicePath } from '$lib/urls.js';

	let { mapProvider = null, active = true, viewportTick = 0 } = $props();

	let services = $state.raw([]);
	let level = $state('hidden');
	/** @type {Map<string, { handles: any[], level: string }>} */
	const drawn = new Map();
	let requestSeq = 0;

	let isEnabled = $derived(active && onDemandState.support !== 'unsupported');

	$effect(() => {
		viewportTick;
		const provider = mapProvider;
		if (!provider || !isEnabled) {
			requestSeq++;
			services = [];
			level = 'hidden';
			return;
		}
		untrack(() => refresh(provider));
	});

	$effect(() => {
		const provider = mapProvider;
		const highlighted = onDemandState.highlighted;
		const visible = isEnabled ? services : [];
		const currentLevel = level;
		if (!provider) return;
		untrack(() => draw(provider, visible, currentLevel, isEnabled ? highlighted : null));
	});

	onDestroy(() => {
		if (mapProvider) clearDrawn(mapProvider);
	});

	async function refresh(provider) {
		const bounds = provider.getBoundingBox();
		const nextLevel = bounds ? zoneLevel(bounds) : 'hidden';
		const seq = ++requestSeq;
		if (nextLevel === 'hidden') {
			level = 'hidden';
			services = [];
			return;
		}
		const result = await fetchServicesForViewport({
			lat: (bounds.north + bounds.south) / 2,
			lon: (bounds.east + bounds.west) / 2,
			latSpan: bounds.north - bounds.south,
			lonSpan: bounds.east - bounds.west
		});
		if (seq !== requestSeq) return;
		level = nextLevel;
		services = result?.services ?? [];
	}

	// The highlighted service stays drawn even when this viewport's fetch
	// didn't return it, or the map is zoomed past region level.
	function servicesToDraw(visible, highlighted) {
		if (!highlighted || visible.some((service) => service.id === highlighted.id)) return visible;
		return [...visible, highlighted];
	}

	function draw(provider, visible, currentLevel, highlighted) {
		const list = servicesToDraw(currentLevel === 'hidden' ? [] : visible, highlighted);
		const drawLevel = currentLevel === 'street' ? 'street' : 'region';
		const colors = assignZoneColors(list);
		const keep = new Set(list.map((service) => service.id));

		for (const [id, entry] of drawn) {
			if (!keep.has(id) || entry.level !== drawLevel) {
				entry.handles.forEach((handle) => provider.removePolygon(handle));
				drawn.delete(id);
			}
		}

		for (const service of list) {
			const highlight = !highlighted
				? 'none'
				: service.id === highlighted.id
					? 'selected'
					: 'dimmed';
			const style = zoneStyle({ level: drawLevel, color: colors.get(service.id), highlight });
			const existing = drawn.get(service.id);
			if (existing) {
				existing.handles.forEach((handle) => provider.setPolygonStyle(handle, style));
				continue;
			}
			const handles = drawableAreas(service)
				.map((area) =>
					provider.createPolygon(area.geometry, {
						...style,
						onClick: () => openService(service.id)
					})
				)
				.filter(Boolean);
			drawn.set(service.id, { handles, level: drawLevel });
		}
	}

	function clearDrawn(provider) {
		for (const entry of drawn.values())
			entry.handles.forEach((handle) => provider.removePolygon(handle));
		drawn.clear();
	}

	function openService(id) {
		pushState(onDemandServicePath(id), { onDemandServiceId: id });
	}
</script>
```

Note: the stale-response test counts `provider.polygons`, and the mock's `removePolygon` keeps that list in sync (Task 9 step 6). If the mock returns the same shape, the assertion `provider.polygons.length === 1` is the one that matters. Drop the looser `drawnIds` assertion if it fights the mock.

- [ ] **Step 5: Wire it into `MapView.svelte`**

- Import `OnDemandZonesLayer from './OnDemandZonesLayer.svelte'`.
- Declare `let viewportTick = $state(0);` beside `mapMode`.
- Inside the `debouncedLoadMarkers` callback, after the early-return guard and before `loadStopsAndAddMarkers(...)`, add `viewportTick += 1;`.
- After the initial `loadStopsAndAddMarkers(mapCenterLat, mapCenterLng, true)` in `initMap`, add `viewportTick += 1;` so zones load on first paint.
- Next to `<StopRoutesLayer …/>`, at the same nesting (read the surrounding `{#if}` first and place it where `mapInstance` is available), add:

```svelte
<OnDemandZonesLayer mapProvider={mapInstance} active={mapMode === Modes.NORMAL} {viewportTick} />
```

- In `src/components/__tests__/MapView.test.js`, if the test suite now fails because the layer calls `fetch`, mock `$components/map/OnDemandZonesLayer.svelte` there, the way the file mocks other children.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/map src/components/__tests__/MapView.test.js src/tests/lib/urls.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/components/map src/components/__tests__/MapView.test.js src/lib/urls.js src/tests
git commit -m "feat(ondemand): draw on-demand zones on the map

Fetches zones for the settled viewport in normal map mode and draws
them per zoom level: filled and clickable across a region, a stroke
with a halo at street level, and nothing when zoomed further out."
```

---

### Task 13: Stop card

**Files:**

- Create: `src/components/stops/OnDemandStopCard.svelte`
- Modify: `src/components/stops/StopPane.svelte`
- Modify: `src/components/stops/StopBottomSheet.svelte` (thread `onOnDemandServiceSelect`)
- Test: `src/components/stops/__tests__/OnDemandStopCard.test.js`, extend `src/components/stops/__tests__/StopPane.test.js`

**Interfaces:**

- Consumes: `fetchService`, `onDemandState` (Task 8); `evaluateAvailability`, `sortByAvailability` (Task 5); `formatStatus` (Task 7); `onDemandServiceIds`, `contactBookingRule` (Task 3); `scheduleAt`, `minInstant` (Task 4); `onDemandServicePath` (Task 12).
- Produces:

  - `<OnDemandStopCard stop onSelectService? bind:services />`. `services` is a bindable `OnDemandService[]` of the services that loaded.
  - `StopPane` prop `onOnDemandServiceSelect?: (id) => void`.
  - `StopBottomSheet` prop `onOnDemandServiceSelect?: (id) => void`, forwarded to `StopPane`.

- [ ] **Step 1: Write the failing tests**

`src/components/stops/__tests__/OnDemandStopCard.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';

const fetchService = vi.hoisted(() => vi.fn());
vi.mock('$lib/onDemand/onDemandState.svelte.js', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, fetchService };
});

import OnDemandStopCard from '../OnDemandStopCard.svelte';
import { onDemandState, resetOnDemandStateForTesting } from '$lib/onDemand/onDemandState.svelte.js';
import { parseServiceEntry } from '$lib/onDemand/models.js';
import { entryBody, serviceJson } from '../../../tests/fixtures/onDemand.js';

const entry = (overrides) => parseServiceEntry(entryBody(serviceJson(overrides)));
const flush = async () => {
	for (let i = 0; i < 3; i++) {
		await tick();
		await Promise.resolve();
	}
};

describe('OnDemandStopCard', () => {
	beforeEach(() => {
		resetOnDemandStateForTesting();
		fetchService.mockReset();
	});

	it('renders nothing for a stop without on-demand ids', async () => {
		const { container } = render(OnDemandStopCard, { stop: { id: '1_1' } });
		await flush();
		expect(fetchService).not.toHaveBeenCalled();
		expect(container.textContent.trim()).toBe('');
	});

	it('lists each loaded service with a link to its sheet and a call link', async () => {
		fetchService.mockResolvedValue(entry());
		render(OnDemandStopCard, { stop: { id: '1_1', onDemandServiceIds: ['5088_77652'] } });
		await flush();
		expect(fetchService).toHaveBeenCalledWith('5088_77652', 'none');
		expect(screen.getByText('ondemand.card_title')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /DASH On Demand/ })).toHaveAttribute(
			'href',
			'/map/ondemand/5088_77652'
		);
		expect(document.querySelector('a[href="tel:703-746-5222"]')).not.toBeNull();
	});

	it('drops failed services and hides when none load', async () => {
		fetchService.mockResolvedValueOnce(null).mockResolvedValueOnce({ notFound: true });
		const { container } = render(OnDemandStopCard, {
			stop: { id: '1_1', onDemandServiceIds: ['a', 'b'] }
		});
		await flush();
		expect(container.textContent.trim()).toBe('');
	});

	it('does not refetch when the stop object is replaced with the same ids', async () => {
		fetchService.mockResolvedValue(entry());
		const { rerender } = render(OnDemandStopCard, {
			stop: { id: '1_1', onDemandServiceIds: ['5088_77652'] }
		});
		await flush();
		await rerender({ stop: { id: '1_1', onDemandServiceIds: ['5088_77652'] } });
		await flush();
		expect(fetchService).toHaveBeenCalledTimes(1);
	});

	it('hides when the server is unsupported', async () => {
		onDemandState.support = 'unsupported';
		const { container } = render(OnDemandStopCard, {
			stop: { id: '1_1', onDemandServiceIds: ['x'] }
		});
		await flush();
		expect(fetchService).not.toHaveBeenCalled();
		expect(container.textContent.trim()).toBe('');
	});

	it('hands the click to onSelectService when provided', async () => {
		fetchService.mockResolvedValue(entry());
		const onSelectService = vi.fn();
		render(OnDemandStopCard, {
			stop: { id: '1_1', onDemandServiceIds: ['5088_77652'] },
			onSelectService
		});
		await flush();
		await userEvent.click(screen.getByRole('link', { name: /DASH On Demand/ }));
		expect(onSelectService).toHaveBeenCalledWith('5088_77652');
	});
});
```

In `StopPane.test.js`, add one test for the flex-only empty state. Mock `$components/stops/OnDemandStopCard.svelte` with a stub that sets its bound `services` to one item (`props.services = [{ id: 'x' }]`, following the capture-props stub pattern in `MapExperience.test.js`). Give it an empty arrivals response and assert that `ondemand.flex_only_empty_arrivals` is shown instead of `no_arrivals_found_in_next_minutes`. If the stub can't drive the binding in this Svelte version, test through the real card with `fetchService` mocked as above.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/stops/__tests__/OnDemandStopCard.test.js`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `OnDemandStopCard.svelte`**

```svelte
<!--
    @component
    On-demand services available at a stop. Fetches each of the stop's
    onDemandServiceIds once per id set (the arrivals poll re-renders the stop
    every 30 s without refetching). A service that fails to load is left out;
    the card never shows an error because the arrivals are the page.

    @prop {Object} stop - OBA stop; reads stop.onDemandServiceIds
    @prop {(id: string) => void} [onSelectService] - opens the service in place (map sheet); links navigate otherwise
    @prop {Array} services - Bindable; the services that loaded
-->
<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPhone } from '@fortawesome/free-solid-svg-icons';
	import { locale, t } from 'svelte-i18n';
	import { fetchService, onDemandState } from '$lib/onDemand/onDemandState.svelte.js';
	import { contactBookingRule, onDemandServiceIds } from '$lib/onDemand/models.js';
	import { evaluateAvailability, sortByAvailability } from '$lib/onDemand/availability.js';
	import { formatStatus } from '$lib/onDemand/copy.js';
	import { minInstant, scheduleAt } from '$lib/onDemand/instants.js';
	import { onDemandServicePath } from '$lib/urls.js';

	let { stop, onSelectService = null, services = $bindable([]) } = $props();

	let now = $state(Temporal.Now.instant());
	let idsKey = $derived([...onDemandServiceIds(stop)].sort().join('|'));
	let isSupported = $derived(onDemandState.support !== 'unsupported');

	$effect(() => {
		const key = idsKey;
		if (!key || !isSupported) {
			services = [];
			return;
		}
		let cancelled = false;
		Promise.all(key.split('|').map((id) => fetchService(id, 'none'))).then((results) => {
			if (cancelled) return;
			services = results.filter((result) => result?.service).map((result) => result.service);
		});
		return () => {
			cancelled = true;
		};
	});

	let rows = $derived(
		sortByAvailability(
			services.map((service) => ({ service, availability: evaluateAvailability(service, now) })),
			$locale ?? undefined
		)
	);

	$effect(() => {
		const next = minInstant(rows.map((row) => row.availability.nextChangeInstant));
		return scheduleAt(next, () => (now = Temporal.Now.instant()));
	});

	function statusLine(availability) {
		if (!availability.timeZone) return null;
		const ctx = { t: $t, locale: $locale ?? 'en', timeZone: availability.timeZone, now };
		return formatStatus(availability.status, ctx, 'row');
	}

	function select(event, id) {
		if (!onSelectService) return;
		event.preventDefault();
		onSelectService(id);
	}
</script>

{#if isSupported && rows.length}
	<section class="mb-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
		<h3 class="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
			{$t('ondemand.card_title')}
		</h3>
		<ul class="divide-y divide-gray-200 dark:divide-gray-700">
			{#each rows as { service, availability } (service.id)}
				{@const phone = contactBookingRule(service)?.phoneNumber}
				{@const status = statusLine(availability)}
				<li class="flex items-center gap-3 py-2">
					<a
						href={onDemandServicePath(service.id)}
						onclick={(event) => select(event, service.id)}
						class="min-w-0 flex-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
					>
						<span class="block truncate font-medium text-gray-900 dark:text-white"
							>{service.name}</span
						>
						{#if status}
							<span class="block text-sm text-gray-600 dark:text-gray-400">{status}</span>
						{/if}
					</a>
					{#if phone}
						<a
							href={`tel:${phone}`}
							aria-label={$t('ondemand.call', { values: { phone } })}
							class="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-accent text-white hover:bg-brand"
						>
							<FontAwesomeIcon icon={faPhone} />
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
```

(Match the card's surface and text classes to `ServiceAlerts` / the stop pane so it looks native. `h-11 w-11` is the 44 px touch target.)

- [ ] **Step 4: Mount it in `StopPane.svelte` and thread the handler**

- Import `OnDemandStopCard from '$components/stops/OnDemandStopCard.svelte'`.
- Add `onOnDemandServiceSelect = null` to the destructured `$props()`, and declare `let onDemandServices = $state([]);` near the other state.
- Directly after the `{#if serviceAlerts?.length}…{/if}` block, add:

```svelte
<OnDemandStopCard
	{stop}
	onSelectService={onOnDemandServiceSelect}
	bind:services={onDemandServices}
/>
```

- In the `loadMoreButton` snippet, change the `emptyResults` text to:

```svelte
						{#if emptyResults}
							<p class="text-sm text-gray-600 dark:text-gray-400">
								{onDemandServices.length
									? $t('ondemand.flex_only_empty_arrivals')
									: $t('no_arrivals_found_in_next_minutes', { values: { minutes: minutesAfter } })}
							</p>
```

- In `StopBottomSheet.svelte`, add `onOnDemandServiceSelect = null` to the props (plus the `@prop` doc line) and pass `{onOnDemandServiceSelect}` to `<StopPane …>`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/stops`
Expected: PASS, including all pre-existing StopPane / StopBottomSheet tests.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/components/stops
git commit -m "feat(ondemand): show on-demand service on stops

Adds an on-demand card to the stop pane listing each service with its
status and a call link, and tells riders at a flex-only stop that
on-demand service is available instead of only 'no arrivals'."
```

---

### Task 14: Service detail sheet

**Files:**

- Create: `src/components/ondemand/OnDemandServiceSheet.svelte`
- Test: `src/components/ondemand/__tests__/OnDemandServiceSheet.test.js`

**Interfaces:**

- Consumes: `fetchService`, `setHighlightedService`, `onDemandState` (Task 8); `evaluateAvailability`, `TIER` (Task 5); `formatStatus`, `formatBookingLine`, `bookingTagKey` (Task 7); `hoursRows` (Task 6); `whereSummary`, `serviceBounds` (Task 3); `contactBookingRule` (Task 3); `scheduleAt` (Task 4); `panelFitPadding` (`$lib/mapFitPadding.js`); `BottomSheet` (`$components/navigation/BottomSheet.svelte`).
- Produces: `<OnDemandServiceSheet serviceId closePane mapProvider bind:snap />`.

- [ ] **Step 1: Write the failing tests**

`src/components/ondemand/__tests__/OnDemandServiceSheet.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';

const fetchService = vi.hoisted(() => vi.fn());
vi.mock('$lib/onDemand/onDemandState.svelte.js', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, fetchService };
});

import OnDemandServiceSheet from '../OnDemandServiceSheet.svelte';
import { onDemandState, resetOnDemandStateForTesting } from '$lib/onDemand/onDemandState.svelte.js';
import { parseServiceEntry } from '$lib/onDemand/models.js';
import {
	entryBody,
	serviceJson,
	referencesJson,
	ruleJson,
	bookingRuleJson,
	square
} from '../../../tests/fixtures/onDemand.js';
import { createMockMapProvider } from '../../../tests/mocks/mapProviders.js';

const flush = async () => {
	for (let i = 0; i < 4; i++) {
		await tick();
		await Promise.resolve();
	}
};
const entry = (serviceOverrides = {}, refOverrides = {}) =>
	parseServiceEntry(entryBody(serviceJson(serviceOverrides), referencesJson(refOverrides)));

function setup(result) {
	fetchService.mockResolvedValue(result);
	const provider = createMockMapProvider();
	const closePane = vi.fn();
	const view = render(OnDemandServiceSheet, {
		serviceId: '5088_77652',
		closePane,
		mapProvider: provider
	});
	return { provider, closePane, ...view };
}

describe('OnDemandServiceSheet', () => {
	beforeEach(() => {
		resetOnDemandStateForTesting();
		fetchService.mockReset();
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		vi.setSystemTime(new Date('2026-03-10T23:59:00Z')); // 16:59 PDT, before the 17:00 cutoff
	});
	afterEach(() => vi.useRealTimers());

	it('loads simplified geometry, highlights the zone and frames it', async () => {
		const { provider } = setup(entry());
		await flush();
		expect(fetchService).toHaveBeenCalledWith('5088_77652', 'simplified');
		expect(onDemandState.highlighted?.id).toBe('5088_77652');
		expect(provider.fitToBounds).toHaveBeenCalledWith(
			{ west: -77.14, south: 38.79, east: -77.05, north: 38.84 },
			expect.anything()
		);
	});

	it('promotes the deadline for an advance service and offers a call', async () => {
		setup(entry());
		await flush();
		expect(screen.getByText('DASH On Demand')).toBeInTheDocument();
		expect(screen.getByText('ondemand.tag_advance')).toBeInTheDocument();
		expect(screen.getByTestId('ondemand-deadline')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'ondemand.call' })).toHaveAttribute(
			'href',
			'tel:703-746-5222'
		);
		expect(screen.getByText('Call to book your ride.')).toBeInTheDocument();
	});

	it('shows the status line, not the deadline row, for a real-time service', async () => {
		const realTime = bookingRuleJson({
			bookingType: 0,
			priorNoticeLastDay: null,
			priorNoticeLastTime: null,
			priorNoticeStartDay: null,
			priorNoticeStartTime: null,
			phoneNumber: null,
			bookingUrl: 'https://book.example'
		});
		setup(entry({}, { bookingRules: [realTime] }));
		await flush();
		expect(screen.queryByTestId('ondemand-deadline')).toBeNull();
		expect(screen.getByTestId('ondemand-status')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'ondemand.book_online' })).toHaveAttribute(
			'href',
			'https://book.example'
		);
	});

	it('shows Where only for zone-to-zone or multi-area services', async () => {
		setup(entry());
		await flush();
		expect(screen.queryByText('ondemand.where')).toBeNull();

		const refs = {
			serviceAreas: [
				...referencesJson().serviceAreas,
				{
					id: 'zone_b',
					name: 'Old Town',
					bbox: [-77.06, 38.8, -77.03, 38.82],
					geometry: square(-77.06, 38.8, -77.03, 38.82)
				}
			]
		};
		setup(entry({ rules: [ruleJson({ toIds: ['zone_b'] })] }, refs));
		await flush();
		expect(screen.getByText('ondemand.where')).toBeInTheDocument();
		expect(screen.getByText('Old Town')).toBeInTheDocument();
	});

	it('hides More information when it equals the service url', async () => {
		setup(
			entry({}, { bookingRules: [bookingRuleJson({ infoUrl: 'https://dashbus.com/ondemand' })] })
		);
		await flush();
		expect(screen.getByRole('link', { name: 'ondemand.open_agency_website' })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'ondemand.more_information' })).toBeNull();
	});

	it('says the service is not available on a not-found', async () => {
		setup({ notFound: true });
		await flush();
		expect(screen.getByText('ondemand.not_available')).toBeInTheDocument();
	});

	it('offers a retry on failure', async () => {
		setup(null);
		await flush();
		fetchService.mockResolvedValue(entry());
		await userEvent
			.setup({ advanceTimers: vi.advanceTimersByTime })
			.click(screen.getByRole('button', { name: 'ondemand.retry' }));
		await flush();
		expect(screen.getByText('DASH On Demand')).toBeInTheDocument();
	});

	it('closes itself when the server turns out unsupported', async () => {
		fetchService.mockImplementation(async () => {
			onDemandState.support = 'unsupported';
			return null;
		});
		const provider = createMockMapProvider();
		const closePane = vi.fn();
		render(OnDemandServiceSheet, { serviceId: 'x', closePane, mapProvider: provider });
		await flush();
		expect(closePane).toHaveBeenCalled();
	});

	it('re-evaluates at the deadline without refetching', async () => {
		setup(entry());
		await flush();
		expect(screen.getByTestId('ondemand-deadline')).toBeInTheDocument();
		vi.advanceTimersByTime(2 * 60 * 1000); // past 17:00 PDT
		await flush();
		expect(fetchService).toHaveBeenCalledTimes(1);
		// Now booking is for the next service day (Thu); the deadline row still renders.
		expect(screen.getByTestId('ondemand-deadline').textContent).toContain(
			'ondemand.book_by_for_ride'
		);
	});

	it('clears the highlight when unmounted', async () => {
		const { unmount } = setup(entry());
		await flush();
		unmount();
		expect(onDemandState.highlighted).toBeNull();
	});
});
```

Notes: `svelte-i18n`'s global mock `t` returns the key, so assertions use keys. `$locale` is 'en'. If `BottomSheet` doesn't mount in jsdom, mock `$components/navigation/BottomSheet.svelte` with a stub that renders its `header` and `children` snippets. Check `StopBottomSheet.test.js` for the existing approach.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/ondemand`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `OnDemandServiceSheet.svelte`**

```svelte
<!--
    @component
    Detail for one on-demand service in a bottom sheet over the map: status and
    how to book, hours, where it goes. Highlights and frames the service's zone
    while open. Status re-evaluates at its next change instant (and when the tab
    becomes visible) without refetching.

    @prop {string} serviceId - combined service id
    @prop {Function} closePane - closes the sheet
    @prop {import('$lib/types').MapProvider | null} mapProvider
    @prop {('peek'|'half'|'full')} snap - Bindable sheet detent
-->
<script>
	import { onDestroy } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faX,
		faPhone,
		faClock,
		faArrowUpRightFromSquare,
		faCircleInfo
	} from '@fortawesome/free-solid-svg-icons';
	import { locale, t } from 'svelte-i18n';
	import BottomSheet from '$components/navigation/BottomSheet.svelte';
	import { keybinding } from '$lib/keybinding';
	import { panelFitPadding } from '$lib/mapFitPadding.js';
	import {
		fetchService,
		onDemandState,
		setHighlightedService
	} from '$lib/onDemand/onDemandState.svelte.js';
	import { contactBookingRule } from '$lib/onDemand/models.js';
	import { whereSummary, serviceBounds } from '$lib/onDemand/serviceDetails.js';
	import { evaluateAvailability, TIER } from '$lib/onDemand/availability.js';
	import { formatStatus, formatBookingLine, bookingTagKey } from '$lib/onDemand/copy.js';
	import { hoursRows } from '$lib/onDemand/hours.js';
	import { scheduleAt } from '$lib/onDemand/instants.js';

	let { serviceId, closePane, mapProvider = null, snap = $bindable('half') } = $props();

	/** @type {{ kind: 'loading' } | { kind: 'ready', service: any } | { kind: 'notFound' } | { kind: 'error' }} */
	let loadState = $state({ kind: 'loading' });
	let now = $state(Temporal.Now.instant());
	let sheetElement = $state(null);

	$effect(() => {
		load(serviceId);
	});

	async function load(id) {
		loadState = { kind: 'loading' };
		const result = await fetchService(id, 'simplified');
		if (id !== serviceId) return;
		if (!result) {
			if (onDemandState.support === 'unsupported') closePane();
			else loadState = { kind: 'error' };
			return;
		}
		if (result.notFound) {
			loadState = { kind: 'notFound' };
			return;
		}
		loadState = { kind: 'ready', service: result.service };
		setHighlightedService(result.service);
		frame(result.service);
	}

	function frame(service) {
		const bounds = serviceBounds(service);
		if (!bounds || !mapProvider?.fitToBounds) return;
		const padding = panelFitPadding(sheetElement?.getBoundingClientRect(), {
			width: window.innerWidth,
			height: window.innerHeight
		});
		mapProvider.fitToBounds(bounds, { padding });
	}

	onDestroy(() => setHighlightedService(null));

	let service = $derived(loadState.kind === 'ready' ? loadState.service : null);
	let availability = $derived(service ? evaluateAvailability(service, now) : null);
	let copyContext = $derived(
		availability?.timeZone
			? { t: $t, locale: $locale ?? 'en', timeZone: availability.timeZone, now }
			: null
	);
	let contact = $derived(service ? contactBookingRule(service) : null);
	let where = $derived(service ? whereSummary(service) : null);
	let hours = $derived(
		service
			? hoursRows(service, {
					locale: $locale ?? 'en',
					today: availability?.today ?? Temporal.Now.plainDateISO()
				})
			: []
	);
	let showStatusLine = $derived(
		availability &&
			(availability.tier === TIER.OPEN_NOW ||
				availability.tier === TIER.SAME_DAY ||
				(availability.tier === TIER.UNKNOWN && availability.status.kind === 'closed'))
	);
	let statusLine = $derived(
		showStatusLine && copyContext ? formatStatus(availability.status, copyContext, 'detail') : null
	);
	let deadlineLine = $derived(
		availability?.tier === TIER.ADVANCE && copyContext
			? formatBookingLine(availability.resolution, copyContext)
			: null
	);
	let bookingLine = $derived(
		availability && copyContext
			? formatBookingLine(availability.resolution, copyContext)
			: $t('ondemand.booking_unknown')
	);
	let tagKey = $derived(availability ? bookingTagKey(availability.bookingTier) : null);
	let moreInfoUrl = $derived(
		contact?.infoUrl && contact.infoUrl !== service?.url ? contact.infoUrl : null
	);
	let messages = $derived(
		[contact?.message, contact?.pickupMessage, contact?.dropOffMessage].filter(Boolean)
	);

	$effect(() =>
		scheduleAt(availability?.nextChangeInstant ?? null, () => (now = Temporal.Now.instant()))
	);

	$effect(() => {
		const onVisible = () => {
			if (document.visibilityState === 'visible') now = Temporal.Now.instant();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	function hoursText(row) {
		if (row.kind === 'allHours') return $t('ondemand.all_service_hours');
		if (row.kind === 'noService') return $t('ondemand.no_service');
		const suffix = (nextDay) => (nextDay ? ` ${$t('ondemand.next_day')}` : '');
		return `${row.start}${suffix(row.startNextDay)} – ${row.end}${suffix(row.endNextDay)}`;
	}
</script>

<BottomSheet bind:snap bind:element={sheetElement}>
	{#snippet header()}
		<div class="-mx-3.5 border-b border-gray-200 px-3.5 pb-3 dark:border-gray-700">
			<div class="flex items-start gap-2.5">
				<h2 class="min-w-0 flex-1 text-xl font-bold text-black dark:text-white">
					{service?.name ?? ''}
				</h2>
				<button
					type="button"
					onclick={closePane}
					use:keybinding={{ code: 'Escape' }}
					aria-label={$t('ondemand.close')}
					class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-200 text-sm text-black hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
				>
					<FontAwesomeIcon icon={faX} />
				</button>
			</div>
		</div>
	{/snippet}

	<div class="space-y-5 py-3">
		{#if loadState.kind === 'notFound'}
			<p class="text-sm text-gray-600 dark:text-gray-400">{$t('ondemand.not_available')}</p>
		{:else if loadState.kind === 'error'}
			<div class="flex flex-col items-start gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-400">{$t('ondemand.load_failed')}</p>
				<button
					type="button"
					onclick={() => load(serviceId)}
					class="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand"
				>
					{$t('ondemand.retry')}
				</button>
			</div>
		{:else if service}
			<section class="space-y-2">
				{#if tagKey}
					<span
						class="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-900 dark:bg-green-900/40 dark:text-green-100"
					>
						{$t(tagKey)}
					</span>
				{/if}
				{#if service.description}
					<p class="text-sm text-gray-700 dark:text-gray-300">{service.description}</p>
				{/if}
				{#if statusLine}
					<p
						data-testid="ondemand-status"
						class="text-sm font-medium text-gray-900 dark:text-white"
					>
						{statusLine}
					</p>
				{/if}
				{#if contact?.phoneNumber}
					<a
						href={`tel:${contact.phoneNumber}`}
						class="inline-flex h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-white hover:bg-brand"
					>
						<FontAwesomeIcon icon={faPhone} />
						{$t('ondemand.call', { values: { phone: contact.phoneNumber } })}
					</a>
				{:else if contact?.bookingUrl}
					<a
						href={contact.bookingUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-white hover:bg-brand"
					>
						{$t('ondemand.book_online')}
					</a>
				{/if}
			</section>

			{#if deadlineLine}
				<p
					data-testid="ondemand-deadline"
					class="flex items-start gap-2 text-sm text-gray-900 dark:text-white"
				>
					<FontAwesomeIcon icon={faClock} class="mt-0.5" />
					<span>{deadlineLine}</span>
				</p>
			{/if}

			{#if where?.show}
				<section>
					<h3 class="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
						{$t('ondemand.where')}
					</h3>
					<dl class="space-y-1 text-sm">
						<div>
							<dt class="font-medium text-gray-900 dark:text-white">
								{$t('ondemand.service_area')}
							</dt>
							<dd class="text-gray-600 dark:text-gray-400">
								{where.serviceAreaNames.length
									? where.serviceAreaNames.join(', ')
									: $t('ondemand.zone_count', { values: { count: where.serviceAreaCount } })}
							</dd>
						</div>
						{#if where.dropOffNames?.length}
							<div>
								<dt class="font-medium text-gray-900 dark:text-white">{$t('ondemand.drop_off')}</dt>
								<dd class="text-gray-600 dark:text-gray-400">{where.dropOffNames.join(', ')}</dd>
							</div>
						{/if}
					</dl>
				</section>
			{/if}

			{#if hours.length}
				<section>
					<h3 class="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
						{$t('ondemand.when')}
					</h3>
					<dl class="space-y-1 text-sm">
						{#each hours as row, index (index)}
							<div
								class="flex justify-between gap-4"
								class:text-gray-500={row.kind === 'noService'}
							>
								<dt>{row.days}</dt>
								<dd>{hoursText(row)}</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/if}

			<section class="space-y-2 text-sm">
				<h3 class="font-semibold text-gray-900 dark:text-white">{$t('ondemand.how_to_book')}</h3>
				<p class="flex items-start gap-2 text-gray-700 dark:text-gray-300">
					<FontAwesomeIcon icon={faClock} class="mt-0.5" />
					<span>{bookingLine}</span>
				</p>
				{#if service.url}
					<a
						href={service.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2 text-brand-accent hover:underline"
					>
						<FontAwesomeIcon icon={faArrowUpRightFromSquare} />
						{$t('ondemand.open_agency_website')}
					</a>
				{/if}
				{#if moreInfoUrl}
					<a
						href={moreInfoUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2 text-brand-accent hover:underline"
					>
						<FontAwesomeIcon icon={faCircleInfo} />
						{$t('ondemand.more_information')}
					</a>
				{/if}
			</section>

			{#if messages.length}
				<footer class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
					{#each messages as message, index (index)}
						<p>{message}</p>
					{/each}
				</footer>
			{/if}
		{/if}
	</div>
</BottomSheet>
```

Accessibility check: the icon-only close button has an `aria-label`. The pill links render their visible text, so they have accessible names. With the global `t` mock the `tel:` link's name is `ondemand.call`, which the test depends on.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/ondemand`
Expected: PASS. If the "re-evaluates at the deadline" test is flaky because Temporal reads the real clock, confirm that `vi.setSystemTime` also moves `Temporal.Now` (the polyfill reads `Date.now()`). If it doesn't, stub `Temporal.Now.instant` with `vi.spyOn(Temporal.Now, 'instant')` for that test.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/ondemand
git commit -m "feat(ondemand): add the service detail sheet

Shows a service's status, booking deadline and actions, hours and
where it goes, highlights its zone on the map, and ticks the status
over at the next boundary without refetching."
```

---

### Task 15: Route, map-shell integration and cold loads

**Files:**

- Create: `src/routes/(map)/map/ondemand/[serviceId]/+page.server.js`
- Create: `src/routes/(map)/map/ondemand/[serviceId]/+page.svelte`
- Modify: `src/components/MapExperience.svelte`
- Test: `src/tests/routes/mapOnDemandLoad.test.js`, extend `src/components/__tests__/MapExperience.test.js`

**Interfaces:**

- Consumes: `loadServiceEntry` (Task 1); `seedService` (Task 8); `OnDemandServiceSheet` (Task 14); `onDemandServicePath` (Task 12); `StopBottomSheet`'s `onOnDemandServiceSelect` (Task 13).
- Produces: `load({ params }) → { onDemandServiceId, onDemandEntry: body | null }`, redirecting to `/` when the server is unsupported. `MapExperience` renders the sheet when `$page.state.onDemandServiceId` is set.

- [ ] **Step 1: Write the failing tests**

`src/tests/routes/mapOnDemandLoad.test.js`:

```js
import { describe, test, expect, vi, beforeEach } from 'vitest';

const loadServiceEntry = vi.hoisted(() => vi.fn());
vi.mock('$lib/onDemand/upstream.server.js', () => ({ loadServiceEntry }));

import { load } from '../../routes/(map)/map/ondemand/[serviceId]/+page.server.js';

describe('/(map)/map/ondemand/[serviceId] load', () => {
	beforeEach(() => loadServiceEntry.mockReset());

	test('returns the envelope for a known service', async () => {
		loadServiceEntry.mockResolvedValue({ kind: 'ok', body: { code: 200 } });
		expect(await load({ params: { serviceId: '5088_77652' } })).toEqual({
			onDemandServiceId: '5088_77652',
			onDemandEntry: { code: 200 }
		});
		expect(loadServiceEntry).toHaveBeenCalledWith('5088_77652', 'simplified');
	});

	test('returns a null entry when not found, letting the sheet say so', async () => {
		loadServiceEntry.mockResolvedValue({ kind: 'notFound' });
		expect((await load({ params: { serviceId: 'x' } })).onDemandEntry).toBeNull();
	});

	test('redirects home when the server has no on-demand support', async () => {
		loadServiceEntry.mockResolvedValue({ kind: 'unsupported' });
		await expect(load({ params: { serviceId: 'x' } })).rejects.toMatchObject({
			status: 307,
			location: '/'
		});
	});
});
```

In `MapExperience.test.js`, add:

- A stub for `$components/ondemand/OnDemandServiceSheet.svelte` that inserts `data-testid="ondemand-sheet"` and captures its props, following the `StopBottomSheet` stub.
- A test that sets page state `{ onDemandServiceId: '5088_77652' }` the same way the file's existing stop-sheet tests set `stopData`, then asserts that the sheet renders with `serviceId === '5088_77652'`, and that calling its captured `closePane()` calls `pushState('/', {})`.
- A test that the `onOnDemandServiceSelect` passed to the stop sheet calls `pushState('/map/ondemand/5088_77652', { onDemandServiceId: '5088_77652' })`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/routes/mapOnDemandLoad.test.js src/components/__tests__/MapExperience.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

`+page.server.js`:

```js
import { redirect } from '@sveltejs/kit';
import { loadServiceEntry } from '$lib/onDemand/upstream.server.js';

/**
 * Cold-load / share path for an on-demand service opened on the map. The sheet
 * itself is rendered by MapExperience from page state; this load supplies the
 * entry so the first paint needs no client fetch.
 */
export async function load({ params }) {
	const result = await loadServiceEntry(params.serviceId, 'simplified');
	if (result.kind === 'unsupported') redirect(307, '/');
	return {
		onDemandServiceId: params.serviceId,
		onDemandEntry: result.kind === 'ok' ? result.body : null
	};
}
```

`+page.svelte`:

```svelte
<!--
    "/map/ondemand/{id}" — the map with this on-demand service's sheet open. The
    map and sheet are rendered by the (map) layout (MapExperience); this page
    seeds the client cache from the server load and emits head tags.
-->
<script>
	import { browser } from '$app/environment';
	import { PUBLIC_OBA_REGION_NAME } from '$env/static/public';
	import { seedService } from '$lib/onDemand/onDemandState.svelte.js';

	let { data } = $props();

	// Browser only: the cache is module state, which on the server would be shared
	// across every request.
	$effect.pre(() => {
		if (browser && data.onDemandEntry) {
			seedService(data.onDemandServiceId, 'simplified', data.onDemandEntry);
		}
	});

	let title = $derived(data.onDemandEntry?.data?.entry?.name ?? PUBLIC_OBA_REGION_NAME);
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>
```

- [ ] **Step 4: Integrate into `MapExperience.svelte`**

- Import `OnDemandServiceSheet from '$components/ondemand/OnDemandServiceSheet.svelte'` and `onDemandServicePath` from `$lib/urls.js`.
- After `stopSheetOpen`, add:

```js
// Like stops, the open on-demand service is driven by page.state (shallow
// routing); a cold load copies it across in afterNavigate below.
let selectedOnDemandServiceId = $derived($page.state?.onDemandServiceId ?? null);
let onDemandSheetOpen = $derived(!stopSheetOpen && selectedOnDemandServiceId != null);

function handleOnDemandServiceSelect(id) {
	pushState(onDemandServicePath(id), { onDemandServiceId: id });
}
```

- `closePane()`: change the first guard to `if (stopSheetOpen || onDemandSheetOpen) {`.
- In the `afterNavigate` timeout callback, add:

```js
if ($page.data?.onDemandServiceId && !$page.state?.onDemandServiceId) {
	replaceState('', { onDemandServiceId: $page.data.onDemandServiceId });
}
```

- `<StopBottomSheet …>`: add `onOnDemandServiceSelect={handleOnDemandServiceSelect}`.
- In the pane chain, directly after the `{#if stopSheetOpen}…` branch, add:

```svelte
				{:else if onDemandSheetOpen}
					<OnDemandServiceSheet
						serviceId={selectedOnDemandServiceId}
						{closePane}
						{mapProvider}
						bind:snap={sheetSnap}
					/>
```

- If the collapsed-search behaviour keys off `stopSheetOpen` (`showCollapsedSearch`), extend it to `(stopSheetOpen || onDemandSheetOpen) && searchCollapsed` so the sheet gets the same space on mobile.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/tests/routes src/components/__tests__/MapExperience.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/routes/\(map\)/map/ondemand src/components/MapExperience.svelte src/components/__tests__/MapExperience.test.js src/tests/routes
git commit -m "feat(ondemand): open services at /map/ondemand/[id]

Adds a shareable map route for an on-demand service. Zone clicks and
stop-card rows push it with shallow routing like stops do, and a cold
load seeds the sheet from the server so it paints without a fetch."
```

---

### Task 16: Full verification

**Files:** none new, unless a fix is needed.

- [ ] **Step 1: Run the full quality gate**

```bash
npm run format
npm run lint
npx vitest run --coverage
```

Expected: lint is clean, every test passes, and coverage is at or above 70% for branches, functions, lines and statements. Fix any failure with a scoped commit.

- [ ] **Step 2: Manual check against local maglev**

1. Start maglev on the `gtfs-flex` branch with a flex feed. Check first whether one is already listening on `:4124` (Charlevoix) or `:4125` (Manistee): `lsof -i :4124 -i :4125`. Otherwise, from `/Users/aaron/repos/onebusaway/maglev`, create a config that points `gtfs-static-feed` at `testdata/charlevoix-flex.zip` on a free port, and run `make run`.
2. Run Wayfinder against it: `PUBLIC_OBA_SERVER_URL=http://localhost:<port> PRIVATE_OBA_API_KEY=test PUBLIC_OBA_MAP_PROVIDER=osm PUBLIC_OBA_REGION_CENTER_LAT=<feed lat> PUBLIC_OBA_REGION_CENTER_LNG=<feed lon> npm run dev`. Take the centre from `/api/where/agencies-with-coverage.json`.
3. With Playwright MCP (or `/run`), confirm each of these and screenshot each:
   - region-level filled zones;
   - street-level stroke with a halo;
   - clicking a zone opens `/map/ondemand/<id>` with the zone highlighted;
   - reloading that URL restores the sheet;
   - a stop with `onDemandServiceIds` shows the card, and the Ironton Ferry stop (flex-only) shows the flex-only empty copy;
   - pointing Wayfinder at a non-flex OBA server shows no zones and no card, and has no console errors.
4. Save the screenshots under the session scratchpad for the PR description.

- [ ] **Step 3: Commit any fixes**

Each fix is its own scoped commit with a message saying what broke and why.
