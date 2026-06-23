import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UmamiAdapter, sanitizeData, FALLBACK_USER_AGENT, isSuccessfulIngest } from '$lib/Analytics/adapters/UmamiAdapter.js';

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

	it('throws when the response body lacks a success marker', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
		await expect(new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx)).rejects.toThrow(
			'dropped event'
		);
	});
});

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

	it('falls back to the browser-shaped User-Agent when context omits it', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"cache":"x"}' });
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, { userAgent: '', clientIp: '' });
		const [, init] = global.fetch.mock.calls[0];
		expect(init.headers['User-Agent']).toBe('Mozilla/5.0 (Wayfinder)');
	});

	it('fallback User-Agent contains no isbot bot tokens', () => {
		const tokens = ['server', 'bot', 'http', 'crawl', 'scan', 'search', 'spider', 'agent'];
		const ua = FALLBACK_USER_AGENT.toLowerCase();
		for (const token of tokens) {
			expect(ua).not.toContain(token);
		}
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

	it('passes an AbortSignal to fetch so the request can time out', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"cache":"x"}' });
		await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it('propagates AbortError when the upstream times out', async () => {
		global.fetch = vi
			.fn()
			.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
		await expect(new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx)).rejects.toThrow('aborted');
	});

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
});

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
