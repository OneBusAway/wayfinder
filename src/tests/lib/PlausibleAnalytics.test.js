import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PUBLIC_ANALYTICS_DOMAIN: 'api.example.com',
	PUBLIC_ANALYTICS_ENABLED: 'true',
	PUBLIC_ANALYTICS_API_HOST: 'https://api.example.com'
}));

vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockEnv;
	}
}));

import analytics, { PlausibleAnalytics } from '$lib/Analytics/PlausibleAnalytics.js';

describe('PlausibleAnalytics', () => {
	beforeEach(() => {
		mockEnv.PUBLIC_ANALYTICS_DOMAIN = 'api.example.com';
		mockEnv.PUBLIC_ANALYTICS_ENABLED = 'true';
		mockEnv.PUBLIC_ANALYTICS_API_HOST = 'https://api.example.com';
		analytics.defaultProperties = {};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('falls back to dynamic env when no env is provided', () => {
			const instance = new PlausibleAnalytics();
			expect(instance.isEnabled()).toBe(true);
		});

		it('uses custom env when provided', () => {
			const customEnv = {
				PUBLIC_ANALYTICS_ENABLED: 'true',
				PUBLIC_ANALYTICS_DOMAIN: 'custom.example.com',
				PUBLIC_ANALYTICS_API_HOST: 'https://custom.example.com'
			};
			const instance = new PlausibleAnalytics(customEnv);
			expect(instance.isEnabled()).toBe(true);
			expect(instance.getDomain()).toBe('custom.example.com');
			expect(instance.getEventUrl()).toBe('https://custom.example.com/api/event');
		});

		it('reports disabled when custom env has analytics off', () => {
			const customEnv = {
				PUBLIC_ANALYTICS_ENABLED: 'false',
				PUBLIC_ANALYTICS_DOMAIN: 'custom.example.com',
				PUBLIC_ANALYTICS_API_HOST: 'https://custom.example.com'
			};
			const instance = new PlausibleAnalytics(customEnv);
			expect(instance.isEnabled()).toBe(false);
		});
	});

	describe('getEventUrl', () => {
		it('builds the upstream event URL from API host', () => {
			expect(analytics.getEventUrl()).toBe('https://api.example.com/api/event');
		});

		it('reflects changes to the env API host', () => {
			mockEnv.PUBLIC_ANALYTICS_API_HOST = 'https://other.example.com';
			expect(analytics.getEventUrl()).toBe('https://other.example.com/api/event');
		});
	});

	describe('getDomain', () => {
		it('returns the analytics domain from env', () => {
			expect(analytics.getDomain()).toBe('api.example.com');
		});

		it('reflects changes to the env domain', () => {
			mockEnv.PUBLIC_ANALYTICS_DOMAIN = 'other.example.com';
			expect(analytics.getDomain()).toBe('other.example.com');
		});
	});

	describe('forwardEvent', () => {
		it('returns analytics disabled when not enabled', async () => {
			mockEnv.PUBLIC_ANALYTICS_ENABLED = 'false';

			const result = await analytics.forwardEvent({
				name: 'pageview',
				url: '/test'
			});
			expect(result).toEqual({ status: 'analytics disabled' });
		});

		it('sends event to upstream API and returns parsed response', async () => {
			const upstreamResponse = { status: 'ok' };
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => JSON.stringify(upstreamResponse)
			});

			const result = await analytics.forwardEvent({
				name: 'pageview',
				url: '/test',
				referrer: 'https://example.com',
				props: { id: '1' }
			});

			expect(result).toEqual(upstreamResponse);
			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.example.com/api/event',
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: expect.stringContaining('"domain":"api.example.com"')
				})
			);
		});

		it('returns plain text response as status when not valid JSON', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => 'ok'
			});

			const result = await analytics.forwardEvent({ name: 'pageview', url: '/test' });
			expect(result).toEqual({ status: 'ok' });
		});

		it('throws with upstream status when API responds with error', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 502,
				statusText: 'Bad Gateway'
			});

			try {
				await analytics.forwardEvent({ name: 'pageview', url: '/test' });
				expect.unreachable('should have thrown');
			} catch (error) {
				expect(error.message).toBe('Error sending event: Bad Gateway');
				expect(error.upstreamStatus).toBe(502);
			}
		});

		it('throws when name is missing', async () => {
			await expect(analytics.forwardEvent({ url: '/test' })).rejects.toThrow(
				'forwardEvent requires name and url'
			);
		});

		it('throws when url is missing', async () => {
			await expect(analytics.forwardEvent({ name: 'pageview' })).rejects.toThrow(
				'forwardEvent requires name and url'
			);
		});

		it('throws when fetch fails', async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

			await expect(analytics.forwardEvent({ name: 'pageview', url: '/test' })).rejects.toThrow(
				'Network failure'
			);
		});
	});

	it('sends an event via fetch and returns JSON result (reportPageView)', async () => {
		const mockResponse = { status: 'ok' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify(mockResponse),
			json: async () => mockResponse
		});

		const result = await analytics.reportPageView('/test');
		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			'/api/events',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			})
		);
	});

	it('skips sending an event when analytics is disabled', async () => {
		mockEnv.PUBLIC_ANALYTICS_ENABLED = 'false';
		const consoleSpy = vi.spyOn(console, 'debug').mockImplementation();

		const result = await analytics.reportPageView('/test');
		expect(consoleSpy).toHaveBeenCalledWith('Analytics disabled: skipping event');
		expect(result).toBeUndefined();
		consoleSpy.mockRestore();
	});

	it('skips sending when analytics is enabled but domain is empty', async () => {
		mockEnv.PUBLIC_ANALYTICS_DOMAIN = '';
		const consoleSpy = vi.spyOn(console, 'debug').mockImplementation();

		const result = await analytics.reportPageView('/test');
		expect(consoleSpy).toHaveBeenCalledWith('Analytics disabled: skipping event');
		expect(result).toBeUndefined();
		consoleSpy.mockRestore();
	});

	it('skips sending when analytics is enabled but API host is empty', async () => {
		mockEnv.PUBLIC_ANALYTICS_API_HOST = '';
		const consoleSpy = vi.spyOn(console, 'debug').mockImplementation();

		const result = await analytics.reportPageView('/test');
		expect(consoleSpy).toHaveBeenCalledWith('Analytics disabled: skipping event');
		expect(result).toBeUndefined();
		consoleSpy.mockRestore();
	});

	it('skips sending when domain is undefined', async () => {
		delete mockEnv.PUBLIC_ANALYTICS_DOMAIN;
		const consoleSpy = vi.spyOn(console, 'debug').mockImplementation();

		const result = await analytics.reportPageView('/test');
		expect(consoleSpy).toHaveBeenCalledWith('Analytics disabled: skipping event');
		expect(result).toBeUndefined();
		consoleSpy.mockRestore();
	});

	it('skips sending when API host is undefined', async () => {
		delete mockEnv.PUBLIC_ANALYTICS_API_HOST;
		const consoleSpy = vi.spyOn(console, 'debug').mockImplementation();

		const result = await analytics.reportPageView('/test');
		expect(consoleSpy).toHaveBeenCalledWith('Analytics disabled: skipping event');
		expect(result).toBeUndefined();
		consoleSpy.mockRestore();
	});

	it('throws an error if fetch response is not ok (reportPageView)', async () => {
		const errorText = 'failure';
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			statusText: 'Server Error',
			text: async () => errorText
		});

		await expect(analytics.reportPageView('/test')).rejects.toThrow(
			`Error sending event: Server Error. ${errorText}`
		);
	});

	it('sends a search query event (reportSearchQuery)', async () => {
		const query = 'svelte testing';
		const expectedResponse = { status: 'ok' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify(expectedResponse),
			json: async () => expectedResponse
		});

		const result = await analytics.reportSearchQuery(query);
		expect(global.fetch).toHaveBeenCalledWith(
			'/api/events',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: expect.stringContaining(`"query":"${query}"`)
			})
		);
		expect(result).toEqual(expectedResponse);
	});

	it('sends a stop viewed event (reportStopViewed)', async () => {
		const stopId = 123;
		const stopDistance = 'User Distance: 00050-00100m';
		const expectedResponse = { status: 'ok' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify(expectedResponse),
			json: async () => expectedResponse
		});

		const result = await analytics.reportStopViewed(stopId, stopDistance);
		expect(global.fetch).toHaveBeenCalledWith(
			'/api/events',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: expect.stringContaining(`"id":${stopId}`)
			})
		);
		expect(global.fetch).toHaveBeenCalledWith(
			'/api/events',
			expect.objectContaining({
				body: expect.stringContaining(`"distance":"${stopDistance}"`)
			})
		);
		expect(result).toEqual(expectedResponse);
	});

	it('sends a route clicked event (reportRouteClicked)', async () => {
		const routeId = '544';
		const expectedResponse = { status: 'ok' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify(expectedResponse),
			json: async () => expectedResponse
		});

		const result = await analytics.reportRouteClicked(routeId);
		expect(global.fetch).toHaveBeenCalledWith(
			'/api/events',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: expect.stringContaining(`"id":"${routeId}"`)
			})
		);
		expect(result).toEqual(expectedResponse);
	});

	it('sends an arrival clicked event (reportArrivalClicked)', async () => {
		const action = 'arrivalAction';
		const expectedResponse = { status: 'ok' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify(expectedResponse),
			json: async () => expectedResponse
		});

		const result = await analytics.reportArrivalClicked(action);
		expect(global.fetch).toHaveBeenCalledWith(
			'/api/events',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: expect.stringContaining(`"item_id":"${action}"`)
			})
		);
		expect(result).toEqual(expectedResponse);
	});

	it('merges default properties when building props', async () => {
		analytics.defaultProperties = { id: '1_00' };
		const expectedResponse = { status: 'ok' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify(expectedResponse),
			json: async () => expectedResponse
		});

		await analytics.reportPageView('/test');
		expect(global.fetch).toHaveBeenCalledWith(
			'/api/events',
			expect.objectContaining({
				body: expect.stringContaining(`"id":"1_00"`)
			})
		);
	});
});
