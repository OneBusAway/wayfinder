import oba from '$lib/obaSdk.js';
import { calculateBoundsFromAgencies } from '$lib/mathUtils.js';
import { getAgencyFilter } from '$lib/agencyFilter.js';

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

/** @type {boolean} */
let timedOut = false;

// Cache TTL: 1 hour
const CACHE_TTL = 3600000;

// Maximum wait for OBA during cold start before unblocking requests
const FETCH_TIMEOUT = 15_000;

// After a cold-start timeout, minimum gap before retrying
const ERROR_RETRY_DELAY = 30_000;

/** @type {number | null} */
let lastErrorTime = null;

/**
 * Races a promise against a timeout. The timeout timer is always cleared
 * regardless of which side wins, preventing timer leaks with fake timers.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, label) {
	let timeoutId;
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
	});
	return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

/**
 * Fetches routes data from the OBA API
 * @returns {Promise<Route[] | null>}
 */
async function fetchRoutesData() {
	try {
		const agenciesResponse = await oba.agenciesWithCoverage.list();
		const allAgencies = agenciesResponse.data.list;
		const agencyFilter = getAgencyFilter();
		const agencies = agencyFilter
			? allAgencies.filter((a) => agencyFilter.has(a.agencyId))
			: allAgencies;

		if (agencyFilter && agencies.length === 0) {
			console.error(
				'PRIVATE_OBA_AGENCY_FILTER is configured but matches no available agencies. All data will be empty.',
				{
					configured: [...agencyFilter],
					available: allAgencies.map((a) => a.agencyId)
				}
			);
		}

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
		console.error('Error fetching routes:', {
			error: error.message,
			stack: error.stack,
			timestamp: new Date().toISOString()
		});
		return null;
	}
}

/**
 * Preloads routes data into cache with TTL support.
 *
 * Stale-while-revalidate: when cached data exists but is past TTL, a background
 * refresh is kicked off and the caller returns immediately so HTTP requests are
 * not blocked. On a cold start (no data at all) the caller waits up to
 * FETCH_TIMEOUT milliseconds before proceeding without data, preventing an
 * indefinitely-hanging handle hook when the OBA server is slow or unavailable.
 *
 * @param {boolean} [forceRefresh=false] - Force refresh even if cache is valid
 * @returns {Promise<void>}
 */
export async function preloadRoutesData(forceRefresh = false) {
	const now = Date.now();
	const isStale = cacheTimestamp !== null && now - cacheTimestamp > CACHE_TTL;

	// Fast path: cache is warm
	if (routesCache && !isStale && !forceRefresh) {
		return;
	}

	// Error cooldown: after a cold-start timeout don't immediately hammer OBA again.
	// Only applies when there is no cached data to serve.
	if (!routesCache && lastErrorTime !== null && now - lastErrorTime < ERROR_RETRY_DELAY) {
		console.debug('[serverCache] Within error cooldown — serving without cached data');
		return;
	}

	// A refresh is already in flight
	if (initializationPromise) {
		// Stale-while-revalidate or already timed out: serve existing data without blocking
		if (timedOut || (routesCache && !forceRefresh)) {
			return;
		}
		// Cold start or forced refresh: wait for the in-flight fetch
		await initializationPromise;
		return;
	}

	// Start a new refresh
	cacheState = 'loading';
	timedOut = false;
	const promise = fetchRoutesData()
		.then((routes) => {
			routesCache = routes;
			cacheTimestamp = routes ? Date.now() : null;
			cacheState = routes ? 'loaded' : 'error';
			if (routes) lastErrorTime = null;
			return routes;
		})
		.catch((error) => {
			console.error('Error in preloadRoutesData:', error);
			cacheState = 'error';
			return null;
		})
		.finally(() => {
			initializationPromise = null;
			timedOut = false;
		});

	initializationPromise = promise;

	// Stale-while-revalidate: background refresh started, return immediately
	if (routesCache && !forceRefresh) {
		return;
	}

	// Cold start: wait for initial data, but cap the wait so the handle hook
	// cannot block all requests indefinitely when OBA is slow or unreachable.
	try {
		await withTimeout(promise, FETCH_TIMEOUT, 'OBA routes fetch');
	} catch {
		console.warn(
			'[serverCache] Routes fetch timed out — requests will proceed without cached data'
		);
		cacheState = 'error';
		lastErrorTime = Date.now();
		timedOut = true;
		// Do NOT clear initializationPromise — the in-flight fetch continues in the
		// background. Subsequent callers see timedOut=true and return immediately,
		// preventing a second parallel fetch. When the background fetch eventually
		// resolves it will populate the cache and reset timedOut via .finally().
	}
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
	lastErrorTime = null;
	timedOut = false;
}
