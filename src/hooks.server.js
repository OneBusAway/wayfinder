import 'temporal-polyfill/global';
import { sequence } from '@sveltejs/kit/hooks';
import { preloadRoutesData } from '$lib/serverCache.js';
import { preloadOtpVersion } from '$lib/otpServerCache.js';
import { metricsEnabled, observeRequest, registry } from '$lib/server/metrics.js';

export async function metricsHandle({ event, resolve }) {
	if (!metricsEnabled) {
		return resolve(event);
	}

	if (event.url.pathname === '/metrics') {
		return new Response(await registry.metrics(), {
			headers: {
				'Content-Type': registry.contentType
			}
		});
	}

	const start = process.hrtime.bigint();
	const response = await resolve(event);
	const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
	observeRequest({
		method: event.request.method,
		uri: event.route?.id ?? 'unmatched',
		status: response.status,
		seconds: durationSeconds
	});
	return response;
}

export async function appHandle({ event, resolve }) {
	await Promise.all([preloadRoutesData(), preloadOtpVersion()]);
	return resolve(event);
}

export const handle = sequence(metricsHandle, appHandle);
export { metricsEnabled, registry };

export { getRoutesCache, getAgenciesCache, getBoundsCache } from '$lib/serverCache.js';
