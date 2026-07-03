import os from 'node:os';
import client from 'prom-client';

/**
 * Prometheus instrumentation for Wayfinder. Metric names, labels, and the
 * default port match the OneBusAway Twilio app so both services can share
 * dashboards and alert rules.
 */

export const DEFAULT_METRICS_PORT = 9119;

function createMetrics() {
	const registry = new client.Registry();
	client.collectDefaultMetrics({ register: registry });

	const httpRequests = new client.Counter({
		name: 'http_requests_total',
		help: 'Total HTTP requests by method, route template, and status code.',
		labelNames: ['method', 'route', 'status'],
		registers: [registry]
	});

	const httpDuration = new client.Histogram({
		name: 'http_request_duration_seconds',
		help: 'HTTP request latency by method and route template.',
		labelNames: ['method', 'route'],
		registers: [registry]
	});

	new client.Gauge({
		name: 'system_cpu_load_average_1m',
		help: 'System load average over the last minute.',
		registers: [registry],
		collect() {
			this.set(os.loadavg()[0]);
		}
	});

	new client.Gauge({
		name: 'system_memory_total_bytes',
		help: 'Total system memory in bytes.',
		registers: [registry],
		collect() {
			this.set(os.totalmem());
		}
	});

	new client.Gauge({
		name: 'system_memory_free_bytes',
		help: 'Free system memory in bytes.',
		registers: [registry],
		collect() {
			this.set(os.freemem());
		}
	});

	return { registry, httpRequests, httpDuration };
}

// Stored on globalThis so dev-mode HMR re-evaluation neither double-registers
// metrics nor orphans the registry held by the running metrics server.
const metrics = (globalThis.__wayfinderMetrics ??= createMetrics());

export const metricsContentType = metrics.registry.contentType;

export function recordHttpRequest({ method, route, status, durationSeconds }) {
	metrics.httpRequests.inc({ method, route, status });
	metrics.httpDuration.observe({ method, route }, durationSeconds);
}

export function renderMetrics() {
	return metrics.registry.metrics();
}

/**
 * Validates a METRICS_PORT value with the same semantics as the Twilio app:
 * unset/empty silently uses the default; anything that is not an integer in
 * [1, 65535] logs a warning and uses the default.
 */
export function resolveMetricsPort(raw) {
	const trimmed = (raw ?? '').trim();
	if (trimmed === '') {
		return DEFAULT_METRICS_PORT;
	}
	const parsed = Number(trimmed);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
		console.warn(`Invalid METRICS_PORT="${raw}", using default ${DEFAULT_METRICS_PORT}`);
		return DEFAULT_METRICS_PORT;
	}
	return parsed;
}
