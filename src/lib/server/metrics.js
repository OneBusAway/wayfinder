import { building } from '$app/environment';
import { env } from '$env/dynamic/public';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

export const metricsEnabled = env.PUBLIC_METRICS_ENABLED === 'true';

const organizationValue = (env.PUBLIC_METRICS_ORGANIZATION ?? '').trim();

if (!building && metricsEnabled && !organizationValue) {
	const message =
		'PUBLIC_METRICS_ORGANIZATION must be set when PUBLIC_METRICS_ENABLED=true. Set it to the exact OBACloud organization name.';
	console.error(message);
	throw new Error(message);
}

const defaultLabels = {
	service: 'wayfinder',
	organization: organizationValue || 'unknown'
};

const registry = (() => {
	if (!metricsEnabled) return null;

	const existing = globalThis.__wayfinderAppMetrics;
	if (existing) {
		return existing.registry;
	}

	const register = new Registry();
	register.setDefaultLabels(defaultLabels);
	collectDefaultMetrics({ register });

	const histogram = new Histogram({
		name: 'http_server_requests_seconds',
		help: 'Histogram of HTTP request latencies in seconds.',
		labelNames: ['method', 'uri', 'status'],
		buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
		registers: [register]
	});

	const metrics = { registry: register, histogram };
	globalThis.__wayfinderAppMetrics = metrics;
	return register;
})();

export { registry };

export function observeRequest({ method, uri, status, seconds }) {
	if (!metricsEnabled || !globalThis.__wayfinderAppMetrics) return;
	const labelUri = uri || 'unmatched';
	const labelMethod = method || 'GET';
	const labelStatus = String(status ?? '0');
	globalThis.__wayfinderAppMetrics.histogram.observe(
		{ method: labelMethod, uri: labelUri, status: labelStatus },
		seconds
	);
}
