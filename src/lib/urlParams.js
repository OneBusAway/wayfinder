import { calcDistanceBetweenTwoPoints } from './mathUtils';

/**
 * Maximum allowed distance (in kilometers) from region center for URL coordinates
 */
const MAX_DISTANCE_FROM_REGION_KM = 200;

/**
 * Parses and validates latitude and longitude from URL search parameters.
 * Both parameters must be present and numeric, and the coordinates must be
 * within 200km of the configured region center.
 *
 * @param {URLSearchParams} searchParams - The URL search parameters
 * @param {number} regionCenterLat - The region center latitude
 * @param {number} regionCenterLng - The region center longitude
 * @returns {{ lat: number, lng: number } | null} The validated coordinates or null if invalid
 */
export function parseInitialCoordinates(searchParams, regionCenterLat, regionCenterLng) {
	const latParam = searchParams.get('lat');
	const lngParam = searchParams.get('lng');

	// Both parameters must be present
	if (latParam === null || lngParam === null) {
		return null;
	}

	// Parse as numbers
	const lat = parseFloat(latParam);
	const lng = parseFloat(lngParam);

	// Both must be valid finite numbers
	if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
		return null;
	}

	// Validate latitude range (-90 to 90)
	if (lat < -90 || lat > 90) {
		return null;
	}

	// Validate longitude range (-180 to 180)
	if (lng < -180 || lng > 180) {
		return null;
	}

	// Check distance from region center
	const distanceKm = calcDistanceBetweenTwoPoints(lat, lng, regionCenterLat, regionCenterLng);

	if (distanceKm > MAX_DISTANCE_FROM_REGION_KM) {
		return null;
	}

	return { lat, lng };
}

/**
 * Removes lat and lng parameters from the current URL without triggering navigation.
 * Uses history.replaceState to clean the URL after coordinates have been applied.
 */
export function cleanUrlParams() {
	if (typeof window === 'undefined') {
		return;
	}

	const url = new URL(window.location.href);
	const hadParams = url.searchParams.has('lat') || url.searchParams.has('lng');

	if (hadParams) {
		url.searchParams.delete('lat');
		url.searchParams.delete('lng');

		// Use replaceState to avoid adding to browser history
		window.history.replaceState({}, '', url.toString());
	}
}
