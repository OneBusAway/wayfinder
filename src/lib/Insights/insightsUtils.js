import { calcDistanceBetweenTwoPoints } from '$lib/mathUtils';

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
