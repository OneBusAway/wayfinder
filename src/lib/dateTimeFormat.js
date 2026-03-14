export function getLocalTimeZone() {
	return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Time formats
export const utcTimeFormat = new Intl.DateTimeFormat(undefined, {
	hour: 'numeric',
	minute: '2-digit',
	hour12: true,
	timeZone: 'UTC'
});

export const localTimeFormat = new Intl.DateTimeFormat(undefined, {
	hour: 'numeric',
	minute: '2-digit',
	hour12: true
});

export const fourDigitTimeFormat = new Intl.DateTimeFormat(undefined, {
	hour: '2-digit',
	minute: '2-digit',
	hour12: true
});

// Date formats
export const apiDateFormat = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

export const apiTimeFormat = new Intl.DateTimeFormat('en-US', {
	hour: 'numeric',
	minute: '2-digit',
	hour12: true
});

/**
 * Format milliseconds since Unix epoch to a given time zone and format
 *
 * @example
 * msToTimeString(1705395900000)  // Returns '1:05 AM' assuming the local timezone is America/Los_Angeles
 * msToTimeString(1705395900000, 'UTC')  // Returns '9:05 AM'
 * msToTimeString(1705395900000, 'America/New_York')  // Returns '4:05 AM'
 * msToTimeString(1705395900000, 'America/New_York', fourDigitTimeFormat)  // Returns '04:05 AM'
 *
 * @param {number} ms - Milliseconds since Unix epoch
 * @param {string|null} timeZone - Time zone to convert to
 * @param {Intl.DateTimeFormat|null} dateTimeFormat - Intl.DateTimeFormat to use for formatting
 * @returns {string} Time in the given format
 */
export function msToTimeString(
	ms,
	timeZone = getLocalTimeZone(),
	dateTimeFormat = localTimeFormat
) {
	if (!Number.isFinite(ms)) return 'N/A';
	const instant = Temporal.Instant.fromEpochMilliseconds(ms);
	const plainTime = instant.toZonedDateTimeISO(timeZone).toPlainTime();
	return dateTimeFormat.format(plainTime);
}

/**
 * Format milliseconds since Unix epoch to "HH:mm AM/PM" format
 * Dates are in local timezone
 *
 * @example
 * (Assuming the local timezone is America/Los_Angeles)
 * msToLocalArrivalDepartureTimeString(1705425300000)  // Returns '09:15 AM'
 *
 * @param {number} ms - Milliseconds since Unix epoch
 * @returns {string} Time in "HH:mm AM/PM" format
 */
export function msToLocalArrivalDepartureTimeString(ms) {
	return msToTimeString(ms, getLocalTimeZone(), fourDigitTimeFormat);
}

/**
 * Show the time in "h:mm AM/PM" format for a given number of seconds since midnight.
 *
 * @param {number} secondsSinceMidnight - Number of seconds since midnight
 * @returns {string} Time in "h:mm AM/PM" format
 *
 * @example
 * formatSecondsFromMidnight(38280)  // Returns '10:38 AM'
 */
export function formatSecondsFromMidnight(secondsSinceMidnight) {
	if (!Number.isFinite(secondsSinceMidnight)) return '';

	const midnight = new Temporal.PlainTime();
	const time = midnight.add({ seconds: secondsSinceMidnight });

	return utcTimeFormat.format(time);
}

/**
 * Helper to format departure time for pill display
 * Accepts an optional translator function for i18n support
 * @param {Object} opts - Options object containing departureType, departureTime, and departureDate
 * @param {Object} [opts.departureType] - Departure type ('departAt' | 'arriveBy' | 'now')
 * @param {string} [opts.departureTime] - Departure time in 'HH:mm' format
 * @param {string} [opts.departureDate] - Departure date in 'YYYY-MM-DD' format
 * @param {Function} [translator] - Optional translator function for i18n support
 * @returns {string} Formatted departure time string
 *
 * @example
 * formatDepartureDisplay({ departureType: 'departAt', departureTime: '09:00', departureDate: null })  // Returns 'Depart 9:00 AM'
 * formatDepartureDisplay({ departureType: 'arriveBy', departureTime: '17:00', departureDate: '2025-06-15' }, translator)  // Returns 'Arrive 5:00 PM, Today'
 */
export function formatDepartureDisplay(opts, translator = null) {
	if (opts.departureType === 'now') return null;

	const timeStr = opts.departureTime || '';
	const dateStr = opts.departureDate || '';

	// Use translator if provided, otherwise fall back to English
	const prefix =
		opts.departureType === 'arriveBy'
			? translator
				? translator('trip-planner.arrive')
				: 'Arrive'
			: translator
				? translator('trip-planner.depart')
				: 'Depart';

	if (timeStr) {
		const formattedTime = parseTimeInput(timeStr);
		if (!formattedTime) return prefix;

		let dateSuffix = '';
		if (dateStr) {
			const today = Temporal.Now.plainDateISO();
			const tomorrow = today.add({ days: 1 });

			if (dateStr === today.toJSON()) {
				const todayLabel = translator ? translator('trip-planner.today') : 'Today';
				dateSuffix = `, ${todayLabel}`;
			} else if (dateStr === tomorrow.toJSON()) {
				const tomorrowLabel = translator ? translator('trip-planner.tomorrow') : 'Tomorrow';
				dateSuffix = `, ${tomorrowLabel}`;
			} else {
				dateSuffix = `, ${dateStr}`;
			}
		}

		return `${prefix} ${formattedTime}${dateSuffix}`;
	}

	return prefix;
}

/**
 * Parse HTML time input (HH:mm, 24-hour) to OTP format (h:mm AM/PM).
 *
 * Uses Temporal.PlainTime.from to parse the time string to avoid timezone issues.
 * If the time string is already in "h:mm AM/PM" format, it is returned unchanged.
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

	// Try to parse as already-converted format
	const matchAlreadyConverted = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
	if (matchAlreadyConverted) {
		return timeString;
	}

	// Try to parse as 24-hour format
	const match24Hour = timeString.match(/^(\d{2}):(\d{2})$/);
	if (!match24Hour) {
		return null;
	}

	try {
		const time = Temporal.PlainTime.from(timeString);
		return apiTimeFormat.format(time);
	} catch {
		return null;
	}
}

/**
 * Parse HTML date input (YYYY-MM-DD) to OTP format (MM-DD-YYYY).
 *
 * Uses Temporal.PlainDate.from() for validation and parsing.
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

	try {
		const dateTime = Temporal.PlainDate.from(dateString);
		if (dateTime.year < 2000 || dateTime.year > 2100) {
			return null;
		}
		return apiDateFormat.format(dateTime).replaceAll('/', '-');
	} catch {
		return null;
	}
}

/**
 * Format an 24-hour hour to 12-hour format
 *
 * @param {number} hour - Hour in 24-hour format
 * @returns {number|null} Hour in 12-hour format, or null if invalid
 *
 * @example
 * convert24HourTo12Hour(0)  // Returns 12
 * convert24HourTo12Hour(12)  // Returns 12
 * convert24HourTo12Hour(14)  // Returns 2
 * convert24HourTo12Hour(23)  // Returns 11
 */
export function convert24HourTo12Hour(hour) {
	const hourNum = typeof hour === 'string' ? Number(hour) : hour;
	if (!Number.isFinite(hourNum)) return null;
	if (hourNum < 0 || hourNum > 23) return null;
	if (hourNum === 0) return 12;
	if (hourNum > 12) return hourNum - 12;
	return hourNum;
}

/**
 * Format a Date object to OTP API time format: "h:mm AM/PM"
 *
 * @param {Date} date - Date object (uses local time)
 * @returns {string} Time in "h:mm AM/PM" format
 *
 * @example
 * formatTimeForOTP(new Date('2026-01-14T14:30:00'))  // Returns '2:30 PM'
 */
export function formatTimeForOTP(date) {
	return apiTimeFormat.format(date);
}

/**
 * Format a Date object to OTP API date format: "MM-DD-YYYY"
 * Used for "Leave Now" mode where we need the current date.
 *
 * @param {Date} date - Date object (uses local time)
 * @returns {string} Date in "MM-DD-YYYY" format
 *
 * @example
 * formatDateForOTP(new Date(2026, 0, 14))  // Returns '01-14-2026'
 */
export function formatDateForOTP(date) {
	return apiDateFormat.format(date).replaceAll('/', '-');
}

/**
 * Format a timestamp to a last updated string
 *
 * @param {number} timestamp - Timestamp in milliseconds since Unix epoch
 * @param {Object} translations - Object containing translation strings for minutes, seconds, and ago
 * @param {string} translations.min - Translation string for minutes
 * @param {string} translations.sec - Translation string for seconds
 * @param {string} translations.ago - Translation string for ago
 * @returns {string} Formatted last updated string
 *
 * @example
 * Note: The actual output of these examples depends on the current time
 * formatLastUpdated(1715894400000, { min: 'min', sec: 'sec', ago: 'ago' })  // Returns '1 min 30 sec ago'
 * formatLastUpdated(1715894400000, { min: 'minute', sec: 'second', ago: 'ago' })  // Returns '1 minute 30 seconds ago'
 */
export function formatLastUpdated(timestamp, translations) {
	if (!Number.isFinite(timestamp)) return 'N/A';
	const date = Temporal.Instant.fromEpochMilliseconds(timestamp);
	const now = Temporal.Now.instant();
	const { minutes, seconds } = now.since(date).round({ largestUnit: 'minute' });

	const minutesStr = minutes > 0 ? `${minutes} ${translations.min} ` : '';
	return `${minutesStr}${seconds} ${translations.sec} ${translations.ago}`;
}

/**
 * Convert date ("MM-DD-YYYY") + time ("h:mm AM/PM") to OffsetDateTime
 * ("YYYY-MM-DDThh:mm:ss±HH:MM") as required by OTP 2.x GraphQL API.
 *
 * The timezone offset is derived from the server process's locale for the
 * target date, which handles DST transitions correctly. This works when the
 * server runs in the same timezone as the transit agency's service area.
 *
 * @param {string} date - Date in "MM-DD-YYYY" format
 * @param {string} time - Time in "h:mm AM/PM" format
 * @returns {string|null} OffsetDateTime string, or null if time or date format is invalid
 */
export function convertToISO8601(date, time) {
	if (!date || typeof date !== 'string') return null;
	if (!time || typeof time !== 'string') return null;

	const dateMatch = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
	if (!dateMatch) return null;

	const timeMatch = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
	if (!timeMatch) return null;

	const month = parseInt(dateMatch[1], 10);
	const day = parseInt(dateMatch[2], 10);
	const year = parseInt(dateMatch[3], 10);

	let hour = parseInt(timeMatch[1], 10);
	const minute = parseInt(timeMatch[2], 10);
	const period = timeMatch[3].toUpperCase();

	if (period === 'AM' && hour === 12) hour = 0;
	else if (period === 'PM' && hour !== 12) hour += 12;

	try {
		const plainDateTime = Temporal.PlainDateTime.from({ year, month, day, hour, minute });
		// toZonedDateTime resolves DST correctly for the target date (not "now")
		const zdt = plainDateTime.toZonedDateTime(getLocalTimeZone());

		const yearStr = String(year).padStart(4, '0');
		const monthStr = String(month).padStart(2, '0');
		const dayStr = String(day).padStart(2, '0');
		const hourStr = String(hour).padStart(2, '0');
		const minuteStr = String(minute).padStart(2, '0');

		return `${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:00${zdt.offset}`;
	} catch {
		return null;
	}
}
