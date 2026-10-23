import type { Calendar } from 'bits-ui';
import { env } from '$env/dynamic/public';

// `Date.prototype.getDay()` numbering, which the calendar uses (0=Sunday).
const DATE_GET_DAY_MONDAY = 1;

/**
 * Get the first day of the week for calendar components.
 *
 * PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK counts from Monday (0=Monday, 6=Sunday), as
 * documented for deployments, but the calendar counts from Sunday like
 * `Date.prototype.getDay()`, so the configured value is shifted by one.
 */
export function getWeekStartsOn(): NonNullable<Calendar.RootProps['weekStartsOn']> {
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
	return ((dayValue + 1) % 7) as NonNullable<Calendar.RootProps['weekStartsOn']>;
}
