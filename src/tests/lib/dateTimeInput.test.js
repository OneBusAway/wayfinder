import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTodayDateForInput, getCurrentTimeForInput } from '$lib/dateTimeInput';

describe('getTodayDateForInput', () => {
	beforeEach(() => {
		// Set timezone to UTC to avoid local timezone issues
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-16T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});
	it("returns today's date in YYYY-MM-DD format", () => {
		expect(getTodayDateForInput()).toBe('2024-01-16');
	});

	it('returns agency-local date when timeZone is provided', () => {
		// 2 AM UTC on Jan 16 = 6 PM PST on Jan 15
		vi.setSystemTime(new Date('2024-01-16T02:00:00Z'));
		expect(getTodayDateForInput('America/Los_Angeles')).toBe('2024-01-15');
	});
});

describe('getCurrentTimeForInput', () => {
	beforeEach(() => {
		// Set timezone to UTC to avoid local timezone issues
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns current time in HH:MM format', () => {
		vi.setSystemTime(new Date('2024-01-16T10:30:00Z'));
		expect(getCurrentTimeForInput()).toBe('10:30');
	});

	it('returns current time in HH:MM format in 24-hour format', () => {
		vi.setSystemTime(new Date('2024-01-16T15:00:00Z'));
		expect(getCurrentTimeForInput()).toBe('15:00');
	});

	it('returns agency-local time when timeZone is provided', () => {
		// 4:52 AM UTC = 8:52 PM PST (previous day, UTC-8 in January)
		vi.setSystemTime(new Date('2024-01-16T04:52:00Z'));
		expect(getCurrentTimeForInput('America/Los_Angeles')).toBe('20:52');
	});
});
