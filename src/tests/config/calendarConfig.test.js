// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(
	() => /** @type {{ PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK?: string }} */ ({})
);

vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockEnv;
	}
}));

import { getWeekStartsOn } from '$config/calendarConfig';

// `Date.prototype.getDay()` numbering, which the calendar uses (0=Sunday).
const DATE_GET_DAY_MONDAY = 1;

describe('getWeekStartsOn', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		delete mockEnv.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK;
	});

	it('returns Monday by default when no configuration is set', () => {
		expect(getWeekStartsOn()).toBe(DATE_GET_DAY_MONDAY);
	});

	it('returns Monday when environment variable is undefined', () => {
		mockEnv.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = undefined;
		expect(getWeekStartsOn()).toBe(DATE_GET_DAY_MONDAY);
	});

	it('returns Monday when environment variable is empty string', () => {
		mockEnv.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '';
		expect(getWeekStartsOn()).toBe(DATE_GET_DAY_MONDAY);
	});

	it('converts every configured day (0=Monday ... 6=Sunday) to the calendar day', () => {
		for (let i = 0; i <= 6; i++) {
			mockEnv.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = i.toString();
			expect(getWeekStartsOn()).toBe((i + 1) % 7);
		}
	});

	it('returns Monday and shows warning for values above 6', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		mockEnv.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '7';
		expect(getWeekStartsOn()).toBe(DATE_GET_DAY_MONDAY);
		expect(consoleSpy).toHaveBeenCalledWith(
			'Invalid PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK value. Must be 0-6 (0=Monday, 6=Sunday). Using Monday as default.'
		);

		consoleSpy.mockRestore();
	});

	it('returns Monday and shows warning for negative values', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		mockEnv.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = '-1';
		expect(getWeekStartsOn()).toBe(DATE_GET_DAY_MONDAY);
		expect(consoleSpy).toHaveBeenCalledWith(
			'Invalid PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK value. Must be 0-6 (0=Monday, 6=Sunday). Using Monday as default.'
		);

		consoleSpy.mockRestore();
	});

	it('returns Monday and shows warning for non-numeric values', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		// Test various non-numeric strings
		const invalidValues = ['invalid', 'monday', 'sunday', 'abc', '1.5', '2.0'];

		invalidValues.forEach((value) => {
			mockEnv.PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK = value;
			expect(getWeekStartsOn()).toBe(DATE_GET_DAY_MONDAY);
		});

		expect(consoleSpy).toHaveBeenCalledWith(
			'Invalid PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK value. Must be 0-6 (0=Monday, 6=Sunday). Using Monday as default.'
		);

		consoleSpy.mockRestore();
	});
});
