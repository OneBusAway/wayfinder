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

	// The whole point of folding the body in is that it survives to the wire, so assert it
	// here and not only at the adapter level.
	it('forwards upstream status code and the upstream reason on upstream error', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
			text: async () => '{"error":{"message":"Website not found."}}'
		});
		const response = await POST(buildEvent());
		const data = await response.json();
		expect(response.status).toBe(400);
		expect(data.error).toBe(
			'Error sending event: 400 Bad Request — {"error":{"message":"Website not found."}}'
		);
	});

	it('still forwards the upstream status when the upstream body cannot be read', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 502,
			statusText: 'Bad Gateway'
		});
		const response = await POST(buildEvent());
		const data = await response.json();
		expect(response.status).toBe(502);
		expect(data.error).toContain('Error sending event: 502 Bad Gateway');
		expect(data.error).toContain('upstream body unreadable');
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

	it('returns 504 when the adapter aborts due to upstream timeout', async () => {
		global.fetch = vi
			.fn()
			.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
		const response = await POST(buildEvent());
		const data = await response.json();
		expect(response.status).toBe(504);
		expect(data).toEqual({ error: 'aborted' });
	});

	it('falls back to x-forwarded-for header when getClientAddress is unavailable', async () => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'umami';
		mockEnv.PUBLIC_ANALYTICS_API_HOST = 'https://umami.example.com';
		mockEnv.PUBLIC_ANALYTICS_WEBSITE_ID = 'web-id-1';
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => JSON.stringify({ cache: 'c' })
		});

		const request = new Request('http://localhost/api/events', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-forwarded-for': '203.0.113.7'
			},
			body: baseEnvelope
		});
		const response = await POST({ request });

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledWith(
			'https://umami.example.com/api/send',
			expect.objectContaining({
				headers: expect.objectContaining({
					'X-Forwarded-For': '203.0.113.7'
				})
			})
		);
	});
});
