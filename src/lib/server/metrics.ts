import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

interface RequestMetrics {
	histogram: Histogram<'method' | 'uri' | 'status'>;
	organization: string;
	registry: Registry;
}

export function createRequestMetrics({ organization }: { organization: string }): RequestMetrics {
	const registry = new Registry();
	registry.setDefaultLabels({
		service: 'wayfinder',
		organization
	});
	collectDefaultMetrics({ register: registry });

	const histogram = new Histogram({
		name: 'http_server_requests_seconds',
		help: 'Histogram of HTTP request latencies in seconds.',
		labelNames: ['method', 'uri', 'status'],
		buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
		registers: [registry]
	});

	return { histogram, organization, registry };
}
