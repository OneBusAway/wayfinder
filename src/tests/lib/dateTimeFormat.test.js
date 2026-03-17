import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	fourDigitTimeFormat,
	msToTimeString,
	msToLocalArrivalDepartureTimeString,
	formatSecondsFromMidnight,
	parseTimeInput,
	parseDateInput,
	formatTimeForOTP,
	formatDateForOTP,
	formatDepartureDisplay,
	formatLastUpdated,
	convertToISO8601,
	convert24HourTo12Hour
} from '$lib/dateTimeFormat';

const INVALID_INPUTS = [null, undefined, 'invalid', Infinity, -Infinity, NaN];

describe('msToTimeString', () => {
	it('handles morning times', () => {
		const result = msToTimeString(new Date('2024-01-16T09:15:00Z').valueOf());
		expect(result).toBe('9:15 AM');
	});

	it('handles afternoon times', () => {
		const result = msToTimeString(new Date('2024-01-16T14:45:00Z').valueOf());
		expect(result).toBe('2:45 PM');
	});

	it('handles midnight', () => {
		const result = msToTimeString(new Date('2024-01-16T00:00:00Z').valueOf());
		expect(result).toBe('12:00 AM');
	});

	it('handles noon', () => {
		const result = msToTimeString(new Date('2024-01-16T12:00:00Z').valueOf());
		expect(result).toBe('12:00 PM');
	});

	it('pads minutes with leading zeros', () => {
		const result = msToTimeString(new Date('2024-01-16T09:05:00Z').valueOf());
		expect(result).toBe('9:05 AM');
	});

	it('handles time zone conversion', () => {
		const result = msToTimeString(new Date('2024-01-16T09:05:00Z').valueOf(), 'America/New_York');
		expect(result).toBe('4:05 AM');
	});

	it('handles custom format', () => {
		const result = msToTimeString(
			new Date('2024-01-16T09:05:00Z').valueOf(),
			'UTC',
			fourDigitTimeFormat
		);
		expect(result).toBe('09:05 AM');
	});

	it.each(INVALID_INPUTS)(`returns "N/A" when the input is %s`, (input) => {
		expect(msToTimeString(input)).toBe('N/A');
	});
});

describe('msToLocalArrivalDepartureTimeString', () => {
	it('handles morning times', () => {
		const result = msToLocalArrivalDepartureTimeString(new Date('2024-01-16T09:15:00Z').valueOf());
		expect(result).toBe('09:15 AM');
	});

	it('handles afternoon times', () => {
		const result = msToLocalArrivalDepartureTimeString(new Date('2024-01-16T14:45:00Z').valueOf());
		expect(result).toBe('02:45 PM');
	});

	it('handles midnight', () => {
		const result = msToLocalArrivalDepartureTimeString(new Date('2024-01-16T00:00:00Z').valueOf());
		expect(result).toBe('12:00 AM');
	});

	it('handles noon', () => {
		const result = msToLocalArrivalDepartureTimeString(new Date('2024-01-16T12:00:00Z').valueOf());
		expect(result).toBe('12:00 PM');
	});

	it('pads minutes with leading Zeros', () => {
		const result = msToLocalArrivalDepartureTimeString(new Date('2024-01-16T09:05:00Z').valueOf());
		expect(result).toBe('09:05 AM');
	});

	it.each(INVALID_INPUTS)(`returns "N/A" when the input is %s`, (input) => {
		expect(msToLocalArrivalDepartureTimeString(input)).toBe('N/A');
	});
});

describe('formatSecondsFromMidnight', () => {
	it('converts seconds since midnight to 12-hour time format', () => {
		expect(formatSecondsFromMidnight(38280)).toBe('10:38 AM'); // 10:38 AM
		expect(formatSecondsFromMidnight(13080)).toBe('3:38 AM'); // 3:38 AM
		expect(formatSecondsFromMidnight(0)).toBe('12:00 AM'); // midnight
		expect(formatSecondsFromMidnight(43200)).toBe('12:00 PM'); // noon
		expect(formatSecondsFromMidnight(86399)).toBe('11:59 PM'); // 11:59 PM
	});

	it('handles times after midnight (next day service)', () => {
		expect(formatSecondsFromMidnight(90000)).toBe('1:00 AM'); // 25:00 -> 1:00 AM next day
	});

	it('handles negative times (before midnight)', () => {
		expect(formatSecondsFromMidnight(-3600)).toBe('11:00 PM'); // -1 hour -> 11:00 PM previous day
	});

	it.each(INVALID_INPUTS)('returns a blank string when the input is %s', (input) => {
		expect(formatSecondsFromMidnight(input)).toBe('');
	});
});

describe('parseTimeInput', () => {
	// Edge cases - these are critical for correct time display
	it('converts 00:00 (midnight) to 12:00 AM', () => {
		expect(parseTimeInput('00:00')).toBe('12:00 AM');
	});

	it('converts 12:00 (noon) to 12:00 PM', () => {
		expect(parseTimeInput('12:00')).toBe('12:00 PM');
	});

	it('converts 23:59 to 11:59 PM', () => {
		expect(parseTimeInput('23:59')).toBe('11:59 PM');
	});

	// Morning times
	it('converts 09:30 to 9:30 AM', () => {
		expect(parseTimeInput('09:30')).toBe('9:30 AM');
	});

	it('converts 01:05 to 1:05 AM', () => {
		expect(parseTimeInput('01:05')).toBe('1:05 AM');
	});

	it('converts 11:59 to 11:59 AM', () => {
		expect(parseTimeInput('11:59')).toBe('11:59 AM');
	});

	// Afternoon/evening times
	it('converts 13:00 to 1:00 PM', () => {
		expect(parseTimeInput('13:00')).toBe('1:00 PM');
	});

	it('converts 14:30 to 2:30 PM', () => {
		expect(parseTimeInput('14:30')).toBe('2:30 PM');
	});

	it('converts 20:45 to 8:45 PM', () => {
		expect(parseTimeInput('20:45')).toBe('8:45 PM');
	});

	// Minute padding
	it('pads single-digit minutes: 09:05 to 9:05 AM', () => {
		expect(parseTimeInput('09:05')).toBe('9:05 AM');
	});

	it('pads zero minutes: 14:00 to 2:00 PM', () => {
		expect(parseTimeInput('14:00')).toBe('2:00 PM');
	});

	// Pass-through for already-converted format
	it('returns existing AM/PM format unchanged', () => {
		expect(parseTimeInput('2:30 PM')).toBe('2:30 PM');
	});

	it('returns existing AM format unchanged', () => {
		expect(parseTimeInput('9:15 AM')).toBe('9:15 AM');
	});

	// Invalid inputs
	it.each([...INVALID_INPUTS, '24:00', '25:00', '12:60', '-01:00', '12:-05', '12:00:00', 'ab:cd'])(
		'returns null when the input is %s',
		(input) => {
			expect(parseTimeInput(input)).toBeNull();
		}
	);
});

describe('parseDateInput', () => {
	// Valid conversions
	it('converts 2026-01-14 to 01-14-2026', () => {
		expect(parseDateInput('2026-01-14')).toBe('01-14-2026');
	});

	it('converts 2026-12-31 to 12-31-2026', () => {
		expect(parseDateInput('2026-12-31')).toBe('12-31-2026');
	});

	it('converts 2025-02-28 to 02-28-2025', () => {
		expect(parseDateInput('2025-02-28')).toBe('02-28-2025');
	});

	it('preserves leading zeros in month', () => {
		expect(parseDateInput('2026-01-15')).toBe('01-15-2026');
	});

	it('preserves leading zeros in day', () => {
		expect(parseDateInput('2026-11-05')).toBe('11-05-2026');
	});

	// Invalid inputs
	it.each([
		...INVALID_INPUTS,
		'2026-13-01',
		'2026-00-01',
		'2026-01-32',
		'2026-01-00',
		'01-14-2026',
		'2026-01',
		'1999-01-01',
		'2101-01-01'
	])('returns null when the input is %s', (input) => {
		expect(parseDateInput(input)).toBeNull();
	});
});

describe('formatTimeForOTP', () => {
	it('formats midnight correctly as 12:00 AM', () => {
		const date = new Date(2026, 0, 14, 0, 0);
		expect(formatTimeForOTP(date)).toBe('12:00 AM');
	});

	it('formats noon correctly as 12:00 PM', () => {
		const date = new Date(2026, 0, 14, 12, 0);
		expect(formatTimeForOTP(date)).toBe('12:00 PM');
	});

	it('formats morning time correctly', () => {
		const date = new Date(2026, 0, 14, 9, 15);
		expect(formatTimeForOTP(date)).toBe('9:15 AM');
	});

	it('formats afternoon time correctly', () => {
		const date = new Date(2026, 0, 14, 14, 30);
		expect(formatTimeForOTP(date)).toBe('2:30 PM');
	});

	it('pads minutes correctly', () => {
		const date = new Date(2026, 0, 14, 9, 5);
		expect(formatTimeForOTP(date)).toBe('9:05 AM');
	});

	it('formats evening time correctly', () => {
		const date = new Date(2026, 0, 14, 20, 45);
		expect(formatTimeForOTP(date)).toBe('8:45 PM');
	});

	it('formats time in a specific timezone', () => {
		// 10:30 PM UTC = 2:30 PM Pacific (PST, UTC-8)
		const date = new Date('2026-01-14T22:30:00Z');
		expect(formatTimeForOTP(date, 'America/Los_Angeles')).toBe('2:30 PM');
	});

	it('formats time in eastern timezone', () => {
		// 10:30 PM UTC = 5:30 PM Eastern (EST, UTC-5)
		const date = new Date('2026-01-14T22:30:00Z');
		expect(formatTimeForOTP(date, 'America/New_York')).toBe('5:30 PM');
	});
});

describe('formatDateForOTP', () => {
	it('formats date with padded month and day', () => {
		const date = new Date(2026, 0, 14); // Jan 14, 2026
		expect(formatDateForOTP(date)).toBe('01-14-2026');
	});

	it('formats single-digit month correctly', () => {
		const date = new Date(2026, 4, 15); // May 15, 2026
		expect(formatDateForOTP(date)).toBe('05-15-2026');
	});

	it('formats single-digit day correctly', () => {
		const date = new Date(2026, 10, 5); // Nov 5, 2026
		expect(formatDateForOTP(date)).toBe('11-05-2026');
	});

	it('formats double-digit month and day', () => {
		const date = new Date(2026, 11, 25); // Dec 25, 2026
		expect(formatDateForOTP(date)).toBe('12-25-2026');
	});

	it('handles year correctly', () => {
		const date = new Date(2030, 6, 4); // July 4, 2030
		expect(formatDateForOTP(date)).toBe('07-04-2030');
	});

	it('formats date in a specific timezone', () => {
		// 2 AM UTC on Jan 15 = 6 PM PST on Jan 14 (still previous day in Pacific)
		const date = new Date('2026-01-15T02:00:00Z');
		expect(formatDateForOTP(date, 'America/Los_Angeles')).toBe('01-14-2026');
	});

	it('formats date in eastern timezone', () => {
		// 3 AM UTC on Jan 15 = 10 PM EST on Jan 14
		const date = new Date('2026-01-15T03:00:00Z');
		expect(formatDateForOTP(date, 'America/New_York')).toBe('01-14-2026');
	});
});

describe('formatDepartureDisplay', () => {
	const translator = (key) => {
		if (key === 'trip-planner.depart') return 'Salir';
		if (key === 'trip-planner.arrive') return 'Llegar';
		if (key === 'trip-planner.today') return 'Hoy';
		if (key === 'trip-planner.tomorrow') return 'Mañana';
		return key;
	};

	beforeEach(() => {
		vi.useFakeTimers();
		// Fix "now" to 2025-06-15T12:00:00Z (a Sunday)
		vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns null when departureType is "now"', () => {
		expect(formatDepartureDisplay({ departureType: 'now' })).toBeNull();
	});

	it('returns "Depart" prefix for departAt with no time', () => {
		expect(formatDepartureDisplay({ departureType: 'departAt' })).toBe('Depart');
	});

	it('returns "Arrive" prefix for arriveBy with no time', () => {
		expect(formatDepartureDisplay({ departureType: 'arriveBy' })).toBe('Arrive');
	});

	it('formats time without date', () => {
		const result = formatDepartureDisplay({
			departureType: 'departAt',
			departureTime: '09:00',
			departureDate: null
		});
		expect(result).toBe('Depart 9:00 AM');
	});

	it('shows "Today" when date matches today', () => {
		const result = formatDepartureDisplay({
			departureType: 'departAt',
			departureTime: '09:00',
			departureDate: '2025-06-15'
		});
		expect(result).toBe('Depart 9:00 AM, Today');
	});

	it('shows "Tomorrow" when date matches tomorrow', () => {
		const result = formatDepartureDisplay({
			departureType: 'departAt',
			departureTime: '14:30',
			departureDate: '2025-06-16'
		});
		expect(result).toBe('Depart 2:30 PM, Tomorrow');
	});

	it('shows full date for other dates', () => {
		const result = formatDepartureDisplay({
			departureType: 'departAt',
			departureTime: '09:00',
			departureDate: '2025-06-20'
		});
		expect(result).toBe('Depart 9:00 AM, 2025-06-20');
	});

	it('shows full date for past dates', () => {
		const result = formatDepartureDisplay({
			departureType: 'departAt',
			departureTime: '08:00',
			departureDate: '2025-06-10'
		});
		expect(result).toBe('Depart 8:00 AM, 2025-06-10');
	});

	it('uses "Arrive" prefix with arriveBy and date', () => {
		const result = formatDepartureDisplay({
			departureType: 'arriveBy',
			departureTime: '17:00',
			departureDate: '2025-06-15'
		});
		expect(result).toBe('Arrive 5:00 PM, Today');
	});

	it('uses translator function when provided', () => {
		const result = formatDepartureDisplay(
			{
				departureType: 'departAt',
				departureTime: '09:00',
				departureDate: '2025-06-16'
			},
			translator
		);
		expect(result).toBe('Salir 9:00 AM, Mañana');
	});

	it('uses translator for arriveBy prefix', () => {
		const result = formatDepartureDisplay(
			{
				departureType: 'arriveBy',
				departureTime: '14:00',
				departureDate: null
			},
			translator
		);
		expect(result).toBe('Llegar 2:00 PM');
	});

	it('returns prefix only for invalid time string', () => {
		const result = formatDepartureDisplay({
			departureType: 'departAt',
			departureTime: 'invalid',
			departureDate: '2025-06-15'
		});
		expect(result).toBe('Depart');
	});
});

describe('formatLastUpdated', () => {
	const translations = {
		min: 'min',
		sec: 'sec',
		ago: 'ago'
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-16T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('formats time less than a minute ago', () => {
		const timestamp = new Date('2024-01-16T11:59:30Z').valueOf();
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('30 sec ago');
	});

	it('formats time more than a minute ago', () => {
		const timestamp = new Date('2024-01-16T11:58:30Z').valueOf();
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('1 min 30 sec ago');
	});

	it('formats time multiple minutes ago', () => {
		const timestamp = new Date('2024-01-16T11:57:15Z').valueOf();
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('2 min 45 sec ago');
	});

	it('handles just-now timestamps', () => {
		const timestamp = new Date('2024-01-16T11:59:59Z').valueOf();
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('1 sec ago');
	});

	it('works with different translation objects', () => {
		const spanishTranslations = {
			min: 'min',
			sec: 'seg',
			ago: 'atrás'
		};
		const timestamp = new Date('2024-01-16T11:58:30Z').valueOf();
		const result = formatLastUpdated(timestamp, spanishTranslations);
		expect(result).toBe('1 min 30 seg atrás');
	});

	it('handles zero seconds case', () => {
		const timestamp = new Date('2024-01-16T12:00:00Z').valueOf();
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('0 sec ago');
	});

	// Invalid inputs
	it.each(INVALID_INPUTS)('returns "N/A" when the input is %s', (input) => {
		expect(formatLastUpdated(input, translations)).toBe('N/A');
	});
});

describe('convertToISO8601', () => {
	it('converts date and time to ISO 8601', () => {
		expect(convertToISO8601('01-14-2026', '09:00 AM')).toBe('2026-01-14T09:00:00+00:00');
	});

	it('converts PM time correctly', () => {
		expect(convertToISO8601('01-14-2026', '3:00 PM')).toBe('2026-01-14T15:00:00+00:00');
	});

	it('handles the edge case of 12:00 AM (midnight) correctly', () => {
		expect(convertToISO8601('01-14-2026', '12:00 AM')).toBe('2026-01-14T00:00:00+00:00');
	});

	it('handles the edge case of 12:00 PM (noon) correctly', () => {
		expect(convertToISO8601('01-14-2026', '12:00 PM')).toBe('2026-01-14T12:00:00+00:00');
	});

	it('returns null for an invalid time format', () => {
		expect(convertToISO8601('01-14-2026', '09:00')).toBeNull();
	});

	it('returns null for an invalid date format', () => {
		expect(convertToISO8601('011-14-2026', '09:00 AM')).toBeNull();
	});

	it('returns null when date is null', () => {
		expect(convertToISO8601(null, '9:00 AM')).toBeNull();
	});

	it('returns null when time is null', () => {
		expect(convertToISO8601('01-14-2026', null)).toBeNull();
	});

	it('returns null when date is undefined', () => {
		expect(convertToISO8601(undefined, '9:00 AM')).toBeNull();
	});

	it('returns null when time is undefined', () => {
		expect(convertToISO8601('01-14-2026', undefined)).toBeNull();
	});

	it('uses explicit timezone when provided', () => {
		// January = PST = UTC-8
		expect(convertToISO8601('01-14-2026', '5:19 PM', 'America/Los_Angeles')).toBe(
			'2026-01-14T17:19:00-08:00'
		);
	});

	it('uses correct DST offset for summer dates', () => {
		// July = PDT = UTC-7
		expect(convertToISO8601('07-04-2026', '5:19 PM', 'America/Los_Angeles')).toBe(
			'2026-07-04T17:19:00-07:00'
		);
	});

	it('uses explicit timezone for eastern time', () => {
		// January = EST = UTC-5
		expect(convertToISO8601('01-14-2026', '9:00 AM', 'America/New_York')).toBe(
			'2026-01-14T09:00:00-05:00'
		);
	});

	it('returns null for an invalid timezone (RangeError)', () => {
		expect(convertToISO8601('01-14-2026', '9:00 AM', 'Not/A/Timezone')).toBeNull();
	});

	it('handles DST spring-forward gap correctly', () => {
		// 2:30 AM on March 8, 2026 does not exist in Pacific time (clocks spring forward 2→3 AM)
		// Temporal resolves this to 3:30 AM PDT — output must use the resolved time, not the input
		expect(convertToISO8601('03-08-2026', '2:30 AM', 'America/Los_Angeles')).toBe(
			'2026-03-08T03:30:00-07:00'
		);
	});
});

describe('convert24HourTo12Hour', () => {
	it('converts 0 to 12', () => {
		expect(convert24HourTo12Hour(0)).toBe(12);
	});

	it('converts 6 to 6', () => {
		expect(convert24HourTo12Hour(6)).toBe(6);
	});

	it('converts 12 to 12', () => {
		expect(convert24HourTo12Hour(12)).toBe(12);
	});

	it('converts 18 to 6', () => {
		expect(convert24HourTo12Hour(18)).toBe(6);
	});

	it('converts 23 to 11', () => {
		expect(convert24HourTo12Hour(23)).toBe(11);
	});

	it('anything greater than 23 returns null', () => {
		expect(convert24HourTo12Hour(24)).toBeNull();
	});

	it('accepts numeric strings as input', () => {
		expect(convert24HourTo12Hour('14')).toBe(2);
	});

	// Invalid inputs
	it.each([...INVALID_INPUTS, -1])('returns null when the input is %s', (input) => {
		expect(convert24HourTo12Hour(input)).toBeNull();
	});
});
