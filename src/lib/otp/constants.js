/**
 * OTP (OpenTripPlanner) constants and default values.
 * These match the existing server defaults and iOS OTPKit patterns.
 */

// Default parameter values for trip planning requests
export const OTP_DEFAULTS = {
	mode: 'TRANSIT,WALK',
	arriveBy: false,
	maxWalkDistance: 4828, // ~3 miles in meters (current server default)
	wheelchair: false,
	showIntermediateStops: true,
	transferPenalty: 0,
	coordinatePrecision: 4 // iOS pattern: 4 decimal places for coordinates
};

// Maps optimization preference to OTP transfer penalty value
export const OPTIMIZE_TRANSFER_PENALTY = {
	fastest: 0,
	fewestTransfers: 600
};

// Transport mode mappings (following iOS OTPKit pattern)
// Maps user-facing modes to OTP API mode strings
export const TRANSPORT_MODES = {
	transit: ['TRANSIT', 'WALK'],
	bus: ['BUS', 'WALK'],
	rail: ['RAIL', 'WALK'],
	walk: ['WALK'],
	bicycle: ['BICYCLE'],
	bicycleRent: ['BICYCLE_RENT', 'WALK']
};

// Coordinate validation bounds
export const COORDINATE_BOUNDS = {
	lat: { min: -90, max: 90 },
	lng: { min: -180, max: 180 }
};

// Time validation bounds (24-hour format)
export const TIME_BOUNDS = {
	hours: { min: 0, max: 23 },
	minutes: { min: 0, max: 59 }
};
