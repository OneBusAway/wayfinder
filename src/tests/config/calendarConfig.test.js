import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the environment module
vi.mock('$env/dynamic/public', () => ({
	env: {}
}));

import { getFirstDayOfWeek } from '$config/calendarConfig.js';

import { env } from '$env/dynamic/public';

describe('getFirstDayOfWeek', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		Object.keys(env).forEach((key) => delete env[key]);
	});

	it('returns 0 (Monday) by default when no configuration is set', () => {
		expect(getFirstDayOfWeek()).toBe(0);
	});

	it('returns 0 (Monday) when environment variable is undefined', () => {
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = undefined;
		expect(getFirstDayOfWeek()).toBe(0);
	});

	it('returns 0 (Monday) when environment variable is empty string', () => {
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '';
		expect(getFirstDayOfWeek()).toBe(0);
	});

	it('returns the configured value for all valid day values (0-6)', () => {
		// Test all valid values: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
		for (let i = 0; i <= 6; i++) {
			env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = i.toString();
			expect(getFirstDayOfWeek()).toBe(i);
		}
	});

	it('returns 0 (Monday) and shows warning for values above 6', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '7';
		expect(getFirstDayOfWeek()).toBe(0);
		expect(consoleSpy).toHaveBeenCalledWith(
			'Invalid PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK value. Must be 0-6 (0=Monday, 6=Sunday). Using Monday (0) as default.'
		);

		consoleSpy.mockRestore();
	});

	it('returns 0 (Monday) and shows warning for negative values', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '-1';
		expect(getFirstDayOfWeek()).toBe(0);
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
			expect(getFirstDayOfWeek()).toBe(0);
		});

		expect(consoleSpy).toHaveBeenCalledWith(
			'Invalid PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK value. Must be 0-6 (0=Monday, 6=Sunday). Using Monday (0) as default.'
		);

		consoleSpy.mockRestore();
	});

	it('handles numeric strings correctly', () => {
		// Test that string numbers are parsed correctly
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '6';
		expect(getFirstDayOfWeek()).toBe(6);

		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '0';
		expect(getFirstDayOfWeek()).toBe(0);
	});

	it('handles edge case of "0" string vs undefined/empty', () => {
		// "0" should be valid and return 0
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '0';
		expect(getFirstDayOfWeek()).toBe(0);

		// undefined should return default 0
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = undefined;
		expect(getFirstDayOfWeek()).toBe(0);

		// empty string should return default 0
		env.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '';
		expect(getFirstDayOfWeek()).toBe(0);
	});
});
