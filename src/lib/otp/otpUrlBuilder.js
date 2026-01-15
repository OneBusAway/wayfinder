/**
 * OTP URL building utilities.
 * These are pure functions with no side effects - fully testable.
 * Following iOS OTPKit pattern of nonisolated URL building.
 */

import { OTP_DEFAULTS } from './constants.js';

/**
 * Format coordinates for OTP API: "lat,lng" with 4 decimal places.
 * Matches iOS OTPKit pattern for coordinate formatting.
 *
 * @param {Object} coords - Coordinate object
 * @param {number} coords.lat - Latitude
 * @param {number} coords.lng - Longitude
 * @returns {string} Formatted coordinates, e.g., "47.6062,-122.3321"
 */
export function formatCoordinates(coords) {
	const precision = OTP_DEFAULTS.coordinatePrecision;
	return `${coords.lat.toFixed(precision)},${coords.lng.toFixed(precision)}`;
}

/**
 * Build URLSearchParams from a trip plan request object.
 *
 * @param {Object} request - Trip plan request with OTP parameters
 * @param {string} request.fromPlace - Origin coordinates (formatted)
 * @param {string} request.toPlace - Destination coordinates (formatted)
 * @param {string} request.time - Time in OTP format (h:mm AM/PM)
 * @param {string} request.date - Date in OTP format (MM-DD-YYYY)
 * @param {string} request.mode - Transport modes
 * @param {boolean} request.arriveBy - Arrive by time flag
 * @param {number} request.maxWalkDistance - Max walk distance in meters
 * @param {boolean} request.wheelchair - Wheelchair accessible flag
 * @param {boolean} request.showIntermediateStops - Show stops flag
 * @param {number} request.transferPenalty - Transfer penalty value
 * @returns {URLSearchParams}
 */
export function buildOTPParams(request) {
	const params = new URLSearchParams({
		fromPlace: request.fromPlace,
		toPlace: request.toPlace,
		time: request.time,
		date: request.date,
		mode: request.mode,
		arriveBy: String(request.arriveBy),
		maxWalkDistance: String(request.maxWalkDistance),
		wheelchair: String(request.wheelchair),
		showIntermediateStops: String(request.showIntermediateStops),
		transferPenalty: String(request.transferPenalty)
	});

	return params;
}

/**
 * Build complete OTP API URL from base URL and request.
 *
 * @param {string} baseUrl - OTP server base URL
 * @param {Object} request - Trip plan request object
 * @returns {string} Full OTP API URL
 */
export function buildOTPUrl(baseUrl, request) {
	// Normalize base URL (remove trailing slash if present)
	const normalizedBase = baseUrl.replace(/\/$/, '');

	const params = buildOTPParams(request);

	return `${normalizedBase}/routers/default/plan?${params}`;
}

/**
 * Build URLSearchParams from raw frontend options.
 * This is a bridge function for the existing frontend code pattern.
 *
 * @param {Object} from - Origin coordinates {lat, lng}
 * @param {Object} to - Destination coordinates {lat, lng}
 * @param {Object} options - Trip options
 * @param {string} options.time - Time in OTP format (h:mm AM/PM)
 * @param {string} options.date - Date in OTP format (MM-DD-YYYY)
 * @param {boolean} [options.wheelchair=false]
 * @param {number} [options.maxWalkDistance=4828]
 * @param {boolean} [options.arriveBy=false]
 * @param {number} [options.transferPenalty=0]
 * @returns {URLSearchParams}
 */
export function buildParamsFromOptions(from, to, options) {
	return buildOTPParams({
		fromPlace: formatCoordinates(from),
		toPlace: formatCoordinates(to),
		time: options.time,
		date: options.date,
		mode: options.mode ?? OTP_DEFAULTS.mode,
		arriveBy: options.arriveBy ?? OTP_DEFAULTS.arriveBy,
		maxWalkDistance: options.maxWalkDistance ?? OTP_DEFAULTS.maxWalkDistance,
		wheelchair: options.wheelchair ?? OTP_DEFAULTS.wheelchair,
		showIntermediateStops: options.showIntermediateStops ?? OTP_DEFAULTS.showIntermediateStops,
		transferPenalty: options.transferPenalty ?? OTP_DEFAULTS.transferPenalty
	});
}
