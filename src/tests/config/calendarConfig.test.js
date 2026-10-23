import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the environment module
vi.mock('$env/dynamic/public', () => ({
	env: {}
}));

import { getFirstDayOfWeek } from '$config/calendarConfig.js';

import { env } from '$env/dynamic/public';

// `Date.prototype.getDay()` numbering, which the calendar uses (0=Sunday).
const DATE_GET_DAY_SUNDAY = 0;
const DATE_GET_DAY_MONDAY = 1;

describe('getFirstDayOfWeek', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		Object.keys(env).forEach((key) => delete env[key]);
	});

	it('returns 0 (Monday) by default when no configuration is set', () => {
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);
	});

	it('returns 0 (Monday) when environment variable is undefined', () => {
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = undefined;
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);
	});

	it('returns 0 (Monday) when environment variable is empty string', () => {
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '';
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);
	});

	it('converts every configured day (0=Monday ... 6=Sunday) to the calendar day', () => {
		for (let i = 0; i <= 6; i++) {
			env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = i.toString();
			expect(getFirstDayOfWeek()).toBe((i + 1) % 7);
		}
	});

	it('returns 0 (Monday) and shows warning for values above 6', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '7';
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);
		expect(consoleSpy).toHaveBeenCalledWith(
			'Invalid PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK value. Must be 0-6 (0=Monday, 6=Sunday). Using Monday (0) as default.'
		);

		consoleSpy.mockRestore();
	});

	it('returns 0 (Monday) and shows warning for negative values', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '-1';
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);
		expect(consoleSpy).toHaveBeenCalledWith(
			'Invalid PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK value. Must be 0-6 (0=Monday, 6=Sunday). Using Monday (0) as default.'
		);

		consoleSpy.mockRestore();
	});

	it('returns 0 (Monday) and shows warning for non-numeric values', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		// Test various non-numeric strings
		const invalidValues = ['invalid', 'monday', 'sunday', 'abc', '1.5', '2.0'];

		invalidValues.forEach((value) => {
			env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = value;
			expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);
		});

		expect(consoleSpy).toHaveBeenCalledWith(
			'Invalid PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK value. Must be 0-6 (0=Monday, 6=Sunday). Using Monday (0) as default.'
		);

		consoleSpy.mockRestore();
	});

	it('handles numeric strings correctly', () => {
		// Test that string numbers are parsed correctly
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '6';
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_SUNDAY);

		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '0';
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);
	});

	it('handles edge case of "0" string vs undefined/empty', () => {
		// "0" (Monday) should be valid
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '0';
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);

		// undefined should return the Monday default
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = undefined;
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);

		// empty string should return the Monday default
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '';
		expect(getFirstDayOfWeek()).toBe(DATE_GET_DAY_MONDAY);
	});
});
