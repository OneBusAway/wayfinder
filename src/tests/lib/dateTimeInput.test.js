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
});

describe('getCurrentTimeForInput', () => {
	beforeEach(() => {
		// Set timezone to UTC to avoid local timezone issues
		vi.useFakeTimers();
	});

	it('returns current time in HH:MM format', () => {
		vi.setSystemTime(new Date('2024-01-16T10:30:00Z'));
		expect(getCurrentTimeForInput()).toBe('10:30');
	});

	it('returns current time in HH:MM format in 24-hour format', () => {
		vi.setSystemTime(new Date('2024-01-16T15:00:00Z'));
		expect(getCurrentTimeForInput()).toBe('15:00');
	});
});
