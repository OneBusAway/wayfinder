import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPublicEnv = vi.hoisted(() => ({
	PUBLIC_METRICS_ENABLED: 'true',
	PUBLIC_METRICS_ORGANIZATION: 'Sound Transit'
}));

vi.mock('$app/environment', () => ({
	building: false
}));
vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockPublicEnv;
	}
}));
vi.mock('$lib/serverCache.js', () => ({
	preloadRoutesData: vi.fn().mockResolvedValue(undefined),
	getRoutesCache: vi.fn(),
	getAgenciesCache: vi.fn(),
	getBoundsCache: vi.fn()
}));
vi.mock('$lib/otpServerCache.js', () => ({
	preloadOtpVersion: vi.fn().mockResolvedValue(undefined)
}));

function makeEvent({
	method = 'GET',
	routeId = '/stops/[stopID]',
	pathname = '/stops/1_100'
} = {}) {
	return {
		url: new URL(`http://localhost${pathname}`),
		request: new Request(`http://localhost${pathname}`, { method }),
		route: { id: routeId }
	};
}

describe('hooks.server', () => {
	beforeEach(() => {
		mockPublicEnv.PUBLIC_METRICS_ENABLED = 'true';
		mockPublicEnv.PUBLIC_METRICS_ORGANIZATION = 'Sound Transit';
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);
		vi.stubEnv('PUBLIC_METRICS_ORGANIZATION', mockPublicEnv.PUBLIC_METRICS_ORGANIZATION);
		vi.resetModules();
		delete globalThis.__wayfinderMetrics;
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
		delete globalThis.__wayfinderMetrics;
	});

	it('serves Prometheus metrics with the expected content type when enabled', async () => {
		mockPublicEnv.PUBLIC_METRICS_ENABLED = 'true';
		mockPublicEnv.PUBLIC_METRICS_ORGANIZATION = 'Sound Transit';
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);
		vi.stubEnv('PUBLIC_METRICS_ORGANIZATION', mockPublicEnv.PUBLIC_METRICS_ORGANIZATION);

		const { metricsHandle, metricsEnabled } = await import('../hooks.server.js');
		expect(metricsEnabled).toBe(true);

		const response = await metricsHandle({
			event: makeEvent({ pathname: '/metrics', routeId: '/metrics' }),
			resolve: vi.fn().mockResolvedValue(new Response('should not be used', { status: 200 }))
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/plain; version=0.0.4');
		const metricsText = await response.text();
		expect(metricsText).toContain('service="wayfinder"');
		expect(metricsText).toContain('organization="Sound Transit"');
	});

	it('passes through to resolve when metrics are disabled', async () => {
		mockPublicEnv.PUBLIC_METRICS_ENABLED = 'false';
		mockPublicEnv.PUBLIC_METRICS_ORGANIZATION = 'Sound Transit';
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);
		vi.stubEnv('PUBLIC_METRICS_ORGANIZATION', mockPublicEnv.PUBLIC_METRICS_ORGANIZATION);

		const { metricsHandle } = await import('../hooks.server.js');
		const expected = new Response('ok', { status: 404 });
		const resolve = vi.fn().mockResolvedValue(expected);
		const response = await metricsHandle({ event: makeEvent({ pathname: '/metrics' }), resolve });

		expect(response).toBe(expected);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('falls through when the env is unset, not exactly "true"', async () => {
		delete mockPublicEnv.PUBLIC_METRICS_ENABLED;
		delete mockPublicEnv.PUBLIC_METRICS_ORGANIZATION;
		vi.unstubAllEnvs();

		const { metricsHandle } = await import('../hooks.server.js');
		const expected = new Response('not found', { status: 404 });
		const resolve = vi.fn().mockResolvedValue(expected);
		const response = await metricsHandle({ event: makeEvent({ pathname: '/metrics' }), resolve });

		expect(response).toBe(expected);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('does not record /metrics scrapes in the HTTP histogram', async () => {
		mockPublicEnv.PUBLIC_METRICS_ENABLED = 'true';
		mockPublicEnv.PUBLIC_METRICS_ORGANIZATION = 'Sound Transit';
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);
		vi.stubEnv('PUBLIC_METRICS_ORGANIZATION', mockPublicEnv.PUBLIC_METRICS_ORGANIZATION);

		const { metricsHandle } = await import('../hooks.server.js');
		const { registry } = await import('$lib/server/metrics.js');
		const resolve = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
		const before = await registry.metrics();
		expect(before).not.toMatch(/uri="\/metrics"/);

		const response = await metricsHandle({
			event: makeEvent({ pathname: '/metrics', routeId: '/metrics' }),
			resolve
		});

		expect(response.status).toBe(200);
		const after = await registry.metrics();
		expect(after).not.toMatch(/uri="\/metrics"/);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('records unmatched paths as uri="unmatched"', async () => {
		mockPublicEnv.PUBLIC_METRICS_ENABLED = 'true';
		mockPublicEnv.PUBLIC_METRICS_ORGANIZATION = 'Sound Transit';
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);
		vi.stubEnv('PUBLIC_METRICS_ORGANIZATION', mockPublicEnv.PUBLIC_METRICS_ORGANIZATION);

		const { metricsHandle } = await import('../hooks.server.js');
		const { registry } = await import('$lib/server/metrics.js');
		const resolve = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
		await metricsHandle({
			event: makeEvent({ pathname: '/random/path', routeId: null }),
			resolve
		});

		const text = await registry.metrics();
		expect(text).toMatch(/uri="unmatched"/);
		expect(text).toMatch(/status="404"/);
	});

	it('records the route template, status, and default labels for each request', async () => {
		mockPublicEnv.PUBLIC_METRICS_ENABLED = 'true';
		mockPublicEnv.PUBLIC_METRICS_ORGANIZATION = 'Sound Transit';
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);
		vi.stubEnv('PUBLIC_METRICS_ORGANIZATION', mockPublicEnv.PUBLIC_METRICS_ORGANIZATION);

		const { metricsHandle } = await import('../hooks.server.js');
		const { registry } = await import('$lib/server/metrics.js');
		const resolve = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
		const result = await metricsHandle({ event: makeEvent({ pathname: '/stops/1_100' }), resolve });

		expect(result.status).toBe(200);
		const text = await registry.metrics();
		expect(text).toContain('service="wayfinder"');
		expect(text).toContain('organization="Sound Transit"');
		expect(text).toContain('uri="/stops/[stopID]"');
		expect(text).toMatch(
			/http_server_requests_seconds_count\{.*method="GET".*uri="\/stops\/\[stopID\]".*status="200".*\}/
		);
	});

	it('throws during startup when enabled without an organization', async () => {
		mockPublicEnv.PUBLIC_METRICS_ENABLED = 'true';
		mockPublicEnv.PUBLIC_METRICS_ORGANIZATION = '   ';
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);
		vi.stubEnv('PUBLIC_METRICS_ORGANIZATION', mockPublicEnv.PUBLIC_METRICS_ORGANIZATION);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(import('../hooks.server.js')).rejects.toThrow(/PUBLIC_METRICS_ORGANIZATION/);
		errorSpy.mockRestore();
	});
});
