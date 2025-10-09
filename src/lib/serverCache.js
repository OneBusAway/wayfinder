import oba from '$lib/obaSdk.js';
import { calculateBoundsFromAgencies } from '$lib/mathUtils.js';

/**
 * @typedef {Object} Agency
 * @property {string} agencyId
 * @property {string} name
 * @property {number} lat
 * @property {number} lon
 * @property {number} latSpan
 * @property {number} lonSpan
 */

/**
 * @typedef {Object} Route
 * @property {string} id
 * @property {string} agencyId
 * @property {string} shortName
 * @property {string} longName
 * @property {Object} [agencyInfo]
 */

/**
 * @typedef {Object} Bounds
 * @property {number} north
 * @property {number} south
 * @property {number} east
 * @property {number} west
 */

/**
 * @typedef {'uninitialized' | 'loading' | 'loaded' | 'error'} CacheState
 */

/** @type {Route[] | null} */
let routesCache = null;

/** @type {Agency[] | null} */
let agenciesCache = null;

/** @type {Bounds | null} */
let boundsCache = null;

/** @type {number | null} */
let cacheTimestamp = null;

/** @type {CacheState} */
let cacheState = 'uninitialized';

/** @type {Promise<Route[] | null> | null} */
let initializationPromise = null;

// Cache TTL: 1 hour
const CACHE_TTL = 3600000;

/**
 * Fetches routes data from the OBA API
 * @returns {Promise<Route[] | null>}
 */
async function fetchRoutesData() {
	try {
		const agenciesResponse = await oba.agenciesWithCoverage.list();
		const agencies = agenciesResponse.data.list;

		agenciesCache = agencies;
		boundsCache = calculateBoundsFromAgencies(agencies);

		const routesPromises = agencies.map(async (agency) => {
			const routesResponse = await oba.routesForAgency.list(agency.agencyId);
			const routes = routesResponse.data.list;
			const references = routesResponse.data.references;

			const agencyReferenceMap = new Map(references.agencies.map((agency) => [agency.id, agency]));

			routes.forEach((route) => {
				route.agencyInfo = agencyReferenceMap.get(route.agencyId);
			});

			return routes;
		});

		const routes = await Promise.all(routesPromises);
		return routes.flat();
	} catch (error) {
		console.error('Error fetching routes:', error);
		return null;
	}
}

/**
 * Preloads routes data into cache with TTL support
 * @param {boolean} [forceRefresh=false] - Force refresh even if cache is valid
 * @returns {Promise<void>}
 */
export async function preloadRoutesData(forceRefresh = false) {
	const now = Date.now();
	const isStale = cacheTimestamp && now - cacheTimestamp > CACHE_TTL;

	// If cache is valid and not stale, and we're not forcing refresh, return early
	if (routesCache && !isStale && !forceRefresh) {
		return;
	}

	// If already loading, wait for the existing promise
	if (initializationPromise) {
		await initializationPromise;
		return;
	}

	// Start loading
	cacheState = 'loading';
	initializationPromise = fetchRoutesData()
		.then((routes) => {
			routesCache = routes;
			cacheTimestamp = routes ? now : null;
			cacheState = routes ? 'loaded' : 'error';
			initializationPromise = null;
			return routes;
		})
		.catch((error) => {
			console.error('Error in preloadRoutesData:', error);
			cacheState = 'error';
			initializationPromise = null;
			return null;
		});

	await initializationPromise;
}

/**
 * Gets the cached routes data
 * @returns {Route[] | null}
 */
export function getRoutesCache() {
	return routesCache;
}

/**
 * Gets the cached agencies data
 * @returns {Agency[] | null}
 */
export function getAgenciesCache() {
	return agenciesCache;
}

/**
 * Gets the cached bounds data
 * @returns {Bounds | null}
 */
export function getBoundsCache() {
	return boundsCache;
}

/**
 * Gets the current cache state
 * @returns {CacheState}
 */
export function getCacheState() {
	return cacheState;
}

/**
 * Gets the cache timestamp
 * @returns {number | null}
 */
export function getCacheTimestamp() {
	return cacheTimestamp;
}

/**
 * Clears all cached data (useful for testing and manual refresh)
 * @returns {void}
 */
export function clearCache() {
	routesCache = null;
	agenciesCache = null;
	boundsCache = null;
	cacheTimestamp = null;
	cacheState = 'uninitialized';
	initializationPromise = null;
}
