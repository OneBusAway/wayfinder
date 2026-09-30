import { parseServiceEntry, parseServiceList } from '$lib/onDemand/models.js';

/**
 * Browser-side on-demand state shared by the zones layer, the stop card and the
 * detail sheet. `support` flips to 'unsupported' on the first 501 from a proxy;
 * from then on no surface renders and no request is made for the session.
 */
export const onDemandState = $state({
	/** @type {'unknown' | 'supported' | 'unsupported'} */
	support: 'unknown',
	/** @type {import('./models.js').OnDemandService | null} */
	highlighted: null
});

export const CACHE_TTL_MS = 10 * 60 * 1000;

// Which cached geometry levels can answer a request for each level.
const SATISFIES = { none: ['none', 'simplified'], simplified: ['simplified'], full: ['full'] };

const viewportCache = new Map();
const serviceCache = new Map();
const inFlight = new Map();

function readCache(cache, key) {
	const hit = cache.get(key);
	if (!hit) return undefined;
	if (Date.now() - hit.at > CACHE_TTL_MS) {
		cache.delete(key);
		return undefined;
	}
	return hit.value;
}

function writeCache(cache, key, value) {
	cache.set(key, { at: Date.now(), value });
}

function shared(key, request) {
	if (!inFlight.has(key)) {
		inFlight.set(
			key,
			request().finally(() => inFlight.delete(key))
		);
	}
	return inFlight.get(key);
}

/** @returns {Promise<{ kind: 'ok', body: any } | { kind: 'notFound' } | { kind: 'unsupported' } | { kind: 'error' }>} */
async function request(url) {
	let response;
	try {
		response = await fetch(url);
	} catch {
		return { kind: 'error' };
	}
	if (response.status === 501) {
		onDemandState.support = 'unsupported';
		return { kind: 'unsupported' };
	}
	if (response.status === 404) return { kind: 'notFound' };
	if (!response.ok) return { kind: 'error' };
	try {
		const body = await response.json();
		onDemandState.support = 'supported';
		return { kind: 'ok', body };
	} catch {
		return { kind: 'error' };
	}
}

/**
 * @param {{ lat: number, lon: number, latSpan: number, lonSpan: number }} viewport
 */
export async function fetchServicesForViewport({ lat, lon, latSpan, lonSpan }) {
	if (onDemandState.support === 'unsupported') return null;
	const key = [lat, lon, latSpan, lonSpan].map((value) => value.toFixed(2)).join(',');
	const cached = readCache(viewportCache, key);
	if (cached) return cached;

	const query = new URLSearchParams({
		lat: String(lat),
		lon: String(lon),
		latSpan: String(latSpan),
		lonSpan: String(lonSpan),
		geometryDetail: 'simplified'
	});
	const result = await shared(`viewport:${key}`, () =>
		request(`/api/oba/ondemand/services-for-location?${query}`)
	);
	if (result.kind !== 'ok') return null;
	const parsed = parseServiceList(result.body);
	writeCache(viewportCache, key, parsed);
	return parsed;
}

/**
 * @param {string} id
 * @param {'none' | 'simplified' | 'full'} geometryDetail
 */
export async function fetchService(id, geometryDetail) {
	if (onDemandState.support === 'unsupported') return null;
	for (const level of SATISFIES[geometryDetail]) {
		const cached = readCache(serviceCache, `${id}|${level}`);
		if (cached) return cached;
	}

	const url = `/api/oba/ondemand/service/${encodeURIComponent(id)}?geometryDetail=${geometryDetail}`;
	const result = await shared(`service:${id}|${geometryDetail}`, () => request(url));
	if (result.kind === 'notFound') return { notFound: true };
	if (result.kind !== 'ok') return null;
	const parsed = parseServiceEntry(result.body);
	writeCache(serviceCache, `${id}|${geometryDetail}`, parsed);
	return parsed;
}

/**
 * Primes the cache from a server-rendered load so the sheet doesn't refetch.
 * @param {string} id
 * @param {'none' | 'simplified' | 'full'} geometryDetail
 * @param {any} body - service/{id} envelope
 */
export function seedService(id, geometryDetail, body) {
	writeCache(serviceCache, `${id}|${geometryDetail}`, parseServiceEntry(body));
}

/** @param {import('./models.js').OnDemandService | null} service */
export function setHighlightedService(service) {
	onDemandState.highlighted = service;
}

export function resetOnDemandStateForTesting() {
	onDemandState.support = 'unknown';
	onDemandState.highlighted = null;
	viewportCache.clear();
	serviceCache.clear();
	inFlight.clear();
}
