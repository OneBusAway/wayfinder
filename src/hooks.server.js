import { preloadRoutesData } from '$lib/serverCache.js';
import { preloadOtpVersion } from '$lib/otpServerCache.js';

export async function handle({ event, resolve }) {
	Promise.all([preloadRoutesData(), preloadOtpVersion()]);
	return resolve(event);
}

export { getRoutesCache, getAgenciesCache, getBoundsCache } from '$lib/serverCache.js';
