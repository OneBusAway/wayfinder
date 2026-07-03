import 'temporal-polyfill/global';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { preloadRoutesData } from '$lib/serverCache.js';
import { preloadOtpVersion } from '$lib/otpServerCache.js';
import { recordHttpRequest, resolveMetricsPort } from '$lib/metrics/registry.js';
import { startMetricsServer } from '$lib/metrics/server.js';

if (!building) {
	startMetricsServer(resolveMetricsPort(env.METRICS_PORT));
}

export async function handle({ event, resolve }) {
	await Promise.all([preloadRoutesData(), preloadOtpVersion()]);

	const startTime = performance.now();
	let status = 500;
	try {
		const response = await resolve(event);
		status = response.status;
		return response;
	} finally {
		recordHttpRequest({
			method: event.request.method,
			route: event.route.id ?? '(unmatched)',
			status,
			durationSeconds: (performance.now() - startTime) / 1000
		});
	}
}

export { getRoutesCache, getAgenciesCache, getBoundsCache } from '$lib/serverCache.js';
