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
		expect(
			new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_WEBSITE_ID: '' }).isEnabled()
		).toBe(false);
	});

	it('returns false when api host is missing', () => {
		expect(
			new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_API_HOST: '' }).isEnabled()
		).toBe(false);
	});

	it('returns false when domain is missing', () => {
		expect(
			new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' }).isEnabled()
		).toBe(false);
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

	it('returns { status: text } when response is not JSON', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'ok' });
		const result = await new UmamiAdapter(fullEnv).forwardEvent(envelope, ctx);
		expect(result).toEqual({ status: 'ok' });
	});
});
