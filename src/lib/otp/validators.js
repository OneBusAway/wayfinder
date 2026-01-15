/**
 * Validation functions for OTP trip planning parameters.
 * All validators return { valid: boolean, error?: string }
 */

import { COORDINATE_BOUNDS, TIME_BOUNDS } from './constants.js';

/**
 * Validate coordinates are within valid geographic ranges.
 * Latitude: -90 to 90, Longitude: -180 to 180
 *
 * @param {Object} coords - Coordinate object
 * @param {number} coords.lat - Latitude
 * @param {number} coords.lng - Longitude
 * @returns {{valid: boolean, error?: string}}
 */
export function validateCoordinates(coords) {
	if (!coords || typeof coords !== 'object') {
		return { valid: false, error: 'Coordinates must be an object' };
	}

	const { lat, lng } = coords;

	if (lat === undefined || lat === null) {
		return { valid: false, error: 'Latitude is required' };
	}

	if (lng === undefined || lng === null) {
		return { valid: false, error: 'Longitude is required' };
	}

	if (typeof lat !== 'number' || !Number.isFinite(lat)) {
		return { valid: false, error: 'Latitude must be a finite number' };
	}

	if (typeof lng !== 'number' || !Number.isFinite(lng)) {
		return { valid: false, error: 'Longitude must be a finite number' };
	}

	if (lat < COORDINATE_BOUNDS.lat.min || lat > COORDINATE_BOUNDS.lat.max) {
		return {
			valid: false,
			error: `Latitude must be between ${COORDINATE_BOUNDS.lat.min} and ${COORDINATE_BOUNDS.lat.max}`
		};
	}

	if (lng < COORDINATE_BOUNDS.lng.min || lng > COORDINATE_BOUNDS.lng.max) {
		return {
			valid: false,
			error: `Longitude must be between ${COORDINATE_BOUNDS.lng.min} and ${COORDINATE_BOUNDS.lng.max}`
		};
	}

	return { valid: true };
}

/**
 * Validate time string in HH:mm format (24-hour).
 * Hours: 0-23, Minutes: 0-59
 *
 * @param {string} timeString - Time in HH:mm format
 * @returns {{valid: boolean, error?: string}}
 */
export function validateTimeInput(timeString) {
	if (!timeString || typeof timeString !== 'string') {
		return { valid: false, error: 'Time must be a non-empty string' };
	}

	// Must be HH:mm format (not already converted to AM/PM)
	if (timeString.includes(' ')) {
		return { valid: false, error: 'Time must be in HH:mm format (24-hour)' };
	}

	const parts = timeString.split(':');
	if (parts.length !== 2) {
		return { valid: false, error: 'Time must be in HH:mm format' };
	}

	const hours = parseInt(parts[0], 10);
	const minutes = parseInt(parts[1], 10);

	if (isNaN(hours) || isNaN(minutes)) {
		return { valid: false, error: 'Hours and minutes must be numeric' };
	}

	if (hours < TIME_BOUNDS.hours.min || hours > TIME_BOUNDS.hours.max) {
		return {
			valid: false,
			error: `Hours must be between ${TIME_BOUNDS.hours.min} and ${TIME_BOUNDS.hours.max}`
		};
	}

	if (minutes < TIME_BOUNDS.minutes.min || minutes > TIME_BOUNDS.minutes.max) {
		return {
			valid: false,
			error: `Minutes must be between ${TIME_BOUNDS.minutes.min} and ${TIME_BOUNDS.minutes.max}`
		};
	}

	return { valid: true };
}

/**
 * Validate date string in YYYY-MM-DD format.
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {{valid: boolean, error?: string}}
 */
export function validateDateInput(dateString) {
	if (!dateString || typeof dateString !== 'string') {
		return { valid: false, error: 'Date must be a non-empty string' };
	}

	const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		return { valid: false, error: 'Date must be in YYYY-MM-DD format' };
	}

	const [, yearStr, monthStr, dayStr] = match;
	const year = parseInt(yearStr, 10);
	const month = parseInt(monthStr, 10);
	const day = parseInt(dayStr, 10);

	// Basic range validation
	if (month < 1 || month > 12) {
		return { valid: false, error: 'Month must be between 1 and 12' };
	}

	if (day < 1 || day > 31) {
		return { valid: false, error: 'Day must be between 1 and 31' };
	}

	// Reasonable year range for trip planning
	if (year < 2000 || year > 2100) {
		return { valid: false, error: 'Year must be between 2000 and 2100' };
	}

	// Validate actual date exists (handles Feb 30, etc.)
	const testDate = new Date(year, month - 1, day);
	if (
		testDate.getFullYear() !== year ||
		testDate.getMonth() !== month - 1 ||
		testDate.getDate() !== day
	) {
		return { valid: false, error: 'Invalid date' };
	}

	return { valid: true };
}

/**
 * Validate max walk distance is a positive number.
 *
 * @param {number} meters - Walk distance in meters
 * @returns {{valid: boolean, error?: string}}
 */
export function validateWalkDistance(meters) {
	if (meters === undefined || meters === null) {
		return { valid: false, error: 'Walk distance is required' };
	}

	if (typeof meters !== 'number' || !Number.isFinite(meters)) {
		return { valid: false, error: 'Walk distance must be a finite number' };
	}

	if (meters <= 0) {
		return { valid: false, error: 'Walk distance must be positive' };
	}

	return { valid: true };
}
