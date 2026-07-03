import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlausibleAdapter } from '$lib/Insights/adapters/PlausibleAdapter.js';

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

	it('passes an AbortSignal to fetch so the request can time out', async () => {
		await new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx);
		const [, init] = global.fetch.mock.calls[0];
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it('propagates AbortError when the upstream times out', async () => {
		global.fetch = vi
			.fn()
			.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
		await expect(new PlausibleAdapter(fullEnv).forwardEvent(envelope, ctx)).rejects.toThrow(
			'aborted'
		);
	});
});
