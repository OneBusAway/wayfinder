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
