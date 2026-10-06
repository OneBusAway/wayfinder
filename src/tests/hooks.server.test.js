import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequestMetrics } from '$lib/server/metrics';

const mockRecordHttpRequest = vi.fn();
const mockStartMetricsServer = vi.fn();
let mockBuilding = false;
const mockPublicEnv = vi.hoisted(() => ({
	PUBLIC_METRICS_ENABLED: 'true',
	PUBLIC_METRICS_ORGANIZATION: 'Sound Transit'
}));

vi.mock('$app/environment', () => ({
	get building() {
		return mockBuilding;
	}
}));
vi.mock('$env/dynamic/private', () => ({ env: { METRICS_PORT: '9200' } }));
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
vi.mock('$lib/metrics/registry.js', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		recordHttpRequest: mockRecordHttpRequest
	};
});
vi.mock('$lib/metrics/server.js', () => ({
	startMetricsServer: mockStartMetricsServer
}));

function makeEvent({ method = 'GET', routeId = '/stops/[stopID]' } = {}) {
	return {
		request: new Request('http://localhost/stops/1_100', { method }),
		url: new URL('http://localhost/stops/1_100'),
		route: { id: routeId }
	};
}

function makeMetricsEvent({
	method = 'GET',
	routeId = '/stops/[stopID]',
	pathname = '/stops/1_100'
} = {}) {
	return {
		...makeEvent({ method, routeId }),
		url: new URL(`http://localhost${pathname}`),
		request: new Request(`http://localhost${pathname}`, { method })
	};
}

describe('createRequestMetrics', () => {
	it('creates a request histogram with the organization default label', async () => {
		const metrics = createRequestMetrics({ organization: 'Sound Transit' });
		metrics.histogram.observe({ method: 'GET', uri: '/health', status: '200' }, 0.2);

		expect(metrics.organization).toBe('Sound Transit');
		expect(await metrics.registry.metrics()).toMatch(
			/http_server_requests_seconds_count\{.*service="wayfinder".*organization="Sound Transit".*uri="\/health".*\} 1/
		);
	});
});

describe('hooks.server', () => {
	beforeEach(() => {
		mockBuilding = false;
		mockPublicEnv.PUBLIC_METRICS_ENABLED = 'true';
		mockPublicEnv.PUBLIC_METRICS_ORGANIZATION = 'Sound Transit';
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);
		vi.stubEnv('PUBLIC_METRICS_ORGANIZATION', mockPublicEnv.PUBLIC_METRICS_ORGANIZATION);
		vi.resetModules();
		delete globalThis.__wayfinderAppMetrics;
		delete globalThis.__wayfinderMetrics;
	});

	it('starts the metrics server on the configured port', async () => {
		vi.resetModules();
		mockBuilding = false;
		await import('../hooks.server.js');
		expect(mockStartMetricsServer).toHaveBeenCalledWith(9200);
	});

	it('does not start the metrics server during the build', async () => {
		vi.resetModules();
		mockBuilding = true;
		await import('../hooks.server.js');
		expect(mockStartMetricsServer).not.toHaveBeenCalled();
	});

	it('records method, route template, status, and duration for each request', async () => {
		const { handle } = await import('../hooks.server.js');
		const response = new Response('ok', { status: 200 });
		const resolve = vi.fn().mockResolvedValue(response);

		const result = await handle({ event: makeEvent(), resolve });

		expect(result).toBe(response);
		expect(mockRecordHttpRequest).toHaveBeenCalledWith({
			method: 'GET',
			route: '/stops/[stopID]',
			status: 200,
			durationSeconds: expect.any(Number)
		});
	});

	it('labels unmatched routes as (unmatched)', async () => {
		const { handle } = await import('../hooks.server.js');
		const resolve = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));

		await handle({ event: makeEvent({ routeId: null }), resolve });

		expect(mockRecordHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({ route: '(unmatched)', status: 404 })
		);
	});

	it('records a 500 and rethrows when resolve fails', async () => {
		const { handle } = await import('../hooks.server.js');
		const boom = new Error('boom');
		const resolve = vi.fn().mockRejectedValue(boom);

		await expect(handle({ event: makeEvent(), resolve })).rejects.toThrow(boom);
		expect(mockRecordHttpRequest).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
	});

	it('serves Prometheus metrics with the expected content type when enabled', async () => {
		mockPublicEnv.PUBLIC_METRICS_ENABLED = 'true';
		mockPublicEnv.PUBLIC_METRICS_ORGANIZATION = 'Sound Transit';
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);
		vi.stubEnv('PUBLIC_METRICS_ORGANIZATION', mockPublicEnv.PUBLIC_METRICS_ORGANIZATION);

		const { metricsHandle, metricsEnabled } = await import('../hooks.server.js');
		expect(metricsEnabled).toBe(true);

		const response = await metricsHandle({
			event: makeMetricsEvent({ pathname: '/metrics', routeId: '/metrics' }),
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
		const response = await metricsHandle({
			event: makeMetricsEvent({ pathname: '/metrics' }),
			resolve
		});

		expect(response).toBe(expected);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('does not enable metrics for values other than exactly "true"', async () => {
		mockPublicEnv.PUBLIC_METRICS_ENABLED = ' TRUE ';
		vi.stubEnv('PUBLIC_METRICS_ENABLED', mockPublicEnv.PUBLIC_METRICS_ENABLED);

		const { metricsEnabled, metricsHandle } = await import('../hooks.server.js');
		const expected = new Response('not found', { status: 404 });
		const resolve = vi.fn().mockResolvedValue(expected);

		expect(metricsEnabled).toBe(false);
		expect(
			await metricsHandle({ event: makeMetricsEvent({ pathname: '/metrics' }), resolve })
		).toBe(expected);
		expect(resolve).toHaveBeenCalledOnce();
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

		const { metricsHandle, registry } = await import('../hooks.server.js');
		const resolve = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
		const before = await registry.metrics();
		expect(before).not.toMatch(/uri="\/metrics"/);

		const response = await metricsHandle({
			event: makeMetricsEvent({ pathname: '/metrics', routeId: '/metrics' }),
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

		const { metricsHandle, registry } = await import('../hooks.server.js');
		const resolve = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
		await metricsHandle({
			event: makeMetricsEvent({ pathname: '/random/path', routeId: null }),
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

		const { metricsHandle, registry } = await import('../hooks.server.js');
		const resolve = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
		const result = await metricsHandle({
			event: makeMetricsEvent({ pathname: '/stops/1_100' }),
			resolve
		});

		expect(result.status).toBe(200);
		const text = await registry.metrics();
		expect(text).toContain('service="wayfinder"');
		expect(text).toContain('organization="Sound Transit"');
		expect(text).toContain('uri="/stops/[stopID]"');
		expect(text).toMatch(
			/http_server_requests_seconds_count\{.*method="GET".*uri="\/stops\/\[stopID\]".*status="200".*\}/
		);
	});

	it('records a 500 request when resolve rejects and rethrows the original error', async () => {
		const { metricsHandle, registry } = await import('../hooks.server.js');
		const error = new Error('resolve failed');
		const resolve = vi.fn().mockRejectedValue(error);

		await expect(metricsHandle({ event: makeEvent(), resolve })).rejects.toBe(error);

		const text = await registry.metrics();
		const samples = text
			.split('\n')
			.filter(
				(line) =>
					line.startsWith('http_server_requests_seconds_count{') && line.includes('status="500"')
			);
		expect(samples).toHaveLength(1);
		expect(samples[0]).toMatch(/} 1$/);
	});

	it('keeps the upstream metrics global separate from request metrics', async () => {
		const upstreamMetrics = { registry: {}, httpRequests: {}, httpDuration: {} };
		globalThis.__wayfinderMetrics = upstreamMetrics;

		try {
			const { metricsHandle, registry } = await import('../hooks.server.js');
			const resolve = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

			const response = await metricsHandle({ event: makeEvent(), resolve });

			expect(response.status).toBe(200);
			expect(resolve).toHaveBeenCalledTimes(1);
			const text = await registry.metrics();
			expect(text).toMatch(
				/http_server_requests_seconds_count\{.*method="GET".*uri="\/stops\/\[stopID\]".*status="200".*\} 1/
			);
			expect(globalThis.__wayfinderMetrics).toBe(upstreamMetrics);
			expect(upstreamMetrics).toEqual({ registry: {}, httpRequests: {}, httpDuration: {} });
		} finally {
			delete globalThis.__wayfinderMetrics;
		}
	});

	it('records requests when both metrics registries are loaded', async () => {
		const internalMetrics = await vi.importActual('$lib/metrics/registry.js');
		mockRecordHttpRequest.mockImplementation(internalMetrics.recordHttpRequest);

		const { metricsHandle, registry } = await import('../hooks.server.js');
		const resolve = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

		const response = await metricsHandle({ event: makeEvent(), resolve });

		expect(response.status).toBe(200);
		expect(mockRecordHttpRequest).toHaveBeenCalledOnce();
		expect(await internalMetrics.renderMetrics()).toMatch(
			/http_requests_total\{.*route="\/stops\/\[stopID\]".*status="200".*\} 1/
		);
		expect(await registry.metrics()).toMatch(
			/http_server_requests_seconds_count\{.*uri="\/stops\/\[stopID\]".*status="200".*\} 1/
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
