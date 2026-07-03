# Umami Analytics Contract Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three gaps between Wayfinder's existing Umami analytics adapter and issue [#523](https://github.com/OneBusAway/wayfinder/issues/523)'s contract: detect Umami's silent bot-drop (`beep/boop`), send a non-bot-flagged fallback User-Agent, and sanitize/truncate event `data`.

**Architecture:** All changes are confined to one file — `src/lib/Analytics/adapters/UmamiAdapter.js` — and its test file. Three small exported helpers (`sanitizeData`, `isSuccessfulIngest`) plus one constant (`FALLBACK_USER_AGENT`), each wired into the existing `forwardEvent`. No new endpoints, no call-site changes, no new dependencies. The `/api/events` endpoint already catches thrown errors and maps `error.upstreamStatus` to the HTTP status.

**Tech Stack:** SvelteKit 5, Vitest (jsdom), native `fetch` + `AbortController`.

**Spec:** `docs/superpowers/specs/2026-06-22-umami-analytics-design.md`

## Global Constraints

- **No new dependencies.** Do not add `isbot` or anything else. The fallback-UA test is a self-contained token check.
- **Fire-and-forget is sacred.** No change may make analytics block, or surface to a user. The adapter throws; the `/api/events` endpoint catches; the client facade swallows. Never `await` analytics in a UI path (already true — don't change it).
- **Test runner:** `npx vitest run <path>` — NOT `npm run test` (hangs in non-TTY in this repo).
- **Config source is env vars** (`PUBLIC_ANALYTICS_*`). Region-feed discovery is out of scope.
- Constants (copy verbatim): `FALLBACK_USER_AGENT = 'Mozilla/5.0 (Wayfinder)'`, `MAX_DATA_VALUE_LENGTH = 256`, beep/boop `upstreamStatus = 502`, drop message = `'Umami dropped event as bot-like (isbot rejected the User-Agent)'`.

---

## File Structure

- **Modify** `src/lib/Analytics/adapters/UmamiAdapter.js`
  - Add module-level `FALLBACK_USER_AGENT`, `MAX_DATA_VALUE_LENGTH`.
  - Add exported `sanitizeData(props)` — pure props sanitizer.
  - Add exported `isSuccessfulIngest(body)` — pure response classifier.
  - Wire all three into the existing `forwardEvent`.
- **Modify** `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
  - Add unit tests for `sanitizeData` and `isSuccessfulIngest`.
  - Add a `forwardEvent` beep/boop failure test and a fallback-UA regression guard.
  - Update three existing tests whose mocked response bodies are no longer "success" under the new contract (the `'ok'` test at ~line 171 and the two `'{}'` mocks at ~lines 207 and 236).

Tasks are ordered so **all tests are green after every task** (Tasks 1 and 2 don't change the response-success contract; Task 3 does, and updates the affected tests in the same task).

---

## Task 1: `sanitizeData` — sanitize/truncate event props

**Files:**

- Modify: `src/lib/Analytics/adapters/UmamiAdapter.js`
- Test: `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`

**Interfaces:**

- Produces: `export function sanitizeData(props: object): object` — drops `null`/`undefined`; keeps `boolean`; keeps `string` truncated to 256 chars; keeps `number` only when `Number.isFinite`; `JSON.stringify`s everything else then truncates to 256.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing tests**

Add this block to `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js` (import line at top becomes `import { UmamiAdapter, sanitizeData } from '$lib/Analytics/adapters/UmamiAdapter.js';`):

```js
describe('sanitizeData', () => {
	it('keeps strings, finite numbers, and booleans', () => {
		expect(sanitizeData({ s: 'hi', n: 42, b: true })).toEqual({ s: 'hi', n: 42, b: true });
	});

	it('drops null and undefined values', () => {
		expect(sanitizeData({ a: null, b: undefined, c: 'keep' })).toEqual({ c: 'keep' });
	});

	it('drops non-finite numbers', () => {
		expect(sanitizeData({ a: NaN, b: Infinity, c: -Infinity, d: 1 })).toEqual({ d: 1 });
	});

	it('truncates strings to 256 characters', () => {
		const long = 'x'.repeat(300);
		expect(sanitizeData({ q: long }).q).toHaveLength(256);
	});

	it('JSON-stringifies nested objects and arrays', () => {
		expect(sanitizeData({ o: { a: 1 }, arr: [1, 2] })).toEqual({
			o: '{"a":1}',
			arr: '[1,2]'
		});
	});

	it('returns an empty object for empty or nullish input', () => {
		expect(sanitizeData({})).toEqual({});
		expect(sanitizeData(undefined)).toEqual({});
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/Analytics/adapters/UmamiAdapter.test.js -t sanitizeData`
Expected: FAIL — `sanitizeData is not a function` (not exported yet).

- [ ] **Step 3: Implement `sanitizeData`**

In `src/lib/Analytics/adapters/UmamiAdapter.js`, add below the existing `const UPSTREAM_TIMEOUT_MS = 5000;` line:

```js
const MAX_DATA_VALUE_LENGTH = 256;

/**
 * Coerce arbitrary event props into Umami-safe `data` values: keep strings (truncated),
 * finite numbers, and booleans; drop null/undefined and non-finite numbers; JSON-stringify
 * anything else (truncated). Bounds uncontrolled user input (e.g. the free-text search query).
 * @param {Object} [props]
 * @returns {Object}
 */
export function sanitizeData(props) {
	const out = {};
	for (const [key, value] of Object.entries(props ?? {})) {
		if (value === null || value === undefined) continue;
		const type = typeof value;
		if (type === 'boolean') {
			out[key] = value;
		} else if (type === 'string') {
			out[key] = value.slice(0, MAX_DATA_VALUE_LENGTH);
		} else if (type === 'number') {
			if (Number.isFinite(value)) out[key] = value;
		} else {
			out[key] = JSON.stringify(value).slice(0, MAX_DATA_VALUE_LENGTH);
		}
	}
	return out;
}
```

- [ ] **Step 4: Wire it into `forwardEvent`**

In the same file, in `forwardEvent`, change the payload's `data` line from:

```js
data: props;
```

to:

```js
data: sanitizeData(props);
```

- [ ] **Step 5: Run the full adapter test file to verify all pass**

Run: `npx vitest run src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: PASS (new `sanitizeData` tests + all existing tests — the existing `data: { id: '1_00' }` and `data: {}` assertions are unaffected because those values pass through unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/lib/Analytics/adapters/UmamiAdapter.js src/tests/lib/Analytics/adapters/UmamiAdapter.test.js
git commit -m "feat(analytics): sanitize and truncate Umami event data (#523)"
```

---

## Task 2: Browser-shaped fallback User-Agent

**Files:**

- Modify: `src/lib/Analytics/adapters/UmamiAdapter.js`
- Test: `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`

**Interfaces:**

- Produces: `export const FALLBACK_USER_AGENT = 'Mozilla/5.0 (Wayfinder)'` — used as the `User-Agent` header when `requestContext.userAgent` is empty. Must contain no isbot token and must not be a bare `Mozilla/x.x <token>` string.
- Consumes: nothing from other tasks.

> Why this exact string: `isbot` matches case-insensitively and unanchored, and its `patterns.json` includes the literal token `server` — so `Mozilla/5.0 (Wayfinder) Server/1.0` would be bot-dropped. `Mozilla/5.0 (Wayfinder)` has no bot token, and the `(` breaks isbot's `^mozilla/\d\.\d\s[\w.-]+$` bare-Mozilla anchor.

- [ ] **Step 1: Write the failing tests**

Update the import at the top of the test file to include the constant:
`import { UmamiAdapter, sanitizeData, FALLBACK_USER_AGENT } from '$lib/Analytics/adapters/UmamiAdapter.js';`

Find the existing test (currently ~line 206):

```js
it('falls back to Wayfinder/1.0 User-Agent when context omits it', async () => {
	global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' });
	await new UmamiAdapter(fullEnv).forwardEvent(envelope, { userAgent: '', clientIp: '' });
	const [, init] = global.fetch.mock.calls[0];
	expect(init.headers['User-Agent']).toBe('Wayfinder/1.0');
});
```

Replace it with (note: the mock body stays `'{}'` for now — Task 3 changes the success contract and updates this mock):

```js
it('falls back to the browser-shaped User-Agent when context omits it', async () => {
	global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' });
	await new UmamiAdapter(fullEnv).forwardEvent(envelope, { userAgent: '', clientIp: '' });
	const [, init] = global.fetch.mock.calls[0];
	expect(init.headers['User-Agent']).toBe('Mozilla/5.0 (Wayfinder)');
});
```

Then add a new regression-guard test in the same `describe('UmamiAdapter.forwardEvent (edge cases)')` block:

```js
it('fallback User-Agent contains no isbot bot tokens', () => {
	const tokens = ['server', 'bot', 'http', 'crawl', 'scan', 'search', 'spider', 'agent'];
	const ua = FALLBACK_USER_AGENT.toLowerCase();
	for (const token of tokens) {
		expect(ua).not.toContain(token);
	}
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/Analytics/adapters/UmamiAdapter.test.js -t "User-Agent"`
Expected: FAIL — `FALLBACK_USER_AGENT is undefined` and the fallback test asserts the new string against the old `'Wayfinder/1.0'`.

- [ ] **Step 3: Implement the constant and use it**

In `src/lib/Analytics/adapters/UmamiAdapter.js`, add below `const MAX_DATA_VALUE_LENGTH = 256;`:

```js
// Sent when no end-user User-Agent is available. Must survive Umami's isbot filter:
// no bot token (isbot matches `server`/`bot`/etc. unanchored, case-insensitively) and
// not a bare `Mozilla/x.x <token>` string (the `(` breaks isbot's anchored pattern).
export const FALLBACK_USER_AGENT = 'Mozilla/5.0 (Wayfinder)';
```

Then in `forwardEvent`, change the header line from:

```js
		'User-Agent': requestContext.userAgent || 'Wayfinder/1.0'
```

to:

```js
		'User-Agent': requestContext.userAgent || FALLBACK_USER_AGENT
```

- [ ] **Step 4: Run the full adapter test file to verify all pass**

Run: `npx vitest run src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: PASS (the `'{}'` mock still resolves via the existing `JSON.parse` path — the success contract is unchanged until Task 3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/UmamiAdapter.js src/tests/lib/Analytics/adapters/UmamiAdapter.test.js
git commit -m "fix(analytics): use non-bot fallback User-Agent for Umami (#523)"
```

---

## Task 3: `beep/boop` ingest-failure detection

**Files:**

- Modify: `src/lib/Analytics/adapters/UmamiAdapter.js`
- Test: `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`

**Interfaces:**

- Produces: `export function isSuccessfulIngest(body: string): boolean` — `true` for an empty string or a body containing `cache`/`sessionId`/`visitId`; `false` for a body containing `beep` or any other non-empty body.
- Consumes: `FALLBACK_USER_AGENT` already in the module (Task 2); the `/api/events` endpoint's existing `error.upstreamStatus` mapping (no change needed there).

> This task **changes the response-success contract**, so three existing tests that mocked non-success bodies (`'ok'`, `'{}'`, `'{}'`) must be updated in the same task to keep the suite green.

- [ ] **Step 1: Write the failing tests**

Update the import to include the new export:
`import { UmamiAdapter, sanitizeData, FALLBACK_USER_AGENT, isSuccessfulIngest } from '$lib/Analytics/adapters/UmamiAdapter.js';`

Add a new top-level describe block:

```js
describe('isSuccessfulIngest', () => {
	it('treats a beep/boop body as failure', () => {
		expect(isSuccessfulIngest('{"beep":"boop"}')).toBe(false);
	});

	it('treats a body with cache/sessionId/visitId as success', () => {
		expect(isSuccessfulIngest('{"cache":"c","sessionId":"s","visitId":"v"}')).toBe(true);
		expect(isSuccessfulIngest('{"sessionId":"s"}')).toBe(true);
	});

	it('treats an empty body as success', () => {
		expect(isSuccessfulIngest('')).toBe(true);
	});

	it('treats a bare {} body as failure', () => {
		expect(isSuccessfulIngest('{}')).toBe(false);
	});

	it('treats any other non-empty body without a marker as failure', () => {
		expect(isSuccessfulIngest('ok')).toBe(false);
	});

	it('does not throw on a non-JSON body', () => {
		expect(() => isSuccessfulIngest('<html>error</html>')).not.toThrow();
		expect(isSuccessfulIngest('<html>error</html>')).toBe(false);
	});
});
```

Add a `forwardEvent` failure test to the `describe('UmamiAdapter.forwardEvent (edge cases)')` block:

```js
it('throws with upstreamStatus 502 when Umami drops the event (beep/boop)', async () => {
	global.fetch = vi
		.fn()
		.mockResolvedValue({ ok: true, status: 200, text: async () => '{"beep":"boop"}' });
	try {
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		expect.unreachable('should have thrown');
	} catch (error) {
		expect(error.message).toContain('dropped event');
		expect(error.upstreamStatus).toBe(502);
	}
});
```

Now update the THREE existing tests whose mocked bodies are no longer "success":

1. The non-JSON test (currently ~line 171) — a non-marker body is now a failure. Replace:

```js
it('returns { status: text } when response is not JSON', async () => {
	global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'ok' });
	const result = await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
	expect(result).toEqual({ status: 'ok' });
});
```

with:

```js
it('throws when the response body lacks a success marker', async () => {
	global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
	await expect(new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx)).rejects.toThrow(
		'dropped event'
	);
});
```

2. The fallback-UA test (updated in Task 2, ~line 206) — change its mock body from `'{}'` to a success marker so the UA assertion is reached without throwing:

```js
global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"cache":"x"}' });
```

3. The AbortSignal test (~line 236) — same mock-body change:

```js
global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"cache":"x"}' });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/lib/Analytics/adapters/UmamiAdapter.test.js -t "isSuccessfulIngest"`
Expected: FAIL — `isSuccessfulIngest is not a function`.

- [ ] **Step 3: Implement `isSuccessfulIngest`**

In `src/lib/Analytics/adapters/UmamiAdapter.js`, add below the `sanitizeData` function:

```js
/**
 * Classify a Umami /api/send response body. Umami silently drops bot-like requests with
 * HTTP 200 + {"beep":"boop"}; a real ingest returns cache/sessionId/visitId. Tolerant of
 * non-JSON bodies (substring checks, never throws).
 * @param {string} body
 * @returns {boolean}
 */
export function isSuccessfulIngest(body) {
	if (body === '') return true;
	if (body.includes('beep')) return false;
	return body.includes('cache') || body.includes('sessionId') || body.includes('visitId');
}
```

- [ ] **Step 4: Wire it into `forwardEvent`**

In `forwardEvent`, replace the success tail:

```js
const text = await res.text();
try {
	return JSON.parse(text);
} catch {
	return { status: text };
}
```

with:

```js
const text = await res.text();
if (!isSuccessfulIngest(text)) {
	const err = new Error('Umami dropped event as bot-like (isbot rejected the User-Agent)');
	err.upstreamStatus = 502;
	throw err;
}
try {
	return JSON.parse(text);
} catch {
	return { status: text };
}
```

- [ ] **Step 5: Run the full adapter test file to verify all pass**

Run: `npx vitest run src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: PASS — new `isSuccessfulIngest` tests, the beep/boop `forwardEvent` test, and all three updated existing tests.

- [ ] **Step 6: Run the whole analytics + events suite for regressions**

Run: `npx vitest run src/tests/lib/Analytics src/tests/api/events.test.js`
Expected: PASS. (`events.test.js` exercises the adapter through the route; its Umami success mocks already carry markers — `{cache,sessionId,visitId}` and `{cache:'c'}` — and its incomplete-config test short-circuits before fetch, so the new 502 path does not affect it. Verified during planning; this step just guards against regressions.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/Analytics/adapters/UmamiAdapter.js src/tests/lib/Analytics/adapters/UmamiAdapter.test.js
git commit -m "fix(analytics): detect Umami beep/boop bot-drop as failure (#523)"
```

---

## Task 4: Full verification & lint

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, no regressions across the repo.

- [ ] **Step 2: Lint/format**

Run: `npm run lint`
Expected: clean. If it reports formatting, run `npm run format` and re-run `npm run lint`.

- [ ] **Step 3: Commit any formatting fixes (only if `npm run format` changed files)**

```bash
git add -A
git commit -m "style: format Umami analytics changes (#523)"
```

- [ ] **Step 4: Manual verification (not automatable — record results in the PR)**

1. In `.env`, set `PUBLIC_ANALYTICS_PROVIDER=umami`, plus `PUBLIC_ANALYTICS_API_HOST`, `PUBLIC_ANALYTICS_WEBSITE_ID`, `PUBLIC_ANALYTICS_DOMAIN` pointed at the live Umami host + website UUID.
2. `npm run dev`; exercise pageview / search / stop-view / route-click / arrival-click.
3. Confirm events appear under the correct website UUID in the Umami dashboard, and that the ingest response is `cache/sessionId/visitId` — not `beep/boop`.
4. Confirm `PUBLIC_ANALYTICS_PROVIDER=none` emits nothing.

---

## Self-Review notes

- **Spec coverage:** Fix #1 (beep/boop) → Task 3. Fix #2 (fallback UA) → Task 2. Fix #3 (sanitizeData) → Task 1. The spec's "two `{}` mocks must update" plus the additionally-discovered `'ok'` test → all three updated in Task 3. Manual acceptance → Task 4.
- **Out of scope (no tasks, intentional):** region-feed discovery, new event types, Plausible removal, JS tracker.
- **Type consistency:** `sanitizeData(props) → object`, `isSuccessfulIngest(body: string) → boolean`, `FALLBACK_USER_AGENT: string` are used identically wherever referenced. `upstreamStatus = 502` is the single drop status; `MAX_DATA_VALUE_LENGTH = 256` is the single truncation bound.
