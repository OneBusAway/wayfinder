import 'temporal-polyfill/global';
import { preloadRoutesData } from '$lib/serverCache.js';
import { preloadOtpVersion } from '$lib/otpServerCache.js';

let preloaded = false;

export async function handle({ event, resolve }) {
	if (!preloaded) {
		const results = await Promise.allSettled([
			preloadRoutesData(),
			preloadOtpVersion()
		]);

		for (const result of results) {
			if (result.status === 'rejected') {
				console.error(result.reason);
			}
		}

		preloaded = true;
	}

	return resolve(event);
}

export {
	getRoutesCache,
	getAgenciesCache,
	getBoundsCache
} from '$lib/serverCache.js';
