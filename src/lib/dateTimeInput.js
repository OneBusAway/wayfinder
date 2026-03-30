import { plainTimeToDate } from '$lib/dateTimeFormat';

const fourDigit24HourTimeFormat = new Intl.DateTimeFormat(undefined, {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
});

/**
 * Get today's date in YYYY-MM-DD format for date input
 *
 * @param {string} [timeZone] - IANA timezone (e.g. "America/Los_Angeles"). Defaults to browser's local timezone.
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function getTodayDateForInput(timeZone) {
	try {
		return Temporal.Now.plainDateISO(timeZone).toJSON();
	} catch (err) {
		if (err instanceof RangeError) {
			console.error(`getTodayDateForInput: invalid timezone "${timeZone}", falling back to local`);
			return Temporal.Now.plainDateISO().toJSON();
		}
		throw err;
	}
}

/**
 * Get current time in HH:MM format for time input
 *
 * @param {string} [timeZone] - IANA timezone (e.g. "America/Los_Angeles"). Defaults to browser's local timezone.
 * @returns {string} Current time in HH:MM format
 */
export function getCurrentTimeForInput(timeZone) {
	let now;
	try {
		now = Temporal.Now.plainTimeISO(timeZone);
	} catch (err) {
		if (err instanceof RangeError) {
			console.error(
				`getCurrentTimeForInput: invalid timezone "${timeZone}", falling back to local`
			);
			now = Temporal.Now.plainTimeISO();
		} else {
			throw err;
		}
	}
	return fourDigit24HourTimeFormat.format(plainTimeToDate(now));
}
