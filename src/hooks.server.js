import 'temporal-polyfill/global';
import { building } from '$app/environment';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { preloadRoutesData } from '$lib/serverCache.js';
import { preloadOtpVersion } from '$lib/otpServerCache.js';
import { recordHttpRequest, resolveMetricsPort } from '$lib/metrics/registry.js';
import { startMetricsServer } from '$lib/metrics/server.js';
import { metricsEnabled, observeRequest, registry } from '$lib/server/metrics.js';

if (!building) {
	startMetricsServer(resolveMetricsPort(env.METRICS_PORT));
}

export async function metricsHandle({ event, resolve }) {
	if (metricsEnabled && event.url.pathname === '/metrics') {
		return new Response(await registry.metrics(), {
			headers: {
				'Content-Type': registry.contentType
			}
		});
	}

	const start = process.hrtime.bigint();
	let status = 500;
	try {
		const response = await resolve(event);
		status = response.status;
		return response;
	} finally {
		const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
		recordHttpRequest({
			method: event.request.method,
			route: event.route.id ?? '(unmatched)',
			status,
			durationSeconds
		});
		observeRequest({
			method: event.request.method,
			uri: event.route?.id ?? 'unmatched',
			status,
			seconds: durationSeconds
		});
	}
}

export async function appHandle({ event, resolve }) {
	await Promise.all([preloadRoutesData(), preloadOtpVersion()]);
	return resolve(event);
}

export const handle = sequence(metricsHandle, appHandle);
export { metricsEnabled, registry };

export { getRoutesCache, getAgenciesCache, getBoundsCache } from '$lib/serverCache.js';
