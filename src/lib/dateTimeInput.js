const fourDigit24HourTimeFormat = new Intl.DateTimeFormat(undefined, {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
});

/**
 * Get today's date in YYYY-MM-DD format for date input
 *
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function getTodayDateForInput() {
	return Temporal.Now.plainDateISO().toJSON();
}

/**
 * Get current time in HH:MM format for time input
 *
 * @returns {string} Current time in HH:MM format
 */
export function getCurrentTimeForInput() {
	const now = Temporal.Now.plainTimeISO();
	return fourDigit24HourTimeFormat.format(now);
}
