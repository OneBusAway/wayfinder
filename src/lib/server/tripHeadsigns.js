import oba from '$lib/obaSdk';

// Per-process cache: keep only headsigns, not the multi-megabyte route schedules.
// A service day's schedule is static; expiry also allows feed corrections through.
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cache = new Map();

async function fetchTripHeadsigns(routeId, date) {
	const response = await oba.scheduleForRoute.retrieve(routeId, { date });
	const trips = response?.data?.references?.trips;
	if (response?.code !== 200 || !Array.isArray(trips)) {
		throw new Error('Invalid schedule-for-route response');
	}

	return new Map(
		trips.flatMap((trip) =>
			trip?.id && typeof trip.tripHeadsign === 'string' && trip.tripHeadsign.trim()
				? [[trip.id, trip.tripHeadsign.trim()]]
				: []
		)
	);
}

/**
 * Reuse route headsigns for the explicit YYYY-MM-DD service date used by the
 * stop request. The caller resolves undated requests in the region's timezone.
 */
export function getTripHeadsigns(routeId, date) {
	const key = JSON.stringify([routeId, date]);
	const now = Date.now();
	for (const [cacheKey, entry] of cache) {
		if (entry.expiresAt <= now) cache.delete(cacheKey);
	}
	const cached = cache.get(key);
	if (cached) {
		cache.delete(key);
		cache.set(key, cached);
		return cached.promise;
	}

	while (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
	const entry = { expiresAt: now + CACHE_TTL, promise: null };
	// Cache the promise too, so simultaneous requests for nearby stops share work.
	entry.promise = fetchTripHeadsigns(routeId, date).catch((error) => {
		if (cache.get(key) === entry) cache.delete(key);
		throw error;
	});
	cache.set(key, entry);
	return entry.promise;
}
