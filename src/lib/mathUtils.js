/**
 * Converts from OBA orientation to direction.
 *
 * From OBA REST API docs for trip status (open)
 * : "orientation - ...0º is east, 90º is north, 180º is west, and 270º is south."
 *
 * @param orientation 0º is east, 90º is north, 180º is west, and 270º is south
 * @return direction, where 0º is north, 90º is east, 180º is south, and 270º is west
 */

export function toDirection(orientation) {
	if (!Number.isFinite(orientation)) {
		return null;
	}
	let direction = (-orientation + 90) % 360;
	if (direction < 0) {
		direction += 360;
	}

	return Math.abs(direction);
}

function isValidCoordinate(lat, lon) {
	return (
		Number.isFinite(lat) &&
		Number.isFinite(lon) &&
		lat >= -90 &&
		lat <= 90 &&
		lon >= -180 &&
		lon <= 180
	);
}

/**
 * calculate midpoint of a list of stops so we can show the route on the map
 * @param {Array<{lat: number, lon: number}>} stops - List of stops
 * @returns {{lat: number, lon: number} | null} Midpoint with {lat, lon}, or null if there are no stops or invalid coordinates
 */
export function calculateMidpoint(stops) {
	// return null if stops is null or empty
	if (!Array.isArray(stops) || stops.length === 0) {
		return null;
	}

	let totalLat = 0;
	let totalLon = 0;

	for (const stop of stops) {
		const lat = stop?.lat;
		const lon = stop?.lon;

		if (!isValidCoordinate(lat, lon)) {
			return null;
		}

		totalLat += lat;
		totalLon += lon;
	}

	const midpointLat = totalLat / stops.length;
	const midpointLon = totalLon / stops.length;

	return { lat: midpointLat, lon: midpointLon };
}

/**
 * Calculates the distance between two geographical points using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of the first location in degrees.
 * @param {number} lon1 - Longitude of the first location in degrees.
 * @param {number} lat2 - Latitude of the second location in degrees.
 * @param {number} lon2 - Longitude of the second location in degrees.
 * @returns {number} The distance between the two points in kilometers.
 */
export function calcDistanceBetweenTwoPoints(lat1, lon1, lat2, lon2) {
	const earthRadiusKm = 6371; // Earth's radius in kilometers
	const deltaLat = toRadians(lat2 - lat1);
	const deltaLon = toRadians(lon2 - lon1);
	const radLat1 = toRadians(lat1);
	const radLat2 = toRadians(lat2);

	const a =
		Math.sin(deltaLat / 2) ** 2 +
		Math.sin(deltaLon / 2) ** 2 * Math.cos(radLat1) * Math.cos(radLat2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distanceKm = earthRadiusKm * c;
	return distanceKm;
}

/**
 * Converts degrees to radians.
 *
 * @param {number} degrees - The degrees to convert.
 * @returns {number} The angle in radians.
 */
function toRadians(degrees) {
	return (degrees * Math.PI) / 180;
}

/**
 * Calculate bounding box from OBA agencies-with-coverage response.
 * Latitude and longitude of 0 are valid (equator and prime meridian). An agency
 * is skipped only when a field is missing or not a finite number.
 * @param {Array<{lat: number, lon: number, latSpan: number, lonSpan: number}> | null | undefined} agencies
 * @returns {{north: number, south: number, east: number, west: number} | null} Bounds, or null if no agency has finite coordinates
 */
export function calculateBoundsFromAgencies(agencies) {
	if (!Array.isArray(agencies) || agencies.length === 0) {
		return null;
	}

	let north = -Infinity;
	let south = Infinity;
	let east = -Infinity;
	let west = Infinity;
	let included = 0;

	for (const agency of agencies) {
		const lat = agency?.lat;
		const lon = agency?.lon;
		const latSpan = agency?.latSpan;
		const lonSpan = agency?.lonSpan;

		if (
			!Number.isFinite(lat) ||
			!Number.isFinite(lon) ||
			!Number.isFinite(latSpan) ||
			!Number.isFinite(lonSpan)
		) {
			continue;
		}

		const halfLatSpan = latSpan / 2;
		const halfLonSpan = lonSpan / 2;

		north = Math.max(north, lat + halfLatSpan);
		south = Math.min(south, lat - halfLatSpan);
		east = Math.max(east, lon + halfLonSpan);
		west = Math.min(west, lon - halfLonSpan);
		included += 1;
	}

	if (included === 0) {
		return null;
	}

	return { north, south, east, west };
}

/**
 * Calculate radius in meters to cover a bounding box
 * Uses Haversine formula to find diagonal distance from center to corner
 * @param {Object} bounds - Bounds object {north, south, east, west}
 * @returns {number} Radius in meters
 */
export function calculateRadiusFromBounds(bounds) {
	const centerLat = (bounds.north + bounds.south) / 2;
	const centerLng = (bounds.east + bounds.west) / 2;

	const R = 6371000; // Earth's radius in meters
	const dLat = ((bounds.north - centerLat) * Math.PI) / 180;
	const dLng = ((bounds.east - centerLng) * Math.PI) / 180;

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((centerLat * Math.PI) / 180) *
			Math.cos((bounds.north * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c;

	return distance;
}
