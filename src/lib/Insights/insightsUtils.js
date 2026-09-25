import { browser } from '$app/environment';
import { calcDistanceBetweenTwoPoints } from '$lib/mathUtils';

const ANALYTICS_ID_KEY = 'wayfinder.analyticsId';

/**
 * Returns a persisted anonymous per-browser analytics id, generating and storing one on
 * first use. Umami derives its visitor/session id from IP + User-Agent + a monthly salt
 * unless the event payload carries an `id`; forwarding a stable client-generated id keeps
 * a returning visitor's session stable across IP changes (e.g. switching networks) instead
 * of minting a "new visitor" on every IP change and inflating MAU.
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
		const id = crypto.randomUUID();
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
