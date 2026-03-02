import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PUBLIC_ANALYTICS_ENABLED: 'true',
	PUBLIC_ANALYTICS_DOMAIN: 'example.com',
	PUBLIC_ANALYTICS_API_HOST: 'https://analytics.example.com'
}));

vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockEnv;
	}
}));

import { POST } from '../../routes/api/events/+server.js';

describe('POST /api/events', () => {
	beforeEach(() => {
		mockEnv.PUBLIC_ANALYTICS_ENABLED = 'true';
		mockEnv.PUBLIC_ANALYTICS_DOMAIN = 'example.com';
		mockEnv.PUBLIC_ANALYTICS_API_HOST = 'https://analytics.example.com';
		vi.restoreAllMocks();
	});

	it('returns analytics disabled when PUBLIC_ANALYTICS_ENABLED is not true', async () => {
		mockEnv.PUBLIC_ANALYTICS_ENABLED = 'false';

		const request = new Request('http://localhost/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'pageview', url: '/test' })
		});

		const response = await POST({ request });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ status: 'analytics disabled' });
	});

	it('returns analytics disabled when PUBLIC_ANALYTICS_API_HOST is empty', async () => {
		mockEnv.PUBLIC_ANALYTICS_API_HOST = '';

		const request = new Request('http://localhost/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'pageview', url: '/test' })
		});

		const response = await POST({ request });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ status: 'analytics disabled' });
	});

	it('returns analytics disabled when PUBLIC_ANALYTICS_DOMAIN is empty', async () => {
		mockEnv.PUBLIC_ANALYTICS_DOMAIN = '';

		const request = new Request('http://localhost/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'pageview', url: '/test' })
		});

		const response = await POST({ request });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ status: 'analytics disabled' });
	});

	it('proxies event to analytics API when enabled', async () => {
		const upstreamResponse = { status: 'ok' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => JSON.stringify(upstreamResponse)
		});

		const request = new Request('http://localhost/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'pageview', url: '/test', props: { id: '1' } })
		});

		const response = await POST({ request });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual(upstreamResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			'https://analytics.example.com/api/event',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: expect.stringContaining('"domain":"example.com"')
			})
		);
	});

	it('forwards upstream status code when API responds with error', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 502,
			statusText: 'Bad Gateway'
		});

		const request = new Request('http://localhost/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'pageview', url: '/test' })
		});

		const response = await POST({ request });
		const data = await response.json();

		expect(response.status).toBe(502);
		expect(data).toEqual({ error: 'Error sending event: Bad Gateway' });
	});

	it('returns 500 when request body is not valid JSON', async () => {
		const request = new Request('http://localhost/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not json'
		});

		const response = await POST({ request });
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data).toHaveProperty('error');
	});

	it('returns 500 when fetch throws', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

		const request = new Request('http://localhost/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'pageview', url: '/test' })
		});

		const response = await POST({ request });
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data).toEqual({ error: 'Network failure' });
	});
});
