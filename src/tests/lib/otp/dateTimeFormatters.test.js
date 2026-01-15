import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	parseTimeInput,
	parseDateInput,
	formatTimeForOTP,
	formatDateForOTP,
	combineDateTimeInputs
} from '$lib/otp/dateTimeFormatters.js';

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

	// Invalid inputs
	it('returns null for empty string', () => {
		expect(parseTimeInput('')).toBeNull();
	});

	it('returns null for null input', () => {
		expect(parseTimeInput(null)).toBeNull();
	});

	it('returns null for undefined input', () => {
		expect(parseTimeInput(undefined)).toBeNull();
	});

	it('returns null for invalid hour (24:00)', () => {
		expect(parseTimeInput('24:00')).toBeNull();
	});

	it('returns null for invalid hour (25:00)', () => {
		expect(parseTimeInput('25:00')).toBeNull();
	});

	it('returns null for invalid minutes (12:60)', () => {
		expect(parseTimeInput('12:60')).toBeNull();
	});

	it('returns null for negative hour (-01:00)', () => {
		expect(parseTimeInput('-01:00')).toBeNull();
	});

	it('returns null for negative minutes (12:-05)', () => {
		expect(parseTimeInput('12:-05')).toBeNull();
	});

	it('returns null for malformed string (12)', () => {
		expect(parseTimeInput('12')).toBeNull();
	});

	it('returns null for malformed string (12:00:00)', () => {
		expect(parseTimeInput('12:00:00')).toBeNull();
	});

	it('returns null for non-numeric values', () => {
		expect(parseTimeInput('ab:cd')).toBeNull();
	});

	// Pass-through for already-converted format
	it('returns existing AM/PM format unchanged', () => {
		expect(parseTimeInput('2:30 PM')).toBe('2:30 PM');
	});

	it('returns existing AM format unchanged', () => {
		expect(parseTimeInput('9:15 AM')).toBe('9:15 AM');
	});
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
	it('returns null for empty string', () => {
		expect(parseDateInput('')).toBeNull();
	});

	it('returns null for null input', () => {
		expect(parseDateInput(null)).toBeNull();
	});

	it('returns null for undefined input', () => {
		expect(parseDateInput(undefined)).toBeNull();
	});

	it('returns null for invalid month (2026-13-01)', () => {
		expect(parseDateInput('2026-13-01')).toBeNull();
	});

	it('returns null for invalid month (2026-00-01)', () => {
		expect(parseDateInput('2026-00-01')).toBeNull();
	});

	it('returns null for invalid day (2026-01-32)', () => {
		expect(parseDateInput('2026-01-32')).toBeNull();
	});

	it('returns null for invalid day (2026-01-00)', () => {
		expect(parseDateInput('2026-01-00')).toBeNull();
	});

	it('returns null for malformed format (01-14-2026)', () => {
		expect(parseDateInput('01-14-2026')).toBeNull();
	});

	it('returns null for incomplete date (2026-01)', () => {
		expect(parseDateInput('2026-01')).toBeNull();
	});

	it('returns null for year out of range (1999-01-01)', () => {
		expect(parseDateInput('1999-01-01')).toBeNull();
	});

	it('returns null for year out of range (2101-01-01)', () => {
		expect(parseDateInput('2101-01-01')).toBeNull();
	});
});

describe('formatTimeForOTP', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Mock toLocaleTimeString to ensure consistent output
		vi.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(function () {
			const hours = this.getHours();
			const minutes = this.getMinutes();
			const period = hours >= 12 ? 'PM' : 'AM';
			const hour12 = hours % 12 || 12;
			const minutesPadded = minutes.toString().padStart(2, '0');
			return `${hour12}:${minutesPadded} ${period}`;
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

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
});

describe('combineDateTimeInputs', () => {
	it('creates Date from valid date and time strings', () => {
		const result = combineDateTimeInputs('2026-01-14', '14:30');
		expect(result).toBeInstanceOf(Date);
		expect(result.getFullYear()).toBe(2026);
		expect(result.getMonth()).toBe(0); // January is 0
		expect(result.getDate()).toBe(14);
		expect(result.getHours()).toBe(14);
		expect(result.getMinutes()).toBe(30);
	});

	it('handles midnight correctly', () => {
		const result = combineDateTimeInputs('2026-01-14', '00:00');
		expect(result.getHours()).toBe(0);
		expect(result.getMinutes()).toBe(0);
	});

	it('handles end of day correctly', () => {
		const result = combineDateTimeInputs('2026-01-14', '23:59');
		expect(result.getHours()).toBe(23);
		expect(result.getMinutes()).toBe(59);
	});

	it('returns null for null date', () => {
		expect(combineDateTimeInputs(null, '14:30')).toBeNull();
	});

	it('returns null for null time', () => {
		expect(combineDateTimeInputs('2026-01-14', null)).toBeNull();
	});

	it('returns null for invalid date format', () => {
		expect(combineDateTimeInputs('01-14-2026', '14:30')).toBeNull();
	});

	it('returns null for invalid time format', () => {
		expect(combineDateTimeInputs('2026-01-14', '2:30 PM')).toBeNull();
	});

	it('returns null for empty strings', () => {
		expect(combineDateTimeInputs('', '')).toBeNull();
	});
});
