import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	DEFAULT_METRICS_PORT,
	metricsContentType,
	recordHttpRequest,
	renderMetrics,
	resolveMetricsPort
} from '$lib/metrics/registry.js';

describe('resolveMetricsPort', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns the default port for undefined, null, and empty values', () => {
		expect(resolveMetricsPort(undefined)).toBe(DEFAULT_METRICS_PORT);
		expect(resolveMetricsPort(null)).toBe(DEFAULT_METRICS_PORT);
		expect(resolveMetricsPort('')).toBe(DEFAULT_METRICS_PORT);
		expect(resolveMetricsPort('   ')).toBe(DEFAULT_METRICS_PORT);
	});

	it('defaults to 9119, matching the Twilio app', () => {
		expect(DEFAULT_METRICS_PORT).toBe(9119);
	});

	it('accepts a valid port', () => {
		expect(resolveMetricsPort('9200')).toBe(9200);
		expect(resolveMetricsPort(' 1 ')).toBe(1);
		expect(resolveMetricsPort('65535')).toBe(65535);
	});

	it('warns and falls back to the default for invalid values', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(resolveMetricsPort('not-a-port')).toBe(DEFAULT_METRICS_PORT);
		expect(resolveMetricsPort('0')).toBe(DEFAULT_METRICS_PORT);
		expect(resolveMetricsPort('65536')).toBe(DEFAULT_METRICS_PORT);
		expect(resolveMetricsPort('12.5')).toBe(DEFAULT_METRICS_PORT);
		expect(warn).toHaveBeenCalledTimes(4);
	});
});

describe('metrics registry', () => {
	it('exposes the Prometheus text exposition content type', () => {
		expect(metricsContentType).toContain('text/plain');
	});

	it('records HTTP requests into the counter and histogram', async () => {
		recordHttpRequest({
			method: 'GET',
			route: '/stops/[stopID]',
			status: 200,
			durationSeconds: 0.123
		});

		const text = await renderMetrics();
		expect(text).toContain(
			'http_requests_total{method="GET",route="/stops/[stopID]",status="200"} 1'
		);
		expect(text).toContain(
			'http_request_duration_seconds_count{method="GET",route="/stops/[stopID]"} 1'
		);
		expect(text).toMatch(/http_request_duration_seconds_bucket\{le="0\.25",method="GET"/);
	});

	it('includes Node.js default metrics', async () => {
		const text = await renderMetrics();
		expect(text).toContain('process_cpu_user_seconds_total');
		expect(text).toContain('nodejs_eventloop_lag_seconds');
		expect(text).toContain('process_resident_memory_bytes');
	});

	it('includes system-level gauges for dashboard CPU/memory panels', async () => {
		const text = await renderMetrics();
		expect(text).toMatch(/system_cpu_load_average_1m \d/);
		expect(text).toMatch(/system_memory_total_bytes \d/);
		expect(text).toMatch(/system_memory_free_bytes \d/);
	});
});
