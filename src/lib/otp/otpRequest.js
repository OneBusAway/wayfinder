/**
 * OTP trip plan request object creation.
 * Creates structured request objects from various input formats.
 */

import { OTP_DEFAULTS, OPTIMIZE_TRANSFER_PENALTY } from './constants.js';
import { formatCoordinates } from './otpUrlBuilder.js';
import {
	formatTimeForOTP,
	formatDateForOTP,
	parseTimeInput,
	parseDateInput
} from './dateTimeFormatters.js';

/**
 * Creates a structured OTP trip plan request object.
 *
 * @param {Object} options - Trip plan options
 * @param {Object} options.from - Origin coordinates {lat, lng}
 * @param {Object} options.to - Destination coordinates {lat, lng}
 * @param {string} [options.departureType='now'] - 'now' | 'departAt' | 'arriveBy'
 * @param {string} [options.time] - Time in HH:mm format (24-hour)
 * @param {string} [options.date] - Date in YYYY-MM-DD format
 * @param {string} [options.mode] - Transport modes
 * @param {number} [options.maxWalkDistance] - Max walk distance in meters
 * @param {boolean} [options.wheelchair] - Wheelchair accessible routes
 * @param {string} [options.optimize='fastest'] - 'fastest' | 'fewestTransfers'
 * @returns {Object} Structured request object ready for buildOTPParams
 */
export function createTripPlanRequest(options) {
	const {
		from,
		to,
		departureType = 'now',
		time,
		date,
		mode = OTP_DEFAULTS.mode,
		maxWalkDistance = OTP_DEFAULTS.maxWalkDistance,
		wheelchair = OTP_DEFAULTS.wheelchair,
		optimize = 'fastest'
	} = options;

	// Determine time and date
	let otpTime, otpDate;

	if (departureType === 'now' || (!time && !date)) {
		// "Leave Now" mode - use current time
		const now = new Date();
		otpTime = formatTimeForOTP(now);
		otpDate = formatDateForOTP(now);
	} else {
		// Scheduled departure/arrival
		// Parse user inputs (HH:mm, YYYY-MM-DD) to OTP formats
		otpTime = time ? parseTimeInput(time) : formatTimeForOTP(new Date());
		otpDate = date ? parseDateInput(date) : formatDateForOTP(new Date());

		// Fallback to current time if parsing fails
		if (!otpTime) {
			otpTime = formatTimeForOTP(new Date());
		}
		if (!otpDate) {
			otpDate = formatDateForOTP(new Date());
		}
	}

	// Determine arriveBy based on departure type
	const arriveBy = departureType === 'arriveBy';

	// Map optimization preference to transfer penalty
	const transferPenalty = OPTIMIZE_TRANSFER_PENALTY[optimize] ?? 0;

	return {
		fromPlace: formatCoordinates(from),
		toPlace: formatCoordinates(to),
		time: otpTime,
		date: otpDate,
		mode,
		arriveBy,
		maxWalkDistance,
		wheelchair,
		showIntermediateStops: OTP_DEFAULTS.showIntermediateStops,
		transferPenalty
	};
}

/**
 * Create a trip plan request from the tripOptions store format.
 * This bridges the existing frontend store structure to the OTP request format.
 *
 * @param {Object} from - Origin coordinates {lat, lng}
 * @param {Object} to - Destination coordinates {lat, lng}
 * @param {Object} tripOptions - Options from tripOptionsStore
 * @param {string} tripOptions.departureType - 'now' | 'departAt' | 'arriveBy'
 * @param {string|null} tripOptions.departureTime - Time in HH:mm format
 * @param {string|null} tripOptions.departureDate - Date in YYYY-MM-DD format
 * @param {boolean} tripOptions.wheelchair - Wheelchair accessible
 * @param {string} tripOptions.optimize - 'fastest' | 'fewestTransfers'
 * @param {number} tripOptions.maxWalkDistance - Max walk distance in meters
 * @returns {Object} Structured request object ready for buildOTPParams
 */
export function createRequestFromTripOptions(from, to, tripOptions) {
	return createTripPlanRequest({
		from,
		to,
		departureType: tripOptions.departureType,
		time: tripOptions.departureTime,
		date: tripOptions.departureDate,
		wheelchair: tripOptions.wheelchair,
		maxWalkDistance: tripOptions.maxWalkDistance,
		optimize: tripOptions.optimize
	});
}
