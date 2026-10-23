import { env } from '$env/dynamic/public';

// `Date.prototype.getDay()` numbering, which the calendar uses (0=Sunday).
const DATE_GET_DAY_MONDAY = 1;

/**
 * Get the first day of the week for calendar components.
 *
 * PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK counts from Monday (0=Monday, 6=Sunday), as
 * documented for deployments, but the calendar counts from Sunday like
 * `Date.prototype.getDay()`, so the configured value is shifted by one.
 * @returns {NonNullable<import('bits-ui').Calendar.RootProps['weekStartsOn']>} 0 for Sunday, 1 for Monday, 2 for Tuesday, 3 for Wednesday, 4 for Thursday, 5 for Friday, 6 for Saturday
 */
export function getFirstDayOfWeek() {
	const configValue = env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK;

	// Default to Monday if not configured
	if (!configValue) {
		return DATE_GET_DAY_MONDAY;
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
		return DATE_GET_DAY_MONDAY;
	}

	// Narrowed by the range check above.
	return /** @type {NonNullable<import('bits-ui').Calendar.RootProps['weekStartsOn']>} */ (
		(dayValue + 1) % 7
	);
}
