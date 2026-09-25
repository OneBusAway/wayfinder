import { browser } from '$app/environment';
import { calcDistanceBetweenTwoPoints } from '$lib/mathUtils';

const ANALYTICS_ID_KEY = 'wayfinder.analyticsId';

/**
 * crypto.randomUUID only exists in secure contexts (HTTPS/localhost); a Wayfinder served over
 * plain HTTP still has crypto.getRandomValues, so build a v4 UUID from that instead.
 * @returns {string}
 */
function randomUUID() {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Returns a persisted anonymous per-browser analytics id, generating and storing one on
 * first use. Umami derives its visitor/session id from IP + User-Agent + a monthly salt
 * unless the event payload carries an `id`; forwarding a stable client-generated id keeps
 * a returning visitor's session stable across IP changes (e.g. switching networks) instead
 * of minting a "new visitor" on every IP change and inflating MAU. (True through Umami v3.2;
 * v3.3+ hash the IP back in, so the shared server must stay pinned to <= v3.2.)
 *
 * Never throws: storage can be unavailable (private browsing, blocked storage, SSR) — in
 * that case this returns undefined and the envelope simply omits `id`.
 * @returns {string|undefined}
 */
export function getAnalyticsId() {
	if (!browser) return undefined;
	try {
		const existing = localStorage.getItem(ANALYTICS_ID_KEY);
		if (existing) return existing;
		const id = randomUUID();
		localStorage.setItem(ANALYTICS_ID_KEY, id);
		return id;
	} catch (e) {
		console.warn('Failed to read/persist analytics id:', e);
		return undefined;
	}
}

/**
 * Converts a distance (in km) to a category string.
 * @param {number} distanceKm - The distance in kilometers.
 * @returns {string} - The distance category string.
 */
export function getDistanceCategory(distanceKm) {
	const distanceM = distanceKm * 1000;
	if (distanceM < 50) {
		return 'User Distance: 00000-00050m';
	} else if (distanceM < 100) {
		return 'User Distance: 00050-00100m';
	} else if (distanceM < 200) {
		return 'User Distance: 00100-00200m';
	} else if (distanceM < 400) {
		return 'User Distance: 00200-00400m';
	} else if (distanceM < 800) {
		return 'User Distance: 00400-00800m';
	} else if (distanceM < 1600) {
		return 'User Distance: 00800-01600m';
	} else if (distanceM < 3200) {
		return 'User Distance: 01600-03200m';
	} else {
		return 'User Distance: 03200-INFINITY';
	}
}

/**
 * Calculates the distance between the user location and the stop,
 * then returns the corresponding distance category for analytics.
 *
 * @param {number} userLat - User latitude.
 * @param {number} userLng - User longitude.
 * @param {number} stopLat - Stop latitude.
 * @param {number} stopLng - Stop longitude.
 * @returns {string} - The analytics distance category.
 */
export function analyticsDistanceToStop(userLat, userLng, stopLat, stopLng) {
	const distanceKm = calcDistanceBetweenTwoPoints(userLat, userLng, stopLat, stopLng);
	return getDistanceCategory(distanceKm);
}
