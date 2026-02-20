/**
 * OTP (OpenTripPlanner) module for trip planning.
 *
 * Provides timezone-safe URL building and parameter handling for OTP API requests.
 * Follows patterns from iOS OTPKit while maintaining JavaScript idioms.
 *
 * @module $lib/otp
 */

// Request creation
export { createTripPlanRequest, createRequestFromTripOptions } from './otpRequest.js';

// URL building
export {
	buildOTPUrl,
	buildOTPParams,
	buildParamsFromOptions,
	formatCoordinates
} from './otpUrlBuilder.js';

// Date/time formatting (timezone-safe)
export {
	parseTimeInput,
	parseDateInput,
	formatTimeForOTP,
	formatDateForOTP,
	combineDateTimeInputs
} from './dateTimeFormatters.js';

// Validators
export {
	validateCoordinates,
	validateTimeInput,
	validateDateInput,
	validateWalkDistance
} from './validators.js';

// GraphQL
export { buildGraphQLQueryBody, mapGraphQLResponse } from './graphql.js';

// Constants
export {
	OTP_DEFAULTS,
	OPTIMIZE_TRANSFER_PENALTY,
	TRANSPORT_MODES,
	COORDINATE_BOUNDS,
	TIME_BOUNDS
} from './constants.js';
