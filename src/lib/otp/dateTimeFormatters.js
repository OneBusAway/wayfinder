/**
 * Date and time formatting utilities for OTP trip planning.
 *
 * CRITICAL: These functions are designed to avoid timezone confusion.
 * User inputs from HTML date/time fields are in local time strings.
 * OTP servers expect local transit time.
 * We parse strings directly without creating Date objects to avoid
 * JavaScript's timezone interpretation issues.
 */

/**
 * Parse HTML time input (HH:mm, 24-hour) to OTP format (h:mm AM/PM).
 *
 * Uses direct string parsing to avoid timezone issues.
 * NO Date object is created, so no timezone conversion occurs.
 *
 * @param {string} timeString - Time in "HH:mm" format (24-hour)
 * @returns {string|null} Time in "h:mm AM/PM" format, or null if invalid
 *
 * @example
 * parseTimeInput('14:30')  // Returns '2:30 PM'
 * parseTimeInput('00:00')  // Returns '12:00 AM'
 * parseTimeInput('12:00')  // Returns '12:00 PM'
 * parseTimeInput('09:05')  // Returns '9:05 AM'
 */
export function parseTimeInput(timeString) {
	if (!timeString || typeof timeString !== 'string') {
		return null;
	}

	// If already in AM/PM format, return as-is
	if (timeString.includes(' ')) {
		return timeString;
	}

	// Must have colon separator
	if (!timeString.includes(':')) {
		return null;
	}

	const parts = timeString.split(':');
	if (parts.length !== 2) {
		return null;
	}

	const hours = parseInt(parts[0], 10);
	const minutes = parseInt(parts[1], 10);

	// Validate ranges
	if (isNaN(hours) || isNaN(minutes)) {
		return null;
	}
	if (hours < 0 || hours > 23) {
		return null;
	}
	if (minutes < 0 || minutes > 59) {
		return null;
	}

	// Convert to 12-hour format
	const period = hours >= 12 ? 'PM' : 'AM';
	const displayHours = hours % 12 || 12; // 0 -> 12, 13 -> 1, etc.

	return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Parse HTML date input (YYYY-MM-DD) to OTP format (MM-DD-YYYY).
 *
 * Uses direct string parsing to avoid timezone issues.
 * NO Date object is created, so no timezone conversion occurs.
 *
 * @param {string} dateString - Date in "YYYY-MM-DD" format
 * @returns {string|null} Date in "MM-DD-YYYY" format, or null if invalid
 *
 * @example
 * parseDateInput('2026-01-14')  // Returns '01-14-2026'
 * parseDateInput('2026-12-31')  // Returns '12-31-2026'
 */
export function parseDateInput(dateString) {
	if (!dateString || typeof dateString !== 'string') {
		return null;
	}

	const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		return null;
	}

	const [, year, month, day] = match;

	// Basic validation
	const y = parseInt(year, 10);
	const m = parseInt(month, 10);
	const d = parseInt(day, 10);

	if (m < 1 || m > 12) {
		return null;
	}
	if (d < 1 || d > 31) {
		return null;
	}
	if (y < 2000 || y > 2100) {
		return null;
	}

	return `${month}-${day}-${year}`;
}

/**
 * Format a Date object to OTP API time format: "h:mm AM/PM"
 *
 * Uses toLocaleTimeString for consistent local time output.
 * Used for "Leave Now" mode where we need the current time.
 *
 * @param {Date} date - Date object (uses local time)
 * @returns {string} Time in "h:mm AM/PM" format
 *
 * @example
 * formatTimeForOTP(new Date('2026-01-14T14:30:00'))  // Returns '2:30 PM'
 */
export function formatTimeForOTP(date) {
	return date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

/**
 * Format a Date object to OTP API date format: "MM-DD-YYYY"
 *
 * Uses local date components explicitly to avoid timezone shifts.
 * Used for "Leave Now" mode where we need the current date.
 *
 * @param {Date} date - Date object (uses local time)
 * @returns {string} Date in "MM-DD-YYYY" format
 *
 * @example
 * formatDateForOTP(new Date('2026-01-14'))  // Returns '01-14-2026'
 */
export function formatDateForOTP(date) {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const year = date.getFullYear();
	return `${month}-${day}-${year}`;
}

/**
 * Combine HTML date and time inputs into a single Date object.
 * This preserves local timezone by parsing components individually.
 *
 * @param {string} dateString - Date in "YYYY-MM-DD" format
 * @param {string} timeString - Time in "HH:mm" format
 * @returns {Date|null} Local Date object, or null if inputs invalid
 */
export function combineDateTimeInputs(dateString, timeString) {
	if (!dateString || !timeString) {
		return null;
	}

	const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	const timeMatch = timeString.match(/^(\d{2}):(\d{2})$/);

	if (!dateMatch || !timeMatch) {
		return null;
	}

	const year = parseInt(dateMatch[1], 10);
	const month = parseInt(dateMatch[2], 10) - 1; // JS months are 0-indexed
	const day = parseInt(dateMatch[3], 10);
	const hours = parseInt(timeMatch[1], 10);
	const minutes = parseInt(timeMatch[2], 10);

	// Create date using local timezone constructor
	return new Date(year, month, day, hours, minutes);
}
