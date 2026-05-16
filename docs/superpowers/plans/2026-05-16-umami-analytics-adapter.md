# Umami Analytics Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-provider Plausible integration with a pluggable adapter system that supports Plausible, Umami, or no provider, selected via `PUBLIC_ANALYTICS_PROVIDER`.

**Architecture:** Facade (`Analytics`) → factory (`createAdapter`) → adapter (`PlausibleAdapter` | `UmamiAdapter` | `NoopAdapter`). The facade is what components import; it builds a provider-agnostic envelope, POSTs to `/api/events`, and the server route uses the factory to pick the adapter that forwards to the correct upstream.

**Tech Stack:** SvelteKit 5 with runes, Vitest + jsdom for tests, `$env/dynamic/public` for runtime env access.

**Spec:** `docs/superpowers/specs/2026-05-16-umami-analytics-adapter-design.md`

**Architecture review:** Incorporates Critical fixes C1–C3 and Important fixes I1–I9 from software-architect review. Open design boundaries documented in spec.

---

## File map

**New source files** (all under `src/lib/Analytics/`):

- `adapters/NoopAdapter.js` — disabled stub
- `adapters/PlausibleAdapter.js` — Plausible payload + forward
- `adapters/UmamiAdapter.js` — Umami payload + forward (with `X-Forwarded-For` + `User-Agent`)
- `createAdapter.js` — factory: env → adapter
- `Analytics.js` — facade class (`reportPageView` etc.) with `sendBeacon` fallback on unload
- `index.js` — default-exports the singleton
- `types.js` — JSDoc typedefs for `AnalyticsEnvelope` and `RequestContext`

**New test files** (all under `src/tests/lib/Analytics/`):

- `adapters/NoopAdapter.test.js`
- `adapters/PlausibleAdapter.test.js`
- `adapters/UmamiAdapter.test.js`
- `createAdapter.test.js`
- `Analytics.test.js`

**Renamed:**

- `src/lib/Analytics/plausibleUtils.js` → `src/lib/Analytics/analyticsUtils.js`

**Modified:**

- `src/routes/api/events/+server.js` — use factory + pass `{ userAgent, clientIp }`, 400 on JSON parse error
- `src/tests/api/events.test.js` — cover both adapters + provider switching + parse error
- `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/stops/[stopID]/+page.svelte` — change import to `$lib/Analytics`
- `src/components/search/SearchField.svelte`, `src/components/stops/StopPane.svelte` — same import change
- `src/components/search/__tests__/SearchField.test.js` — mock `$lib/Analytics` instead of legacy path
- `src/components/search/__tests__/SearchPane.test.js` — same
- `src/components/stops/__tests__/StopPane.test.js` — same
- `env-schema.json` — drop `PUBLIC_ANALYTICS_ENABLED`, add `PUBLIC_ANALYTICS_PROVIDER` + `PUBLIC_ANALYTICS_WEBSITE_ID`
- `.env.example` — same change
- `vitest-setup.js` — default mock `PUBLIC_ANALYTICS_PROVIDER='none'`

**Deleted (after migration):**

- `src/lib/Analytics/PlausibleAnalytics.js`
- `src/tests/lib/PlausibleAnalytics.test.js`

---

## Test data conventions

Every adapter accepts an `env` object in its constructor. Tests pass plain objects rather than mocking `$env/dynamic/public`. Shared envelope and ctx fixtures:

```js
const envelope = {
	name: 'pageview',
	url: '/test',
	referrer: 'https://referrer.example.com',
	title: 'Test Page',
	language: 'en-US',
	screen: '1920x1080',
	props: { id: '1_00' }
};

const ctx = { userAgent: 'TestAgent/1.0', clientIp: '203.0.113.42' };
```

---

## Task order rationale

Env/test-setup (Task 7) is moved before the facade (Task 8) so we never run in an intermediate state where some test files mock new env names while `vitest-setup.js` still has old ones. Component-test mocks (Task 11) are updated _after_ `$lib/Analytics` exists (Task 8) and _before_ component imports switch (Task 12).

---

## Task 1: NoopAdapter

**Files:**

- Create: `src/lib/Analytics/adapters/NoopAdapter.js`
- Test: `src/tests/lib/Analytics/adapters/NoopAdapter.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/lib/Analytics/adapters/NoopAdapter.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { NoopAdapter } from '$lib/Analytics/adapters/NoopAdapter.js';

describe('NoopAdapter', () => {
	it('reports as disabled', () => {
		const adapter = new NoopAdapter();
		expect(adapter.isEnabled()).toBe(false);
	});

	it('forwardEvent returns analytics disabled status', async () => {
		const adapter = new NoopAdapter();
		const result = await adapter.forwardEvent(
			{ name: 'pageview', url: '/' },
			{ userAgent: 'X', clientIp: '' }
		);
		expect(result).toEqual({ status: 'analytics disabled' });
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/adapters/NoopAdapter.test.js`
Expected: FAIL — `Cannot find module '$lib/Analytics/adapters/NoopAdapter.js'`

- [ ] **Step 3: Create the NoopAdapter**

Create `src/lib/Analytics/adapters/NoopAdapter.js`:

```js
export class NoopAdapter {
	isEnabled() {
		return false;
	}

	async forwardEvent() {
		return { status: 'analytics disabled' };
	}
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test -- src/tests/lib/Analytics/adapters/NoopAdapter.test.js`
Expected: PASS — 2/2 green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/NoopAdapter.js \
        src/tests/lib/Analytics/adapters/NoopAdapter.test.js
git commit -m "Add NoopAdapter for disabled analytics"
```

---

## Task 2: UmamiAdapter — isEnabled and config-warning at construction

**Files:**

- Create: `src/lib/Analytics/adapters/UmamiAdapter.js`
- Test: `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`

This task implements `isEnabled()` _and_ the I2 fix: an adapter logs a single console.warn at construction when the selected provider's config is incomplete. The facade keeps a simple `provider !== 'none'` check; the adapter is responsible for warning operators about misconfiguration.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UmamiAdapter } from '$lib/Analytics/adapters/UmamiAdapter.js';

const fullEnv = {
	PUBLIC_ANALYTICS_DOMAIN: 'example.com',
	PUBLIC_ANALYTICS_API_HOST: 'https://umami.example.com',
	PUBLIC_ANALYTICS_WEBSITE_ID: '79eab5f4-0c4d-492b-9b60-ecf018859f03'
};

const envelope = {
	name: 'pageview',
	url: '/test',
	referrer: 'https://referrer.example.com',
	title: 'Test Page',
	language: 'en-US',
	screen: '1920x1080',
	props: { id: '1_00' }
};

const ctx = { userAgent: 'TestAgent/1.0', clientIp: '203.0.113.42' };

describe('UmamiAdapter.isEnabled', () => {
	it('returns true when domain, api host, and website id are all set', () => {
		expect(new UmamiAdapter(fullEnv).isEnabled()).toBe(true);
	});

	it('returns false when website id is missing', () => {
		expect(new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_WEBSITE_ID: '' }).isEnabled()).toBe(
			false
		);
	});

	it('returns false when api host is missing', () => {
		expect(new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_API_HOST: '' }).isEnabled()).toBe(false);
	});

	it('returns false when domain is missing', () => {
		expect(new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' }).isEnabled()).toBe(false);
	});
});

describe('UmamiAdapter construction-time config warning', () => {
	let warnSpy;
	beforeEach(() => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		warnSpy.mockRestore();
	});

	it('does not warn when fully configured', () => {
		new UmamiAdapter(fullEnv);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('warns once when website id is missing', () => {
		new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_WEBSITE_ID: '' });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('UmamiAdapter: missing PUBLIC_ANALYTICS_WEBSITE_ID')
		);
	});

	it('warns when api host is missing', () => {
		new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_API_HOST: '' });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('UmamiAdapter: missing PUBLIC_ANALYTICS_API_HOST')
		);
	});

	it('warns when domain is missing', () => {
		new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('UmamiAdapter: missing PUBLIC_ANALYTICS_DOMAIN')
		);
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create UmamiAdapter with isEnabled + warn-on-construct**

Create `src/lib/Analytics/adapters/UmamiAdapter.js`:

```js
export class UmamiAdapter {
	constructor(env) {
		this.env = env;
		this.warnIfMisconfigured();
	}

	warnIfMisconfigured() {
		const missing = [];
		if (!this.env.PUBLIC_ANALYTICS_DOMAIN) missing.push('PUBLIC_ANALYTICS_DOMAIN');
		if (!this.env.PUBLIC_ANALYTICS_API_HOST) missing.push('PUBLIC_ANALYTICS_API_HOST');
		if (!this.env.PUBLIC_ANALYTICS_WEBSITE_ID) missing.push('PUBLIC_ANALYTICS_WEBSITE_ID');
		for (const key of missing) {
			console.warn(`UmamiAdapter: missing ${key} — events will not be sent`);
		}
	}

	isEnabled() {
		return (
			!!this.env.PUBLIC_ANALYTICS_DOMAIN &&
			!!this.env.PUBLIC_ANALYTICS_API_HOST &&
			!!this.env.PUBLIC_ANALYTICS_WEBSITE_ID
		);
	}

	async forwardEvent() {
		throw new Error('not implemented');
	}
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test -- src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: PASS — 8/8 (4 isEnabled + 4 warning) green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/UmamiAdapter.js \
        src/tests/lib/Analytics/adapters/UmamiAdapter.test.js
git commit -m "Add UmamiAdapter isEnabled gate with construction-time config warning"
```

---

## Task 3: UmamiAdapter — forwardEvent happy path (with X-Forwarded-For)

**Files:**

- Modify: `src/lib/Analytics/adapters/UmamiAdapter.js`
- Modify: `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`

Implements forwardEvent including the I5 fix: forward `X-Forwarded-For` to Umami so visitor uniqueness works behind our server-side proxy. I7 fix: adapter destructures envelope with defaults so missing fields produce empty strings rather than `undefined`.

- [ ] **Step 1: Add the failing tests**

Append to `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js` (imports and fixtures from Task 2 stay at the top; just append a new describe block):

```js
describe('UmamiAdapter.forwardEvent (happy path)', () => {
	beforeEach(() => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ cache: 'abc', sessionId: 's', visitId: 'v' })
		});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('POSTs to {apiHost}/api/send', async () => {
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		expect(global.fetch).toHaveBeenCalledWith(
			'https://umami.example.com/api/send',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('sends Umami payload shape with type=event', async () => {
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body).toEqual({
			type: 'event',
			payload: {
				website: '79eab5f4-0c4d-492b-9b60-ecf018859f03',
				hostname: 'example.com',
				language: 'en-US',
				screen: '1920x1080',
				url: '/test',
				referrer: 'https://referrer.example.com',
				title: 'Test Page',
				name: 'pageview',
				data: { id: '1_00' }
			}
		});
	});

	it('forwards User-Agent header from requestContext', async () => {
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		expect(init.headers['User-Agent']).toBe('TestAgent/1.0');
	});

	it('forwards X-Forwarded-For when clientIp is present', async () => {
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		expect(init.headers['X-Forwarded-For']).toBe('203.0.113.42');
	});

	it('omits X-Forwarded-For when clientIp is empty', async () => {
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, {
			userAgent: 'UA',
			clientIp: ''
		});
		const [, init] = global.fetch.mock.calls[0];
		expect(init.headers['X-Forwarded-For']).toBeUndefined();
	});

	it('sets Content-Type: application/json', async () => {
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		expect(init.headers['Content-Type']).toBe('application/json');
	});

	it('uses PUBLIC_ANALYTICS_DOMAIN as hostname (not Host header)', async () => {
		const env = { ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: 'configured.example.com' };
		await new UmamiAdapter(env).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.payload.hostname).toBe('configured.example.com');
	});

	it('defaults missing optional envelope fields to empty strings', async () => {
		const sparse = { name: 'click', url: '/x' };
		await new UmamiAdapter(fullEnv).forwardEvent(sparse, ctx);
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.payload.referrer).toBe('');
		expect(body.payload.title).toBe('');
		expect(body.payload.language).toBe('');
		expect(body.payload.screen).toBe('');
		expect(body.payload.data).toEqual({});
	});

	it('returns parsed JSON response', async () => {
		const result = await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		expect(result).toEqual({ cache: 'abc', sessionId: 's', visitId: 'v' });
	});

	it('returns { status: text } when response is not JSON', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'ok' });
		const result = await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		expect(result).toEqual({ status: 'ok' });
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: FAIL — happy-path tests fail because `forwardEvent` throws "not implemented".

- [ ] **Step 3: Implement forwardEvent happy path**

Replace `src/lib/Analytics/adapters/UmamiAdapter.js` with:

```js
export class UmamiAdapter {
	constructor(env) {
		this.env = env;
		this.warnIfMisconfigured();
	}

	warnIfMisconfigured() {
		const missing = [];
		if (!this.env.PUBLIC_ANALYTICS_DOMAIN) missing.push('PUBLIC_ANALYTICS_DOMAIN');
		if (!this.env.PUBLIC_ANALYTICS_API_HOST) missing.push('PUBLIC_ANALYTICS_API_HOST');
		if (!this.env.PUBLIC_ANALYTICS_WEBSITE_ID) missing.push('PUBLIC_ANALYTICS_WEBSITE_ID');
		for (const key of missing) {
			console.warn(`UmamiAdapter: missing ${key} — events will not be sent`);
		}
	}

	isEnabled() {
		return (
			!!this.env.PUBLIC_ANALYTICS_DOMAIN &&
			!!this.env.PUBLIC_ANALYTICS_API_HOST &&
			!!this.env.PUBLIC_ANALYTICS_WEBSITE_ID
		);
	}

	getEventUrl() {
		return `${this.env.PUBLIC_ANALYTICS_API_HOST}/api/send`;
	}

	async forwardEvent(envelope, requestContext) {
		const {
			name,
			url,
			referrer = '',
			title = '',
			language = '',
			screen = '',
			props = {}
		} = envelope;

		const body = {
			type: 'event',
			payload: {
				website: this.env.PUBLIC_ANALYTICS_WEBSITE_ID,
				hostname: this.env.PUBLIC_ANALYTICS_DOMAIN,
				language,
				screen,
				url,
				referrer,
				title,
				name,
				data: props
			}
		};

		const headers = {
			'Content-Type': 'application/json',
			'User-Agent': requestContext.userAgent
		};
		if (requestContext.clientIp) {
			headers['X-Forwarded-For'] = requestContext.clientIp;
		}

		const res = await fetch(this.getEventUrl(), {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		const text = await res.text();
		try {
			return JSON.parse(text);
		} catch {
			return { status: text };
		}
	}
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test -- src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: PASS — Task 2 tests still green, Task 3 tests green (18 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/UmamiAdapter.js \
        src/tests/lib/Analytics/adapters/UmamiAdapter.test.js
git commit -m "Implement UmamiAdapter forwardEvent with X-Forwarded-For"
```

---

## Task 4: UmamiAdapter — disabled, validation, UA fallback, errors

**Files:**

- Modify: `src/lib/Analytics/adapters/UmamiAdapter.js`
- Modify: `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`:

```js
describe('UmamiAdapter.forwardEvent (edge cases)', () => {
	beforeEach(() => {
		global.fetch = vi.fn();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns disabled status without calling fetch when not enabled', async () => {
		const env = { ...fullEnv, PUBLIC_ANALYTICS_WEBSITE_ID: '' };
		const result = await new UmamiAdapter(env).forwardEvent(envelope, ctx);
		expect(result).toEqual({ status: 'analytics disabled' });
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('throws when envelope.name is missing', async () => {
		await expect(new UmamiAdapter(fullEnv).forwardEvent({ url: '/x' }, ctx)).rejects.toThrow(
			'forwardEvent requires name and url'
		);
	});

	it('throws when envelope.url is missing', async () => {
		await expect(new UmamiAdapter(fullEnv).forwardEvent({ name: 'pageview' }, ctx)).rejects.toThrow(
			'forwardEvent requires name and url'
		);
	});

	it('falls back to Wayfinder/1.0 User-Agent when context omits it', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' });
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, { userAgent: '', clientIp: '' });
		const [, init] = global.fetch.mock.calls[0];
		expect(init.headers['User-Agent']).toBe('Wayfinder/1.0');
	});

	it('throws Error with upstreamStatus on non-OK response', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 502,
			statusText: 'Bad Gateway'
		});
		try {
			await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
			expect.unreachable('should have thrown');
		} catch (error) {
			expect(error.message).toBe('Error sending event: Bad Gateway');
			expect(error.upstreamStatus).toBe(502);
		}
	});

	it('propagates network errors from fetch', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
		await expect(new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx)).rejects.toThrow(
			'Network failure'
		);
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: FAIL — disabled / validation / UA fallback / error tests fail.

- [ ] **Step 3: Implement the edge cases**

Replace `src/lib/Analytics/adapters/UmamiAdapter.js` with:

```js
export class UmamiAdapter {
	constructor(env) {
		this.env = env;
		this.warnIfMisconfigured();
	}

	warnIfMisconfigured() {
		const missing = [];
		if (!this.env.PUBLIC_ANALYTICS_DOMAIN) missing.push('PUBLIC_ANALYTICS_DOMAIN');
		if (!this.env.PUBLIC_ANALYTICS_API_HOST) missing.push('PUBLIC_ANALYTICS_API_HOST');
		if (!this.env.PUBLIC_ANALYTICS_WEBSITE_ID) missing.push('PUBLIC_ANALYTICS_WEBSITE_ID');
		for (const key of missing) {
			console.warn(`UmamiAdapter: missing ${key} — events will not be sent`);
		}
	}

	isEnabled() {
		return (
			!!this.env.PUBLIC_ANALYTICS_DOMAIN &&
			!!this.env.PUBLIC_ANALYTICS_API_HOST &&
			!!this.env.PUBLIC_ANALYTICS_WEBSITE_ID
		);
	}

	getEventUrl() {
		return `${this.env.PUBLIC_ANALYTICS_API_HOST}/api/send`;
	}

	async forwardEvent(envelope, requestContext) {
		if (!this.isEnabled()) {
			return { status: 'analytics disabled' };
		}

		const {
			name,
			url,
			referrer = '',
			title = '',
			language = '',
			screen = '',
			props = {}
		} = envelope;

		if (!name || !url) {
			throw new Error('forwardEvent requires name and url');
		}

		const body = {
			type: 'event',
			payload: {
				website: this.env.PUBLIC_ANALYTICS_WEBSITE_ID,
				hostname: this.env.PUBLIC_ANALYTICS_DOMAIN,
				language,
				screen,
				url,
				referrer,
				title,
				name,
				data: props
			}
		};

		const headers = {
			'Content-Type': 'application/json',
			'User-Agent': requestContext.userAgent || 'Wayfinder/1.0'
		};
		if (requestContext.clientIp) {
			headers['X-Forwarded-For'] = requestContext.clientIp;
		}

		const res = await fetch(this.getEventUrl(), {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const err = new Error(`Error sending event: ${res.statusText}`);
			err.upstreamStatus = res.status;
			throw err;
		}

		const text = await res.text();
		try {
			return JSON.parse(text);
		} catch {
			return { status: text };
		}
	}
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test -- src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: PASS — all UmamiAdapter tests green (24 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/UmamiAdapter.js \
        src/tests/lib/Analytics/adapters/UmamiAdapter.test.js
git commit -m "Round out UmamiAdapter: disabled/validation/UA fallback/errors"
```

---

## Task 5: PlausibleAdapter

**Files:**

- Create: `src/lib/Analytics/adapters/PlausibleAdapter.js`
- Test: `src/tests/lib/Analytics/adapters/PlausibleAdapter.test.js`

Mirrors current `PlausibleAnalytics.forwardEvent`. Adds the same construction-time config warning (I2) and envelope destructure-with-defaults (I7) as UmamiAdapter, and forwards `X-Forwarded-For` (I5 — Plausible also supports it).

- [ ] **Step 1: Write the full failing test file**

Create `src/tests/lib/Analytics/adapters/PlausibleAdapter.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlausibleAdapter } from '$lib/Analytics/adapters/PlausibleAdapter.js';

const fullEnv = {
	PUBLIC_ANALYTICS_DOMAIN: 'example.com',
	PUBLIC_ANALYTICS_API_HOST: 'https://plausible.example.com'
};

const envelope = {
	name: 'pageview',
	url: '/test',
	referrer: 'https://referrer.example.com',
	props: { id: '1_00' }
};

const ctx = { userAgent: 'TestAgent/1.0', clientIp: '203.0.113.42' };

describe('PlausibleAdapter.isEnabled', () => {
	let warnSpy;
	beforeEach(() => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		warnSpy.mockRestore();
	});

	it('returns true when domain and api host are set', () => {
		expect(new PlausibleAdapter(fullEnv).isEnabled()).toBe(true);
	});

	it('returns false when domain is missing', () => {
		expect(new PlausibleAdapter({ ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' }).isEnabled()).toBe(
			false
		);
	});

	it('returns false when api host is missing', () => {
		expect(new PlausibleAdapter({ ...fullEnv, PUBLIC_ANALYTICS_API_HOST: '' }).isEnabled()).toBe(
			false
		);
	});
});

describe('PlausibleAdapter construction-time config warning', () => {
	let warnSpy;
	beforeEach(() => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		warnSpy.mockRestore();
	});

	it('does not warn when fully configured', () => {
		new PlausibleAdapter(fullEnv);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('warns when domain is missing', () => {
		new PlausibleAdapter({ ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('PlausibleAdapter: missing PUBLIC_ANALYTICS_DOMAIN')
		);
	});

	it('warns when api host is missing', () => {
		new PlausibleAdapter({ ...fullEnv, PUBLIC_ANALYTICS_API_HOST: '' });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('PlausibleAdapter: missing PUBLIC_ANALYTICS_API_HOST')
		);
	});
});

describe('PlausibleAdapter.forwardEvent', () => {
	beforeEach(() => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ status: 'ok' })
		});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns disabled status without calling fetch when not enabled', async () => {
		const env = { ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' };
		const result = await new PlausibleAdapter(env).forwardEvent(envelope, ctx);
		expect(result).toEqual({ status: 'analytics disabled' });
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('throws when name is missing', async () => {
		await expect(new PlausibleAdapter(fullEnv).forwardEvent({ url: '/x' }, ctx)).rejects.toThrow(
			'forwardEvent requires name and url'
		);
	});

	it('throws when url is missing', async () => {
		await expect(
			new PlausibleAdapter(fullEnv).forwardEvent({ name: 'pageview' }, ctx)
		).rejects.toThrow('forwardEvent requires name and url');
	});

	it('POSTs to {apiHost}/api/event', async () => {
		await new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx);
		expect(global.fetch).toHaveBeenCalledWith(
			'https://plausible.example.com/api/event',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('sends Plausible payload { domain, name, url, referrer, props }', async () => {
		await new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body).toEqual({
			domain: 'example.com',
			name: 'pageview',
			url: '/test',
			referrer: 'https://referrer.example.com',
			props: { id: '1_00' }
		});
	});

	it('forwards X-Forwarded-For when clientIp present', async () => {
		await new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		expect(init.headers['X-Forwarded-For']).toBe('203.0.113.42');
	});

	it('forwards User-Agent header when present', async () => {
		await new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		expect(init.headers['User-Agent']).toBe('TestAgent/1.0');
	});

	it('defaults missing optional envelope fields to empty / empty-object', async () => {
		await new PlausibleAdapter(fullEnv).forwardEvent({ name: 'click', url: '/x' }, ctx);
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.referrer).toBe('');
		expect(body.props).toEqual({});
	});

	it('returns parsed JSON response', async () => {
		const result = await new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx);
		expect(result).toEqual({ status: 'ok' });
	});

	it('returns { status: text } when response is not JSON', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'ok' });
		const result = await new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx);
		expect(result).toEqual({ status: 'ok' });
	});

	it('throws Error with upstreamStatus on non-OK response', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 502,
			statusText: 'Bad Gateway'
		});
		try {
			await new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx);
			expect.unreachable('should have thrown');
		} catch (error) {
			expect(error.message).toBe('Error sending event: Bad Gateway');
			expect(error.upstreamStatus).toBe(502);
		}
	});

	it('propagates network errors from fetch', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
		await expect(new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx)).rejects.toThrow(
			'Network failure'
		);
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/adapters/PlausibleAdapter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement PlausibleAdapter**

Create `src/lib/Analytics/adapters/PlausibleAdapter.js`:

```js
export class PlausibleAdapter {
	constructor(env) {
		this.env = env;
		this.warnIfMisconfigured();
	}

	warnIfMisconfigured() {
		const missing = [];
		if (!this.env.PUBLIC_ANALYTICS_DOMAIN) missing.push('PUBLIC_ANALYTICS_DOMAIN');
		if (!this.env.PUBLIC_ANALYTICS_API_HOST) missing.push('PUBLIC_ANALYTICS_API_HOST');
		for (const key of missing) {
			console.warn(`PlausibleAdapter: missing ${key} — events will not be sent`);
		}
	}

	isEnabled() {
		return !!this.env.PUBLIC_ANALYTICS_DOMAIN && !!this.env.PUBLIC_ANALYTICS_API_HOST;
	}

	getEventUrl() {
		return `${this.env.PUBLIC_ANALYTICS_API_HOST}/api/event`;
	}

	async forwardEvent(envelope, requestContext) {
		if (!this.isEnabled()) {
			return { status: 'analytics disabled' };
		}

		const { name, url, referrer = '', props = {} } = envelope;

		if (!name || !url) {
			throw new Error('forwardEvent requires name and url');
		}

		const headers = { 'Content-Type': 'application/json' };
		if (requestContext.userAgent) headers['User-Agent'] = requestContext.userAgent;
		if (requestContext.clientIp) headers['X-Forwarded-For'] = requestContext.clientIp;

		const res = await fetch(this.getEventUrl(), {
			method: 'POST',
			headers,
			body: JSON.stringify({
				domain: this.env.PUBLIC_ANALYTICS_DOMAIN,
				name,
				url,
				referrer,
				props
			})
		});

		if (!res.ok) {
			const err = new Error(`Error sending event: ${res.statusText}`);
			err.upstreamStatus = res.status;
			throw err;
		}

		const text = await res.text();
		try {
			return JSON.parse(text);
		} catch {
			return { status: text };
		}
	}
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test -- src/tests/lib/Analytics/adapters/PlausibleAdapter.test.js`
Expected: PASS — all PlausibleAdapter tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/PlausibleAdapter.js \
        src/tests/lib/Analytics/adapters/PlausibleAdapter.test.js
git commit -m "Add PlausibleAdapter with X-Forwarded-For and config warning"
```

---

## Task 6: createAdapter factory

**Files:**

- Create: `src/lib/Analytics/createAdapter.js`
- Test: `src/tests/lib/Analytics/createAdapter.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/lib/Analytics/createAdapter.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAdapter } from '$lib/Analytics/createAdapter.js';
import { NoopAdapter } from '$lib/Analytics/adapters/NoopAdapter.js';
import { PlausibleAdapter } from '$lib/Analytics/adapters/PlausibleAdapter.js';
import { UmamiAdapter } from '$lib/Analytics/adapters/UmamiAdapter.js';

describe('createAdapter', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns NoopAdapter when PUBLIC_ANALYTICS_PROVIDER is "none"', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: 'none' })).toBeInstanceOf(NoopAdapter);
	});

	it('returns NoopAdapter when provider is unset', () => {
		expect(createAdapter({})).toBeInstanceOf(NoopAdapter);
	});

	it('returns NoopAdapter when provider is empty string', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: '' })).toBeInstanceOf(NoopAdapter);
	});

	it('returns NoopAdapter for unknown provider values', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: 'bogus' })).toBeInstanceOf(NoopAdapter);
	});

	it('returns PlausibleAdapter when provider is "plausible"', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: 'plausible' })).toBeInstanceOf(
			PlausibleAdapter
		);
	});

	it('returns UmamiAdapter when provider is "umami"', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: 'umami' })).toBeInstanceOf(UmamiAdapter);
	});

	it('passes env through to the adapter', () => {
		const env = {
			PUBLIC_ANALYTICS_PROVIDER: 'plausible',
			PUBLIC_ANALYTICS_DOMAIN: 'example.com',
			PUBLIC_ANALYTICS_API_HOST: 'https://p.example.com'
		};
		expect(createAdapter(env).isEnabled()).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/createAdapter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the factory**

Create `src/lib/Analytics/createAdapter.js`:

```js
import { NoopAdapter } from './adapters/NoopAdapter.js';
import { PlausibleAdapter } from './adapters/PlausibleAdapter.js';
import { UmamiAdapter } from './adapters/UmamiAdapter.js';

export function createAdapter(env) {
	switch (env.PUBLIC_ANALYTICS_PROVIDER) {
		case 'plausible':
			return new PlausibleAdapter(env);
		case 'umami':
			return new UmamiAdapter(env);
		default:
			return new NoopAdapter();
	}
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test -- src/tests/lib/Analytics/createAdapter.test.js`
Expected: PASS — 7/7 green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/createAdapter.js \
        src/tests/lib/Analytics/createAdapter.test.js
git commit -m "Add createAdapter factory dispatching by PUBLIC_ANALYTICS_PROVIDER"
```

---

## Task 7: Update env-schema, .env.example, vitest-setup

**Files:**

- Modify: `env-schema.json`
- Modify: `.env.example`
- Modify: `vitest-setup.js`

I8 fix: this task runs _before_ the Analytics facade so the new mock default (`PUBLIC_ANALYTICS_PROVIDER: 'none'`) is in place when the facade test arrives. C2 fix: enum gets `allowEmpty: true` so operators with `PUBLIC_ANALYTICS_PROVIDER=""` don't fail validation. I1 fix: the description for `PUBLIC_ANALYTICS_DOMAIN` is updated to document its per-provider meaning.

- [ ] **Step 1: Update `env-schema.json`**

In `env-schema.json`:

- Delete the `"PUBLIC_ANALYTICS_ENABLED": { ... }` block.
- Replace the existing `PUBLIC_ANALYTICS_DOMAIN` description with: `"Site identifier sent to the analytics backend. For Plausible: the site domain registered in your Plausible account. For Umami: the literal hostname sent as payload.hostname."`
- After the `PUBLIC_ANALYTICS_API_HOST` block, insert:

```json
"PUBLIC_ANALYTICS_PROVIDER": {
    "required": false,
    "type": "enum",
    "enum": ["none", "plausible", "umami"],
    "allowEmpty": true,
    "description": "Which analytics backend to use. 'none' (or empty) disables analytics entirely."
},
"PUBLIC_ANALYTICS_WEBSITE_ID": {
    "required": false,
    "type": "string",
    "allowEmpty": true,
    "description": "Website ID for the analytics provider. Required at runtime when PUBLIC_ANALYTICS_PROVIDER='umami'; ignored otherwise."
},
```

- [ ] **Step 2: Update `.env.example`**

In `.env.example`, replace the analytics block:

```bash
# Analytics
PUBLIC_ANALYTICS_DOMAIN=""
PUBLIC_ANALYTICS_ENABLED=true
PUBLIC_ANALYTICS_API_HOST=""
```

with:

```bash
# Analytics
# PUBLIC_ANALYTICS_PROVIDER selects the backend: "none" (disabled), "plausible", or "umami".
# This replaces the old PUBLIC_ANALYTICS_ENABLED boolean — set provider to "none" to disable.
PUBLIC_ANALYTICS_PROVIDER="none"
PUBLIC_ANALYTICS_DOMAIN=""
PUBLIC_ANALYTICS_API_HOST=""
# Required only when PUBLIC_ANALYTICS_PROVIDER="umami":
PUBLIC_ANALYTICS_WEBSITE_ID=""
```

- [ ] **Step 3: Update `vitest-setup.js`**

In `vitest-setup.js`, replace the `$env/dynamic/public` mock block:

```js
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_ANALYTICS_DOMAIN: '',
		PUBLIC_ANALYTICS_ENABLED: 'false',
		PUBLIC_ANALYTICS_API_HOST: ''
	}
}));
```

with:

```js
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_ANALYTICS_PROVIDER: 'none',
		PUBLIC_ANALYTICS_DOMAIN: '',
		PUBLIC_ANALYTICS_API_HOST: '',
		PUBLIC_ANALYTICS_WEBSITE_ID: ''
	}
}));
```

- [ ] **Step 4: Run validate-env and full test suite**

Run: `npm run validate-env`
Expected: PASS, with a warning if local `.env` still has `PUBLIC_ANALYTICS_ENABLED` (that's fine — the validator just notes "unknown variable").

Run: `npm run test`
Expected: PASS. The legacy `PlausibleAnalytics.test.js` declares its own `vi.mock` for env, so it isn't affected by the setup-file change. Component tests that don't override env now see `PUBLIC_ANALYTICS_PROVIDER: 'none'` (still disabled, no functional change).

- [ ] **Step 5: Commit**

```bash
git add env-schema.json .env.example vitest-setup.js
git commit -m "Replace PUBLIC_ANALYTICS_ENABLED with PUBLIC_ANALYTICS_PROVIDER"
```

---

## Task 8: Analytics facade — base, isEnabled, typedefs

**Files:**

- Create: `src/lib/Analytics/types.js` (JSDoc only; no runtime code)
- Create: `src/lib/Analytics/Analytics.js`
- Create: `src/lib/Analytics/index.js`
- Test: `src/tests/lib/Analytics/Analytics.test.js`

I7 fix: add a `types.js` file with JSDoc typedefs so the envelope shape is documented in one place.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/lib/Analytics/Analytics.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PUBLIC_ANALYTICS_PROVIDER: 'plausible'
}));

vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockEnv;
	}
}));

import { Analytics } from '$lib/Analytics/Analytics.js';

describe('Analytics (constructor + isEnabled)', () => {
	beforeEach(() => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'plausible';
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('falls back to dynamic env when none provided', () => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'umami';
		expect(new Analytics().isEnabled()).toBe(true);
	});

	it('accepts an env arg', () => {
		const instance = new Analytics({ PUBLIC_ANALYTICS_PROVIDER: 'plausible' });
		expect(instance.isEnabled()).toBe(true);
	});

	it('isEnabled() returns false when provider is "none"', () => {
		expect(new Analytics({ PUBLIC_ANALYTICS_PROVIDER: 'none' }).isEnabled()).toBe(false);
	});

	it('isEnabled() returns false when provider is empty string', () => {
		expect(new Analytics({ PUBLIC_ANALYTICS_PROVIDER: '' }).isEnabled()).toBe(false);
	});

	it('isEnabled() returns false when provider is undefined', () => {
		expect(new Analytics({}).isEnabled()).toBe(false);
	});

	it('initialises defaultProperties to empty object', () => {
		expect(new Analytics({}).defaultProperties).toEqual({});
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/Analytics.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the typedefs file**

Create `src/lib/Analytics/types.js`:

```js
/**
 * @typedef {Object} AnalyticsEnvelope
 * @property {string} name      Event name (e.g. "pageview", "search", "click").
 * @property {string} url       Path on the site (e.g. "/", "/stop").
 * @property {string} [referrer]
 * @property {string} [title]
 * @property {string} [language]
 * @property {string} [screen]  Format "WIDTHxHEIGHT".
 * @property {Object} [props]   Event-specific properties.
 */

/**
 * @typedef {Object} RequestContext
 * @property {string} userAgent  Forwarded from the originating browser.
 * @property {string} clientIp   Forwarded from the originating browser (X-Forwarded-For).
 */

export {};
```

- [ ] **Step 4: Implement the base Analytics class**

Create `src/lib/Analytics/Analytics.js`:

```js
import { env as dynamicEnv } from '$env/dynamic/public';

export class Analytics {
	constructor(env) {
		this.env = env || dynamicEnv;
		this.defaultProperties = {};
	}

	isEnabled() {
		const provider = this.env.PUBLIC_ANALYTICS_PROVIDER;
		return !!provider && provider !== 'none';
	}
}
```

Create `src/lib/Analytics/index.js`:

```js
import { Analytics } from './Analytics.js';

const analytics = new Analytics();
export default analytics;
export { Analytics };
```

- [ ] **Step 5: Run tests and confirm they pass**

Run: `npm run test -- src/tests/lib/Analytics/Analytics.test.js`
Expected: PASS — 6/6 green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/Analytics/types.js \
        src/lib/Analytics/Analytics.js \
        src/lib/Analytics/index.js \
        src/tests/lib/Analytics/Analytics.test.js
git commit -m "Add Analytics facade with provider-aware isEnabled and typedefs"
```

---

## Task 9: Analytics facade — envelope, report methods, sendBeacon

**Files:**

- Modify: `src/lib/Analytics/Analytics.js`
- Modify: `src/tests/lib/Analytics/Analytics.test.js`

I4 fix: when `document.visibilityState === 'hidden'`, use `navigator.sendBeacon` instead of `fetch` so events fired during page-unload aren't cancelled. I7 fix: facade validates envelope has `name` + `url` before sending (single source of truth).

- [ ] **Step 1: Add the failing tests**

Append to `src/tests/lib/Analytics/Analytics.test.js`:

```js
describe('Analytics envelope construction', () => {
	beforeEach(() => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'umami';
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ status: 'ok' })
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reportPageView POSTs envelope to /api/events', async () => {
		await new Analytics().reportPageView('/test');
		expect(global.fetch).toHaveBeenCalledWith(
			'/api/events',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			})
		);
	});

	it('envelope includes name=pageview and url', async () => {
		await new Analytics().reportPageView('/test');
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.name).toBe('pageview');
		expect(body.url).toBe('/test');
	});

	it('envelope includes browser context (referrer, title, language, screen)', async () => {
		Object.defineProperty(window, 'screen', {
			value: { width: 1920, height: 1080 },
			writable: true,
			configurable: true
		});
		Object.defineProperty(document, 'title', {
			value: 'Test Title',
			writable: true,
			configurable: true
		});

		await new Analytics().reportPageView('/test');
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.screen).toBe('1920x1080');
		expect(body.title).toBe('Test Title');
		expect(body.language).toBeTypeOf('string');
		expect(body.referrer).toBeTypeOf('string');
	});

	it('merges defaultProperties into envelope.props', async () => {
		const analytics = new Analytics();
		analytics.defaultProperties = { id: '1_00' };
		await analytics.reportPageView('/test', { extra: 'x' });
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.props).toEqual({ id: '1_00', extra: 'x' });
	});

	it('short-circuits without fetching when provider is none', async () => {
		const analytics = new Analytics({ PUBLIC_ANALYTICS_PROVIDER: 'none' });
		const result = await analytics.reportPageView('/test');
		expect(result).toBeUndefined();
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('throws when /api/events responds non-OK', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			statusText: 'Server Error',
			text: async () => 'boom'
		});
		await expect(new Analytics().reportPageView('/test')).rejects.toThrow(
			'Error sending event: Server Error. boom'
		);
	});

	it('falls back to empty strings when window is undefined', async () => {
		const originalWindow = global.window;
		// eslint-disable-next-line no-undef
		delete global.window;
		try {
			const analytics = new Analytics();
			const ctx = analytics.collectBrowserContext();
			expect(ctx).toEqual({ referrer: '', title: '', language: '', screen: '' });
		} finally {
			global.window = originalWindow;
		}
	});
});

describe('Analytics convenience methods', () => {
	beforeEach(() => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'umami';
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ status: 'ok' })
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reportSearchQuery posts search event', async () => {
		await new Analytics().reportSearchQuery('bus 44');
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.name).toBe('search');
		expect(body.url).toBe('/search');
		expect(body.props.query).toBe('bus 44');
	});

	it('reportStopViewed posts pageview with id+distance', async () => {
		await new Analytics().reportStopViewed('1_100', 'User Distance: 00050-00100m');
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.name).toBe('pageview');
		expect(body.url).toBe('/stop');
		expect(body.props).toMatchObject({
			id: '1_100',
			distance: 'User Distance: 00050-00100m'
		});
	});

	it('reportRouteClicked posts click with route id', async () => {
		await new Analytics().reportRouteClicked('544');
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.name).toBe('click');
		expect(body.url).toBe('/route');
		expect(body.props.id).toBe('544');
	});

	it('reportArrivalClicked posts click with item_id', async () => {
		await new Analytics().reportArrivalClicked('arrival-tap');
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.name).toBe('click');
		expect(body.url).toBe('/arrivals');
		expect(body.props.item_id).toBe('arrival-tap');
	});
});

describe('Analytics sendBeacon fallback on page unload', () => {
	let sendBeaconSpy;
	beforeEach(() => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'umami';
		sendBeaconSpy = vi.fn(() => true);
		Object.defineProperty(global.navigator, 'sendBeacon', {
			value: sendBeaconSpy,
			writable: true,
			configurable: true
		});
		Object.defineProperty(document, 'visibilityState', {
			value: 'hidden',
			writable: true,
			configurable: true
		});
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Object.defineProperty(document, 'visibilityState', {
			value: 'visible',
			writable: true,
			configurable: true
		});
	});

	it('uses sendBeacon when document is hidden', async () => {
		await new Analytics().reportArrivalClicked('arrival-tap');
		expect(sendBeaconSpy).toHaveBeenCalledWith('/api/events', expect.any(Blob));
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('falls back to fetch when sendBeacon returns false', async () => {
		sendBeaconSpy.mockReturnValue(false);
		global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		await new Analytics().reportArrivalClicked('arrival-tap');
		expect(global.fetch).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/Analytics.test.js`
Expected: FAIL — `reportPageView` etc. are not functions.

- [ ] **Step 3: Implement the facade methods**

Replace `src/lib/Analytics/Analytics.js` with:

```js
import { env as dynamicEnv } from '$env/dynamic/public';

/**
 * Provider-agnostic facade. Builds an AnalyticsEnvelope and POSTs it to /api/events.
 * Adapter selection happens on the server inside /api/events; the facade only knows
 * whether analytics is on or off.
 */
export class Analytics {
	constructor(env) {
		this.env = env || dynamicEnv;
		this.defaultProperties = {};
	}

	isEnabled() {
		const provider = this.env.PUBLIC_ANALYTICS_PROVIDER;
		return !!provider && provider !== 'none';
	}

	collectBrowserContext() {
		if (typeof window === 'undefined') {
			return { referrer: '', title: '', language: '', screen: '' };
		}
		return {
			referrer: typeof document !== 'undefined' ? document.referrer : '',
			title: typeof document !== 'undefined' ? document.title : '',
			language: typeof navigator !== 'undefined' ? navigator.language : '',
			screen: window.screen ? `${window.screen.width}x${window.screen.height}` : ''
		};
	}

	buildProps(otherProps = {}) {
		return { ...this.defaultProperties, ...otherProps };
	}

	buildEnvelope(pageURL, eventName, props) {
		return {
			name: eventName,
			url: pageURL,
			...this.collectBrowserContext(),
			props: this.buildProps(props)
		};
	}

	async postEvent(pageURL, eventName, props = {}) {
		if (!this.isEnabled()) {
			return;
		}

		if (!eventName || !pageURL) {
			throw new Error('postEvent requires name and url');
		}

		const envelope = this.buildEnvelope(pageURL, eventName, props);
		const body = JSON.stringify(envelope);

		if (
			typeof document !== 'undefined' &&
			document.visibilityState === 'hidden' &&
			typeof navigator !== 'undefined' &&
			typeof navigator.sendBeacon === 'function'
		) {
			const blob = new Blob([body], { type: 'application/json' });
			if (navigator.sendBeacon('/api/events', blob)) {
				return;
			}
		}

		const response = await fetch('/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Error sending event: ${response.statusText}. ${errorText}`);
		}
		return response.json();
	}

	async reportPageView(pageURL, props = {}) {
		return this.postEvent(pageURL, 'pageview', props);
	}

	async reportSearchQuery(query) {
		return this.postEvent('/search', 'search', { query });
	}

	async reportStopViewed(id, distance) {
		return this.postEvent('/stop', 'pageview', { id, distance });
	}

	async reportRouteClicked(routeId) {
		return this.postEvent('/route', 'click', { id: routeId });
	}

	async reportArrivalClicked(action) {
		return this.postEvent('/arrivals', 'click', { item_id: action });
	}
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test -- src/tests/lib/Analytics/Analytics.test.js`
Expected: PASS — all facade tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/Analytics.js src/tests/lib/Analytics/Analytics.test.js
git commit -m "Implement Analytics facade envelope + report methods + sendBeacon"
```

---

## Task 10: Switch /api/events route to factory

**Files:**

- Modify: `src/routes/api/events/+server.js`
- Modify: `src/tests/api/events.test.js`

I6 fix: return 400 for JSON parse failures so ops dashboards can distinguish bad input from upstream errors. I5 fix: extract `clientIp` from `getClientAddress()` (with `X-Forwarded-For` fallback).

- [ ] **Step 1: Update the route test**

Replace `src/tests/api/events.test.js` with:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PUBLIC_ANALYTICS_PROVIDER: 'plausible',
	PUBLIC_ANALYTICS_DOMAIN: 'example.com',
	PUBLIC_ANALYTICS_API_HOST: 'https://plausible.example.com',
	PUBLIC_ANALYTICS_WEBSITE_ID: ''
}));

vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockEnv;
	}
}));

import { POST } from '$src/routes/api/events/+server.js';

const baseEnvelope = JSON.stringify({
	name: 'pageview',
	url: '/test',
	referrer: '',
	title: 'Test',
	language: 'en-US',
	screen: '1024x768',
	props: { id: '1' }
});

function buildEvent(body = baseEnvelope, headers = {}, clientIp = '198.51.100.10') {
	const request = new Request('http://localhost/api/events', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body
	});
	return { request, getClientAddress: () => clientIp };
}

describe('POST /api/events', () => {
	beforeEach(() => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'plausible';
		mockEnv.PUBLIC_ANALYTICS_DOMAIN = 'example.com';
		mockEnv.PUBLIC_ANALYTICS_API_HOST = 'https://plausible.example.com';
		mockEnv.PUBLIC_ANALYTICS_WEBSITE_ID = '';
		vi.restoreAllMocks();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('returns analytics disabled when provider is "none"', async () => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'none';
		const response = await POST(buildEvent());
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data).toEqual({ status: 'analytics disabled' });
	});

	it('returns analytics disabled when Plausible config is incomplete', async () => {
		mockEnv.PUBLIC_ANALYTICS_DOMAIN = '';
		const response = await POST(buildEvent());
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data).toEqual({ status: 'analytics disabled' });
	});

	it('returns analytics disabled when Umami config is incomplete', async () => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'umami';
		mockEnv.PUBLIC_ANALYTICS_WEBSITE_ID = '';
		const response = await POST(buildEvent());
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data).toEqual({ status: 'analytics disabled' });
	});

	it('proxies event to Plausible when provider=plausible', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => JSON.stringify({ status: 'ok' })
		});

		const response = await POST(buildEvent());
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data).toEqual({ status: 'ok' });
		expect(global.fetch).toHaveBeenCalledWith(
			'https://plausible.example.com/api/event',
			expect.objectContaining({
				method: 'POST',
				body: expect.stringContaining('"domain":"example.com"')
			})
		);
	});

	it('proxies event to Umami when provider=umami', async () => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'umami';
		mockEnv.PUBLIC_ANALYTICS_API_HOST = 'https://umami.example.com';
		mockEnv.PUBLIC_ANALYTICS_WEBSITE_ID = 'web-id-1';
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => JSON.stringify({ cache: 'c', sessionId: 's', visitId: 'v' })
		});

		const response = await POST(
			buildEvent(baseEnvelope, { 'user-agent': 'BrowserUA/2.0' }, '198.51.100.99')
		);
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data).toMatchObject({ cache: 'c' });
		expect(global.fetch).toHaveBeenCalledWith(
			'https://umami.example.com/api/send',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'User-Agent': 'BrowserUA/2.0',
					'X-Forwarded-For': '198.51.100.99'
				}),
				body: expect.stringContaining('"website":"web-id-1"')
			})
		);
	});

	it('forwards upstream status code on upstream error', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 502,
			statusText: 'Bad Gateway'
		});
		const response = await POST(buildEvent());
		const data = await response.json();
		expect(response.status).toBe(502);
		expect(data).toEqual({ error: 'Error sending event: Bad Gateway' });
	});

	it('returns 400 when request body is not valid JSON', async () => {
		const response = await POST(buildEvent('not json'));
		const data = await response.json();
		expect(response.status).toBe(400);
		expect(data).toHaveProperty('error');
	});

	it('returns 500 when fetch throws', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
		const response = await POST(buildEvent());
		const data = await response.json();
		expect(response.status).toBe(500);
		expect(data).toEqual({ error: 'Network failure' });
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/api/events.test.js`
Expected: FAIL — current `+server.js` still imports `PlausibleAnalytics` and reads old env.

- [ ] **Step 3: Update the route**

Replace `src/routes/api/events/+server.js` with:

```js
import { env as dynamicEnv } from '$env/dynamic/public';
import { createAdapter } from '$lib/Analytics/createAdapter.js';

export async function POST({ request, getClientAddress }) {
	let envelope;
	try {
		envelope = await request.json();
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || 'Invalid JSON' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const adapter = createAdapter(dynamicEnv);
		const ctx = {
			userAgent: request.headers.get('user-agent') ?? '',
			clientIp:
				(typeof getClientAddress === 'function' && getClientAddress()) ||
				request.headers.get('x-forwarded-for') ||
				''
		};
		const data = await adapter.forwardEvent(envelope, ctx);
		return new Response(JSON.stringify(data), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
			status: error.upstreamStatus || 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test -- src/tests/api/events.test.js`
Expected: PASS — all route tests green.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/events/+server.js src/tests/api/events.test.js
git commit -m "Route /api/events through createAdapter with clientIp + JSON parse 400"
```

---

## Task 11: Update component test mocks to new module path

**Files:**

- Modify: `src/components/search/__tests__/SearchField.test.js`
- Modify: `src/components/search/__tests__/SearchPane.test.js`
- Modify: `src/components/stops/__tests__/StopPane.test.js`

C1 fix: these tests currently mock `$lib/Analytics/PlausibleAnalytics`. Once components switch to `$lib/Analytics` (Task 12), those mocks become dead code and assertions silently lose meaning. We update them _before_ the component imports change so test coverage stays intact.

- [ ] **Step 1: Update `SearchField.test.js`**

In `src/components/search/__tests__/SearchField.test.js`:

- Line 7: change `vi.mock('$lib/Analytics/PlausibleAnalytics', () => ({` to `vi.mock('$lib/Analytics', () => ({`.
- Line 38: change `analytics = (await import('$lib/Analytics/PlausibleAnalytics')).default;` to `analytics = (await import('$lib/Analytics')).default;`.

- [ ] **Step 2: Update `SearchPane.test.js`**

In `src/components/search/__tests__/SearchPane.test.js`:

- Line 8: change `vi.mock('$lib/Analytics/PlausibleAnalytics', () => ({` to `vi.mock('$lib/Analytics', () => ({`.

- [ ] **Step 3: Update `StopPane.test.js`**

In `src/components/stops/__tests__/StopPane.test.js`:

- Line 100: change `vi.mock('$lib/Analytics/PlausibleAnalytics', () => ({` to `vi.mock('$lib/Analytics', () => ({`.

- [ ] **Step 4: Run those test files to confirm they still pass**

Run: `npm run test -- src/components/search/__tests__/SearchField.test.js src/components/search/__tests__/SearchPane.test.js src/components/stops/__tests__/StopPane.test.js`
Expected: PASS — the mock target changed but the components still import `$lib/Analytics/PlausibleAnalytics`. Vitest's mock registry resolves both paths (the new mock is at `$lib/Analytics` which the components don't import yet), so the mocks are _registered but unused_. Tests should still pass because the components hit the real `PlausibleAnalytics` singleton, which with `PUBLIC_ANALYTICS_PROVIDER=none` (default mock from Task 7) plus the legacy `PUBLIC_ANALYTICS_ENABLED` being absent makes `isEnabled()` return false. Verify analytics-call assertions still pass — if any test asserted `analytics.reportX.toHaveBeenCalledWith(...)`, those assertions now point at the NEW mock object that nothing called, so they'll fail. If that happens, mark the test as expected-to-fail temporarily; Task 12 will make the assertions work again.

If any test fails between Task 11 and Task 12: it's because the test asserts on an analytics mock that components don't import yet. Continue to Task 12 immediately; do not investigate.

- [ ] **Step 5: Commit**

```bash
git add src/components/search/__tests__/SearchField.test.js \
        src/components/search/__tests__/SearchPane.test.js \
        src/components/stops/__tests__/StopPane.test.js
git commit -m "Point component test mocks at \$lib/Analytics ahead of component import switch"
```

---

## Task 12: Migrate component imports to the facade

**Files:**

- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/stops/[stopID]/+page.svelte`
- Modify: `src/components/search/SearchField.svelte`
- Modify: `src/components/stops/StopPane.svelte`

- [ ] **Step 1: Update `src/routes/+layout.svelte`**

Change line 11 from:

```js
import analytics from '$lib/Analytics/PlausibleAnalytics.js';
```

to:

```js
import analytics from '$lib/Analytics';
```

- [ ] **Step 2: Update `src/routes/+page.svelte`**

Change line 23 from:

```js
import analytics from '$lib/Analytics/PlausibleAnalytics';
```

to:

```js
import analytics from '$lib/Analytics';
```

- [ ] **Step 3: Update `src/routes/stops/[stopID]/+page.svelte`**

Change line 10 from:

```js
import analytics from '$lib/Analytics/PlausibleAnalytics.js';
```

to:

```js
import analytics from '$lib/Analytics';
```

- [ ] **Step 4: Update `src/components/search/SearchField.svelte`**

Change line 3 from:

```js
import analytics from '$lib/Analytics/PlausibleAnalytics';
```

to:

```js
import analytics from '$lib/Analytics';
```

- [ ] **Step 5: Update `src/components/stops/StopPane.svelte`**

Change line 16 from:

```js
import analytics from '$lib/Analytics/PlausibleAnalytics';
```

to:

```js
import analytics from '$lib/Analytics';
```

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: PASS — all tests green. Component tests now have their mocks correctly intercepting the new module path.

- [ ] **Step 7: Commit**

```bash
git add src/routes/+layout.svelte \
        src/routes/+page.svelte \
        src/routes/stops/[stopID]/+page.svelte \
        src/components/search/SearchField.svelte \
        src/components/stops/StopPane.svelte
git commit -m "Switch components from PlausibleAnalytics to Analytics facade"
```

---

## Task 13: Rename `plausibleUtils.js` → `analyticsUtils.js`

**Files:**

- Rename: `src/lib/Analytics/plausibleUtils.js` → `src/lib/Analytics/analyticsUtils.js`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/stops/[stopID]/+page.svelte`

C3 fix: explicitly grep for `getDistanceCategory` (the second exported function in this file) to catch any consumer outside the file.

- [ ] **Step 1: Confirm no external consumers of `getDistanceCategory`**

Run: `grep -rn "getDistanceCategory" src/ --include="*.js" --include="*.svelte"`
Expected: only matches inside `src/lib/Analytics/plausibleUtils.js`. If anything else shows up, update that file too in Step 3.

- [ ] **Step 2: Rename the file via git mv**

```bash
git mv src/lib/Analytics/plausibleUtils.js src/lib/Analytics/analyticsUtils.js
```

- [ ] **Step 3: Update imports in `src/routes/+page.svelte`**

Change line 25 from:

```js
import { analyticsDistanceToStop } from '$lib/Analytics/plausibleUtils';
```

to:

```js
import { analyticsDistanceToStop } from '$lib/Analytics/analyticsUtils';
```

- [ ] **Step 4: Update imports in `src/routes/stops/[stopID]/+page.svelte`**

Change line 11 from:

```js
import { analyticsDistanceToStop } from '$lib/Analytics/plausibleUtils.js';
```

to:

```js
import { analyticsDistanceToStop } from '$lib/Analytics/analyticsUtils.js';
```

- [ ] **Step 5: Sanity-check for any lingering references**

Run: `grep -rn "plausibleUtils" src/ 2>/dev/null`
Expected: no output.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: PASS — all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/Analytics/analyticsUtils.js \
        src/routes/+page.svelte \
        src/routes/stops/[stopID]/+page.svelte
git commit -m "Rename plausibleUtils → analyticsUtils"
```

---

## Task 14: Delete legacy `PlausibleAnalytics` module and tests

**Files:**

- Delete: `src/lib/Analytics/PlausibleAnalytics.js`
- Delete: `src/tests/lib/PlausibleAnalytics.test.js`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "PlausibleAnalytics" src/ 2>/dev/null`
Expected: no output.

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/Analytics/PlausibleAnalytics.js \
       src/tests/lib/PlausibleAnalytics.test.js
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Remove legacy PlausibleAnalytics module"
```

---

## Task 15: Manual smoke test against live Umami instance

**Files:** (no code changes — verification only)

- [ ] **Step 1: Configure local `.env`**

Set:

```bash
PUBLIC_ANALYTICS_PROVIDER="umami"
PUBLIC_ANALYTICS_DOMAIN="localhost"
PUBLIC_ANALYTICS_API_HOST="https://analytics.sound-transit.onebusawaycloud.com"
PUBLIC_ANALYTICS_WEBSITE_ID="79eab5f4-0c4d-492b-9b60-ecf018859f03"
```

- [ ] **Step 2: Run validate-env**

Run: `npm run validate-env`
Expected: PASS.

- [ ] **Step 3: Start dev server**

Run: `npm run dev`
Expected: server starts. Open the printed URL.

- [ ] **Step 4: Exercise each tracked flow in the browser**

1. Load `/` — should fire a `pageview`.
2. Type a search query and press enter — `search` event.
3. Click a stop pin on the map — `pageview` for `/stop` with `id` and `distance` props.
4. Click a route inside the stop pane — `click` for `/route` with `id`.
5. Click an arrival/departure row — `click` for `/arrivals` with `item_id`.

In the browser's network panel, confirm each `POST /api/events` returns 200 and the payload has the expected shape. No "Error sending event" entries in the console.

- [ ] **Step 5: Verify events in the Umami dashboard**

Open `https://analytics.sound-transit.onebusawaycloud.com/`, navigate to the website for ID `79eab5f4-0c4d-492b-9b60-ecf018859f03`. Confirm the events emitted in step 4 appear in the realtime view within ~30 seconds.

- [ ] **Step 6: Smoke test provider=plausible and provider=none**

Swap `PUBLIC_ANALYTICS_PROVIDER` to `plausible` (any non-empty `PUBLIC_ANALYTICS_DOMAIN`/`PUBLIC_ANALYTICS_API_HOST`) — `POST /api/events` still fires. Set to `none` — no `POST /api/events` calls.

- [ ] **Step 7: Reset `.env`**

Restore your usual local `.env`.

- [ ] **Step 8: Push the branch**

```bash
git push -u origin umami-analytics
```

---

## Coverage map (review-driven changes)

- **C1** — Component-test mock paths: Task 11.
- **C2** — `PUBLIC_ANALYTICS_PROVIDER` allowEmpty + upgrade docs: Task 7.
- **C3** — `getDistanceCategory` grep before rename: Task 13.
- **I1** — Per-provider meaning of `PUBLIC_ANALYTICS_DOMAIN` documented in schema description: Task 7.
- **I2** — Single source of truth for "enabled"; adapters log construction warnings: Tasks 2 + 5 (warnings) and Task 8 (facade `isEnabled` stays simple).
- **I3** — Documented as a design boundary in spec (no code change). Plan acknowledges in §"Open design boundaries" of spec.
- **I4** — `sendBeacon` fallback on `visibilityState === 'hidden'`: Task 9.
- **I5** — `X-Forwarded-For` to both adapters via `getClientAddress()`: Tasks 3, 5, 10.
- **I6** — 400 instead of 500 on JSON parse failure: Task 10.
- **I7** — JSDoc typedefs + envelope destructure-with-defaults: Tasks 3, 5, 8.
- **I8** — Env/setup updates moved to Task 7 (before facade in Task 8).
- **I9** — Acknowledged as future work in spec; no implementation in this plan.

Method names are consistent throughout: `forwardEvent`, `isEnabled`, `getEventUrl`, `postEvent`, `reportPageView`, `reportSearchQuery`, `reportStopViewed`, `reportRouteClicked`, `reportArrivalClicked`, `buildProps`, `buildEnvelope`, `collectBrowserContext`, `warnIfMisconfigured`, `createAdapter`. Env vars consistent: `PUBLIC_ANALYTICS_PROVIDER`, `PUBLIC_ANALYTICS_DOMAIN`, `PUBLIC_ANALYTICS_API_HOST`, `PUBLIC_ANALYTICS_WEBSITE_ID`.
