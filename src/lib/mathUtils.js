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
	let direction = (-orientation + 90) % 360;
	if (direction < 0) {
		direction += 360;
	}

	return direction === 0 ? 0 : direction;
}

/**
 * calculate midpoint of a list of stops so we can show the route on the map
 * @param  list of stops
 * @returns
 */
export function calculateMidpoint(stops) {
	let totalLat = 0;
	let totalLon = 0;

	for (const stop of stops) {
		totalLat += stop.lat;
		totalLon += stop.lon;
	}

	const midpointLat = totalLat / stops.length;
	const midpointLon = totalLon / stops.length;

	return { lat: midpointLat, lng: midpointLon };
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
 * Calculate bounding box from OBA agencies-with-coverage response
 * @param {Array} agencies - List of agencies from OBA API with {lat, lon, latSpan, lonSpan}
 * @returns {Object} Bounds object {north, south, east, west} or null if no valid agencies
 */
export function calculateBoundsFromAgencies(agencies) {
	if (!agencies || agencies.length === 0) {
		return null;
	}

	let north = -Infinity;
	let south = Infinity;
	let east = -Infinity;
	let west = Infinity;

	agencies.forEach((agency) => {
		if (agency.lat && agency.lon && agency.latSpan && agency.lonSpan) {
			const halfLatSpan = agency.latSpan / 2;
			const halfLonSpan = agency.lonSpan / 2;

			north = Math.max(north, agency.lat + halfLatSpan);
			south = Math.min(south, agency.lat - halfLatSpan);
			east = Math.max(east, agency.lon + halfLonSpan);
			west = Math.min(west, agency.lon - halfLonSpan);
		}
	});

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
