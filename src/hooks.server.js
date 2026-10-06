import 'temporal-polyfill/global';
import { building } from '$app/environment';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { preloadRoutesData } from '$lib/serverCache.js';
import { preloadOtpVersion } from '$lib/otpServerCache.js';
import { recordHttpRequest, resolveMetricsPort } from '$lib/metrics/registry.js';
import { startMetricsServer } from '$lib/metrics/server.js';
import { createRequestMetrics } from '$lib/server/metrics';

export const metricsEnabled = publicEnv.PUBLIC_METRICS_ENABLED === 'true';

let requestMetrics;
if (!building && metricsEnabled) {
	const organization = (publicEnv.PUBLIC_METRICS_ORGANIZATION ?? '').trim();
	if (!organization) {
		const message =
			'PUBLIC_METRICS_ORGANIZATION must be set when PUBLIC_METRICS_ENABLED=true. Set it to the exact OBACloud organization name.';
		console.error(message);
		throw new Error(message);
	}

	const existingMetrics = globalThis.__wayfinderAppMetrics;
	requestMetrics =
		existingMetrics?.organization === organization
			? existingMetrics
			: createRequestMetrics({ organization });
	globalThis.__wayfinderAppMetrics = requestMetrics;
}

export const registry = requestMetrics?.registry ?? null;

if (!building) {
	startMetricsServer(resolveMetricsPort(env.METRICS_PORT));
}

export async function metricsHandle({ event, resolve }) {
	if (requestMetrics && event.url.pathname === '/metrics') {
		return new Response(await requestMetrics.registry.metrics(), {
			headers: {
				'Content-Type': requestMetrics.registry.contentType
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
		if (requestMetrics) {
			requestMetrics.histogram.observe(
				{
					method: event.request.method,
					uri: event.route?.id ?? 'unmatched',
					status: String(status)
				},
				durationSeconds
			);
		}
	}
}

export async function appHandle({ event, resolve }) {
	await Promise.all([preloadRoutesData(), preloadOtpVersion()]);
	return resolve(event);
}

export const handle = sequence(metricsHandle, appHandle);

export { getRoutesCache, getAgenciesCache, getBoundsCache } from '$lib/serverCache.js';
