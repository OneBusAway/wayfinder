import { env } from '$env/dynamic/public';

/**
 * Get the first day of the week for calendar components
 * @returns {number} 0 for Monday, 1 for Tuesday, 2 for Wednesday, 3 for Thursday, 4 for Friday, 5 for Saturday, 6 for Sunday
 */
export function getFirstDayOfWeek() {
	const configValue = env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK;

	// Default to Monday (0) if not configured
	if (!configValue) {
		return 0;
	}

	const dayValue = parseInt(configValue, 10);

	if (
		isNaN(dayValue) ||
		dayValue < 0 ||
		dayValue > 6 ||
		dayValue.toString() !== configValue.trim()
	) {
		console.warn(
			'Invalid PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK value. Must be 0-6 (0=Monday, 6=Sunday). Using Monday (0) as default.'
		);
		return 0;
	}

	return dayValue;
}
