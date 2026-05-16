# Umami Analytics Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-provider Plausible integration with a pluggable adapter system that supports Plausible, Umami, or no provider, selected via `PUBLIC_ANALYTICS_PROVIDER`.

**Architecture:** Facade (`Analytics`) → factory (`createAdapter`) → adapter (`PlausibleAdapter` | `UmamiAdapter` | `NoopAdapter`). The facade is what components import; it builds a provider-agnostic envelope, POSTs to `/api/events`, and the server route uses the factory to pick the adapter that forwards to the correct upstream.

**Tech Stack:** SvelteKit 5 with runes, Vitest + jsdom for tests, `$env/dynamic/public` for runtime env access.

**Spec:** `docs/superpowers/specs/2026-05-16-umami-analytics-adapter-design.md`

---

## File map

**New source files** (all under `src/lib/Analytics/`):
- `adapters/NoopAdapter.js` — disabled stub
- `adapters/PlausibleAdapter.js` — Plausible payload + forward
- `adapters/UmamiAdapter.js` — Umami payload + forward
- `createAdapter.js` — factory: env → adapter
- `Analytics.js` — facade class (`reportPageView` etc.)
- `index.js` — default-exports the singleton

**New test files** (all under `src/tests/lib/Analytics/`):
- `adapters/NoopAdapter.test.js`
- `adapters/PlausibleAdapter.test.js`
- `adapters/UmamiAdapter.test.js`
- `createAdapter.test.js`
- `Analytics.test.js`

**Renamed:**
- `src/lib/Analytics/plausibleUtils.js` → `src/lib/Analytics/analyticsUtils.js` (function `analyticsDistanceToStop` unchanged)

**Modified:**
- `src/routes/api/events/+server.js` — use factory + pass `{ userAgent }`
- `src/tests/api/events.test.js` — cover both adapters + provider switching
- `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/stops/[stopID]/+page.svelte` — change import to `$lib/Analytics`
- `src/components/search/SearchField.svelte`, `src/components/stops/StopPane.svelte` — same import change
- `env-schema.json` — drop `PUBLIC_ANALYTICS_ENABLED`, add `PUBLIC_ANALYTICS_PROVIDER` + `PUBLIC_ANALYTICS_WEBSITE_ID`
- `.env.example` — same change
- `vitest-setup.js` — default mock `PUBLIC_ANALYTICS_PROVIDER='none'`, drop `PUBLIC_ANALYTICS_ENABLED`

**Deleted (after migration):**
- `src/lib/Analytics/PlausibleAnalytics.js`
- `src/tests/lib/PlausibleAnalytics.test.js`

---

## Test data conventions

Every adapter accepts an `env` object in its constructor. Tests pass plain objects rather than mocking `$env/dynamic/public`. The shared example env for Plausible tests:

```js
const plausibleEnv = {
  PUBLIC_ANALYTICS_PROVIDER: 'plausible',
  PUBLIC_ANALYTICS_DOMAIN: 'example.com',
  PUBLIC_ANALYTICS_API_HOST: 'https://plausible.example.com'
};
```

For Umami:

```js
const umamiEnv = {
  PUBLIC_ANALYTICS_PROVIDER: 'umami',
  PUBLIC_ANALYTICS_DOMAIN: 'example.com',
  PUBLIC_ANALYTICS_API_HOST: 'https://umami.example.com',
  PUBLIC_ANALYTICS_WEBSITE_ID: '79eab5f4-0c4d-492b-9b60-ecf018859f03'
};
```

Standard envelope used across forwardEvent tests:

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

const ctx = { userAgent: 'TestAgent/1.0' };
```

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
			{ userAgent: 'X' }
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
Expected: PASS — 2/2 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/NoopAdapter.js \
        src/tests/lib/Analytics/adapters/NoopAdapter.test.js
git commit -m "Add NoopAdapter for disabled analytics"
```

---

## Task 2: UmamiAdapter — isEnabled gate

**Files:**
- Create: `src/lib/Analytics/adapters/UmamiAdapter.js`
- Test: `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`

- [ ] **Step 1: Write the failing tests for isEnabled**

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

const ctx = { userAgent: 'TestAgent/1.0' };

describe('UmamiAdapter.isEnabled', () => {
	it('returns true when domain, api host, and website id are all set', () => {
		expect(new UmamiAdapter(fullEnv).isEnabled()).toBe(true);
	});

	it('returns false when website id is missing', () => {
		const env = { ...fullEnv, PUBLIC_ANALYTICS_WEBSITE_ID: '' };
		expect(new UmamiAdapter(env).isEnabled()).toBe(false);
	});

	it('returns false when api host is missing', () => {
		const env = { ...fullEnv, PUBLIC_ANALYTICS_API_HOST: '' };
		expect(new UmamiAdapter(env).isEnabled()).toBe(false);
	});

	it('returns false when domain is missing', () => {
		const env = { ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' };
		expect(new UmamiAdapter(env).isEnabled()).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create UmamiAdapter with isEnabled only**

Create `src/lib/Analytics/adapters/UmamiAdapter.js`:

```js
export class UmamiAdapter {
	constructor(env) {
		this.env = env;
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
Expected: PASS — 4/4 tests green (forwardEvent has no tests yet).

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/UmamiAdapter.js \
        src/tests/lib/Analytics/adapters/UmamiAdapter.test.js
git commit -m "Add UmamiAdapter isEnabled config gate"
```

---

## Task 3: UmamiAdapter — forwardEvent happy path

**Files:**
- Modify: `src/lib/Analytics/adapters/UmamiAdapter.js`
- Test: `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js` (imports and fixtures from Task 2 stay at the top; just append a new describe block):

```js
describe('UmamiAdapter.forwardEvent (happy path)', () => {
	beforeEach(() => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ cache: 'abc', sessionId: 's', visitId: 'v' })
		});
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
Expected: FAIL — happy-path tests all fail because `forwardEvent` throws "not implemented".

- [ ] **Step 3: Implement forwardEvent happy path**

Replace `src/lib/Analytics/adapters/UmamiAdapter.js` with:

```js
export class UmamiAdapter {
	constructor(env) {
		this.env = env;
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
		const body = {
			type: 'event',
			payload: {
				website: this.env.PUBLIC_ANALYTICS_WEBSITE_ID,
				hostname: this.env.PUBLIC_ANALYTICS_DOMAIN,
				language: envelope.language,
				screen: envelope.screen,
				url: envelope.url,
				referrer: envelope.referrer,
				title: envelope.title,
				name: envelope.name,
				data: envelope.props
			}
		};

		const res = await fetch(this.getEventUrl(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': requestContext.userAgent
			},
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
Expected: PASS — 11/11 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/UmamiAdapter.js \
        src/tests/lib/Analytics/adapters/UmamiAdapter.test.js
git commit -m "Implement UmamiAdapter forwardEvent happy path"
```

---

## Task 4: UmamiAdapter — disabled, validation, User-Agent fallback, errors

**Files:**
- Modify: `src/lib/Analytics/adapters/UmamiAdapter.js`
- Test: `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`:

```js
describe('UmamiAdapter.forwardEvent (edge cases)', () => {
	beforeEach(() => {
		global.fetch = vi.fn();
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
		await expect(
			new UmamiAdapter(fullEnv).forwardEvent({ url: '/x' }, ctx)
		).rejects.toThrow('forwardEvent requires name and url');
	});

	it('throws when envelope.url is missing', async () => {
		await expect(
			new UmamiAdapter(fullEnv).forwardEvent({ name: 'pageview' }, ctx)
		).rejects.toThrow('forwardEvent requires name and url');
	});

	it('falls back to Wayfinder/1.0 User-Agent when context omits it', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' });
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, { userAgent: '' });
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
		await expect(
			new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx)
		).rejects.toThrow('Network failure');
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/lib/Analytics/adapters/UmamiAdapter.test.js`
Expected: FAIL — disabled / validation / fallback / error tests all fail.

- [ ] **Step 3: Implement the edge cases**

Replace `src/lib/Analytics/adapters/UmamiAdapter.js` with:

```js
export class UmamiAdapter {
	constructor(env) {
		this.env = env;
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

		if (!envelope.name || !envelope.url) {
			throw new Error('forwardEvent requires name and url');
		}

		const body = {
			type: 'event',
			payload: {
				website: this.env.PUBLIC_ANALYTICS_WEBSITE_ID,
				hostname: this.env.PUBLIC_ANALYTICS_DOMAIN,
				language: envelope.language,
				screen: envelope.screen,
				url: envelope.url,
				referrer: envelope.referrer,
				title: envelope.title,
				name: envelope.name,
				data: envelope.props
			}
		};

		const res = await fetch(this.getEventUrl(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': requestContext.userAgent || 'Wayfinder/1.0'
			},
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
Expected: PASS — all UmamiAdapter tests green (17 total).

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

const ctx = { userAgent: 'TestAgent/1.0' };

describe('PlausibleAdapter.isEnabled', () => {
	it('returns true when domain and api host are set', () => {
		expect(new PlausibleAdapter(fullEnv).isEnabled()).toBe(true);
	});

	it('returns false when domain is missing', () => {
		expect(
			new PlausibleAdapter({ ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' }).isEnabled()
		).toBe(false);
	});

	it('returns false when api host is missing', () => {
		expect(
			new PlausibleAdapter({ ...fullEnv, PUBLIC_ANALYTICS_API_HOST: '' }).isEnabled()
		).toBe(false);
	});
});

describe('PlausibleAdapter.forwardEvent', () => {
	beforeEach(() => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ status: 'ok' })
		});
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
		await expect(
			new PlausibleAdapter(fullEnv).forwardEvent({ url: '/x' }, ctx)
		).rejects.toThrow('forwardEvent requires name and url');
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

	it('ignores requestContext (Plausible derives UA from headers)', async () => {
		await new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		expect(init.headers['User-Agent']).toBeUndefined();
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
		await expect(
			new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx)
		).rejects.toThrow('Network failure');
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
	}

	isEnabled() {
		return !!this.env.PUBLIC_ANALYTICS_DOMAIN && !!this.env.PUBLIC_ANALYTICS_API_HOST;
	}

	getEventUrl() {
		return `${this.env.PUBLIC_ANALYTICS_API_HOST}/api/event`;
	}

	async forwardEvent(envelope) {
		if (!this.isEnabled()) {
			return { status: 'analytics disabled' };
		}

		if (!envelope.name || !envelope.url) {
			throw new Error('forwardEvent requires name and url');
		}

		const res = await fetch(this.getEventUrl(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				domain: this.env.PUBLIC_ANALYTICS_DOMAIN,
				name: envelope.name,
				url: envelope.url,
				referrer: envelope.referrer,
				props: envelope.props
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
Expected: PASS — 13/13 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/adapters/PlausibleAdapter.js \
        src/tests/lib/Analytics/adapters/PlausibleAdapter.test.js
git commit -m "Add PlausibleAdapter mirroring current PlausibleAnalytics"
```

---

## Task 6: createAdapter factory

**Files:**
- Create: `src/lib/Analytics/createAdapter.js`
- Test: `src/tests/lib/Analytics/createAdapter.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/lib/Analytics/createAdapter.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createAdapter } from '$lib/Analytics/createAdapter.js';
import { NoopAdapter } from '$lib/Analytics/adapters/NoopAdapter.js';
import { PlausibleAdapter } from '$lib/Analytics/adapters/PlausibleAdapter.js';
import { UmamiAdapter } from '$lib/Analytics/adapters/UmamiAdapter.js';

describe('createAdapter', () => {
	it('returns NoopAdapter when PUBLIC_ANALYTICS_PROVIDER is "none"', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: 'none' })).toBeInstanceOf(NoopAdapter);
	});

	it('returns NoopAdapter when provider is unset', () => {
		expect(createAdapter({})).toBeInstanceOf(NoopAdapter);
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
Expected: PASS — 6/6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/createAdapter.js \
        src/tests/lib/Analytics/createAdapter.test.js
git commit -m "Add createAdapter factory that dispatches by PUBLIC_ANALYTICS_PROVIDER"
```

---

## Task 7: Analytics facade — isEnabled and base structure

**Files:**
- Create: `src/lib/Analytics/Analytics.js`
- Create: `src/lib/Analytics/index.js`
- Test: `src/tests/lib/Analytics/Analytics.test.js`

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

- [ ] **Step 3: Implement the base Analytics class**

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

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test -- src/tests/lib/Analytics/Analytics.test.js`
Expected: PASS — 5/5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/Analytics.js \
        src/lib/Analytics/index.js \
        src/tests/lib/Analytics/Analytics.test.js
git commit -m "Add Analytics facade with provider-aware isEnabled"
```

---

## Task 8: Analytics facade — envelope + POST to /api/events

**Files:**
- Modify: `src/lib/Analytics/Analytics.js`
- Modify: `src/tests/lib/Analytics/Analytics.test.js`

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
		// jsdom defaults: language=en-US, title='', referrer=''
		// screen present via window.screen
		Object.defineProperty(window, 'screen', {
			value: { width: 1920, height: 1080 },
			writable: true
		});
		Object.defineProperty(document, 'title', { value: 'Test Title', writable: true });

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

	it('reportSearchQuery posts search event with /search url and query prop', async () => {
		await new Analytics().reportSearchQuery('bus 44');
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.name).toBe('search');
		expect(body.url).toBe('/search');
		expect(body.props.query).toBe('bus 44');
	});

	it('reportStopViewed posts pageview with /stop url and id+distance props', async () => {
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

	it('reportRouteClicked posts click event with /route url and route id', async () => {
		await new Analytics().reportRouteClicked('544');
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.name).toBe('click');
		expect(body.url).toBe('/route');
		expect(body.props.id).toBe('544');
	});

	it('reportArrivalClicked posts click event with /arrivals url and item_id', async () => {
		await new Analytics().reportArrivalClicked('arrival-tap');
		const [, init] = global.fetch.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.name).toBe('click');
		expect(body.url).toBe('/arrivals');
		expect(body.props.item_id).toBe('arrival-tap');
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

	async postEvent(pageURL, eventName, props = {}) {
		if (!this.isEnabled()) {
			console.debug('Analytics disabled: skipping event');
			return;
		}

		const ctx = this.collectBrowserContext();
		const envelope = {
			name: eventName,
			url: pageURL,
			...ctx,
			props: this.buildProps(props)
		};

		const response = await fetch('/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(envelope)
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
Expected: PASS — all Analytics facade tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Analytics/Analytics.js src/tests/lib/Analytics/Analytics.test.js
git commit -m "Implement Analytics facade envelope + report methods"
```

---

## Task 9: Switch /api/events route to factory

**Files:**
- Modify: `src/routes/api/events/+server.js`
- Modify: `src/tests/api/events.test.js`

- [ ] **Step 1: Update the route test to use the new env shape**

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

function buildRequest(body = baseEnvelope, headers = {}) {
	return new Request('http://localhost/api/events', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body
	});
}

describe('POST /api/events', () => {
	beforeEach(() => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'plausible';
		mockEnv.PUBLIC_ANALYTICS_DOMAIN = 'example.com';
		mockEnv.PUBLIC_ANALYTICS_API_HOST = 'https://plausible.example.com';
		mockEnv.PUBLIC_ANALYTICS_WEBSITE_ID = '';
		vi.restoreAllMocks();
	});

	it('returns analytics disabled when provider is "none"', async () => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'none';
		const response = await POST({ request: buildRequest() });
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data).toEqual({ status: 'analytics disabled' });
	});

	it('returns analytics disabled when Plausible config is incomplete', async () => {
		mockEnv.PUBLIC_ANALYTICS_DOMAIN = '';
		const response = await POST({ request: buildRequest() });
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data).toEqual({ status: 'analytics disabled' });
	});

	it('returns analytics disabled when Umami config is incomplete', async () => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'umami';
		mockEnv.PUBLIC_ANALYTICS_WEBSITE_ID = '';
		const response = await POST({ request: buildRequest() });
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

		const response = await POST({ request: buildRequest() });
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

		const response = await POST({
			request: buildRequest(baseEnvelope, { 'user-agent': 'BrowserUA/2.0' })
		});
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data).toMatchObject({ cache: 'c' });
		expect(global.fetch).toHaveBeenCalledWith(
			'https://umami.example.com/api/send',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({ 'User-Agent': 'BrowserUA/2.0' }),
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
		const response = await POST({ request: buildRequest() });
		const data = await response.json();
		expect(response.status).toBe(502);
		expect(data).toEqual({ error: 'Error sending event: Bad Gateway' });
	});

	it('returns 500 when request body is not valid JSON', async () => {
		const response = await POST({ request: buildRequest('not json') });
		const data = await response.json();
		expect(response.status).toBe(500);
		expect(data).toHaveProperty('error');
	});

	it('returns 500 when fetch throws', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
		const response = await POST({ request: buildRequest() });
		const data = await response.json();
		expect(response.status).toBe(500);
		expect(data).toEqual({ error: 'Network failure' });
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm run test -- src/tests/api/events.test.js`
Expected: FAIL — current `+server.js` still imports `PlausibleAnalytics` and reads the old env vars.

- [ ] **Step 3: Update the route to use the factory**

Replace `src/routes/api/events/+server.js` with:

```js
import { env as dynamicEnv } from '$env/dynamic/public';
import { createAdapter } from '$lib/Analytics/createAdapter.js';

export async function POST({ request }) {
	try {
		const envelope = await request.json();
		const adapter = createAdapter(dynamicEnv);
		const ctx = { userAgent: request.headers.get('user-agent') ?? '' };
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
git commit -m "Route /api/events through createAdapter factory"
```

---

## Task 10: Update env schema, .env.example, vitest-setup

**Files:**
- Modify: `env-schema.json`
- Modify: `.env.example`
- Modify: `vitest-setup.js`

- [ ] **Step 1: Update `env-schema.json`**

Open `env-schema.json`. Remove the entry `"PUBLIC_ANALYTICS_ENABLED": { ... }`. Leave `PUBLIC_ANALYTICS_DOMAIN` and `PUBLIC_ANALYTICS_API_HOST` unchanged. After the `PUBLIC_ANALYTICS_API_HOST` block, insert:

```json
"PUBLIC_ANALYTICS_PROVIDER": {
    "required": false,
    "type": "enum",
    "enum": ["none", "plausible", "umami"],
    "description": "Which analytics backend to use. 'none' disables analytics entirely."
},
"PUBLIC_ANALYTICS_WEBSITE_ID": {
    "required": false,
    "type": "string",
    "allowEmpty": true,
    "description": "Website ID for the analytics provider. Required when PUBLIC_ANALYTICS_PROVIDER is 'umami'."
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
# Analytics — set PUBLIC_ANALYTICS_PROVIDER to "none" to disable, or "plausible" / "umami" to enable.
PUBLIC_ANALYTICS_PROVIDER="none"
PUBLIC_ANALYTICS_DOMAIN=""
PUBLIC_ANALYTICS_API_HOST=""
# Required only when PUBLIC_ANALYTICS_PROVIDER=umami:
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

- [ ] **Step 4: Run env validation and full test suite**

Run: `npm run validate-env`
Expected: PASS (or fail with a clear message if `.env` still has `PUBLIC_ANALYTICS_ENABLED` — that's expected; warn the developer to update their local `.env`).

Run: `npm run test`
Expected: PASS — all existing tests should still be green. The default mock (`PUBLIC_ANALYTICS_PROVIDER: 'none'`) makes the Analytics facade short-circuit before fetching, so any component tests that exercise analytics-emitting flows continue to no-op.

- [ ] **Step 5: Commit**

```bash
git add env-schema.json .env.example vitest-setup.js
git commit -m "Replace PUBLIC_ANALYTICS_ENABLED with PUBLIC_ANALYTICS_PROVIDER"
```

---

## Task 11: Migrate component imports to the facade

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
Expected: PASS — all tests green. Component tests should continue to work because the default mocked provider is `'none'`, which makes the facade no-op.

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

## Task 12: Rename `plausibleUtils.js` → `analyticsUtils.js`

**Files:**
- Rename: `src/lib/Analytics/plausibleUtils.js` → `src/lib/Analytics/analyticsUtils.js`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/stops/[stopID]/+page.svelte`

- [ ] **Step 1: Rename the file via git mv**

```bash
git mv src/lib/Analytics/plausibleUtils.js src/lib/Analytics/analyticsUtils.js
```

- [ ] **Step 2: Update imports in `src/routes/+page.svelte`**

Change line 25 from:

```js
import { analyticsDistanceToStop } from '$lib/Analytics/plausibleUtils';
```

to:

```js
import { analyticsDistanceToStop } from '$lib/Analytics/analyticsUtils';
```

- [ ] **Step 3: Update imports in `src/routes/stops/[stopID]/+page.svelte`**

Change line 11 from:

```js
import { analyticsDistanceToStop } from '$lib/Analytics/plausibleUtils.js';
```

to:

```js
import { analyticsDistanceToStop } from '$lib/Analytics/analyticsUtils.js';
```

- [ ] **Step 4: Sanity-check for any lingering references**

Run: `grep -rn "plausibleUtils" src/ 2>/dev/null`
Expected: no output.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/Analytics/analyticsUtils.js \
        src/routes/+page.svelte \
        src/routes/stops/[stopID]/+page.svelte
git commit -m "Rename plausibleUtils → analyticsUtils"
```

---

## Task 13: Delete legacy `PlausibleAnalytics` module and tests

**Files:**
- Delete: `src/lib/Analytics/PlausibleAnalytics.js`
- Delete: `src/tests/lib/PlausibleAnalytics.test.js`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "PlausibleAnalytics" src/ 2>/dev/null`
Expected: no output (after Task 11 + 12 there should be none).

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/Analytics/PlausibleAnalytics.js \
       src/tests/lib/PlausibleAnalytics.test.js
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: PASS — coverage now provided by per-adapter tests and the Analytics facade tests.

- [ ] **Step 4: Run lint and format check**

Run: `npm run lint`
Expected: PASS — no formatting or lint issues.

- [ ] **Step 5: Commit**

```bash
git commit -m "Remove legacy PlausibleAnalytics module"
```

---

## Task 14: Manual smoke test against live Umami instance

**Files:** (no code changes — verification only)

- [ ] **Step 1: Configure local `.env`**

Set:

```bash
PUBLIC_ANALYTICS_PROVIDER="umami"
PUBLIC_ANALYTICS_DOMAIN="<your local hostname, e.g. localhost>"
PUBLIC_ANALYTICS_API_HOST="https://analytics.sound-transit.onebusawaycloud.com"
PUBLIC_ANALYTICS_WEBSITE_ID="79eab5f4-0c4d-492b-9b60-ecf018859f03"
```

Leave existing OBA / map / region values as-is.

- [ ] **Step 2: Run validate-env**

Run: `npm run validate-env`
Expected: PASS.

- [ ] **Step 3: Start dev server**

Run: `npm run dev`
Expected: server starts without errors. Open the printed URL.

- [ ] **Step 4: Exercise each tracked flow**

In the browser:
1. Load the home page (`/`) — should fire a `pageview`.
2. Type a query in the search field and press enter — should fire a `search` event.
3. Click a stop pin on the map — should fire a `pageview` for `/stop` with `id` and `distance` props.
4. Click a route inside the stop pane — should fire a `click` for `/route` with `id`.
5. Click an arrival/departure row — should fire a `click` for `/arrivals` with `item_id`.

Watch the dev-server's network panel for `POST /api/events` calls returning 200. Watch the browser console for any "Error sending event" messages.

- [ ] **Step 5: Verify events in Umami dashboard**

Open `https://analytics.sound-transit.onebusawaycloud.com/` and navigate to the website for ID `79eab5f4-0c4d-492b-9b60-ecf018859f03`. Within ~30 seconds the events emitted in step 4 should appear in the realtime view (or the events tab).

- [ ] **Step 6: Re-test with provider=plausible and provider=none**

Briefly swap `PUBLIC_ANALYTICS_PROVIDER` to `plausible` (with any non-empty `PUBLIC_ANALYTICS_DOMAIN` + `PUBLIC_ANALYTICS_API_HOST` you have available, or a deliberately wrong host) — confirm `POST /api/events` is still attempted. Then set it to `none` and confirm the facade short-circuits (no `POST /api/events` call at all in the network panel).

- [ ] **Step 7: Reset `.env` to your normal values**

Restore your usual local `.env` settings.

- [ ] **Step 8: Push the branch**

```bash
git push -u origin umami-analytics
```

No commit needed — manual verification only.

---

## Self-review notes

Spec sections vs. tasks:
- API shapes → Tasks 3, 4, 5 (Umami payload + Plausible payload)
- Adapter contract → Tasks 1, 2-4, 5 (each adapter has constructor, isEnabled, forwardEvent)
- Generic envelope → Task 8 (facade builds it)
- Factory → Task 6
- Server route → Task 9
- Env vars (kept, removed, added) → Task 10
- File-by-file changes → Tasks 1–13
- TDD red-to-green sequence → mirrored across Tasks 1–9, each via the "write failing test → confirm fail → implement → confirm pass → commit" cycle
- Open risk: User-Agent fallback → Task 4 test ("falls back to Wayfinder/1.0")
- Open risk: browser context in tests → Task 8 test asserts `typeof window === 'undefined'` path implicitly via jsdom

No placeholders remain. Method names match across tasks: `forwardEvent`, `isEnabled`, `getEventUrl`, `postEvent`, `reportPageView`, `reportSearchQuery`, `reportStopViewed`, `reportRouteClicked`, `reportArrivalClicked`, `buildProps`, `collectBrowserContext`, `createAdapter`. Env var names consistent: `PUBLIC_ANALYTICS_PROVIDER`, `PUBLIC_ANALYTICS_DOMAIN`, `PUBLIC_ANALYTICS_API_HOST`, `PUBLIC_ANALYTICS_WEBSITE_ID`.
