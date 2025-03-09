import oba from '$lib/obaSdk.js';

let routesCache = null;
let cacheTimestamp = null;
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // Cache expires every 5 minutes

/**
 * Fetches routes data from the OneBusAway (OBA) SDK.
 * Retrieves all agencies and their corresponding routes.
 * Caches the results to optimize performance.
 */
async function fetchRoutesData() {
	try {
		const agenciesResponse = await oba.agenciesWithCoverage.list();
		const agencies = agenciesResponse.data.list;

		// Fetch routes for each agency concurrently
		const routesPromises = agencies.map(async (agency) => {
			const routesResponse = await oba.routesForAgency.list(agency.agencyId);
			const routes = routesResponse.data.list;
			const references = routesResponse.data.references;

			// Create a map of agency references for quick lookups
			const agencyReferenceMap = new Map(references.agencies.map((agency) => [agency.id, agency]));

			// Attach agency info to each route
			routes.forEach((route) => {
				route.agencyInfo = agencyReferenceMap.get(route.agencyId);
			});

			return routes;
		});

		// Wait for all routes to be fetched and flatten the results
		const routes = (await Promise.all(routesPromises)).flat();

		// Update cache and timestamp
		routesCache = routes;
		cacheTimestamp = Date.now();

		return routes;
	} catch (error) {
		console.error('Error fetching routes:', error);
		return null;
	}
}

/**
 * Ensures the routes data is loaded and cached.
 * Refreshes the cache if it is expired.
 */
async function preloadRoutesData() {
	const isCacheExpired = !cacheTimestamp || (Date.now() - cacheTimestamp > CACHE_EXPIRATION_MS);
	if (!routesCache || isCacheExpired) {
		await fetchRoutesData();
	}
}

/**
 * Middleware hook that ensures routes data is available before handling the request.
 */
export async function handle({ event, resolve }) {
	await preloadRoutesData();
	return resolve(event);
}

/**
 * Returns the cached routes data.
 */
export function getRoutesCache() {
	return routesCache;
}
