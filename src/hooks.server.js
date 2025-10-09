import { preloadRoutesData } from '$lib/serverCache.js';

export async function handle({ event, resolve }) {
	await preloadRoutesData();
	return resolve(event);
}

export { getRoutesCache, getAgenciesCache, getBoundsCache } from '$lib/serverCache.js';
