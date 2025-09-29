import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	convertUnixToTime,
	formatSecondsFromMidnight,
	formatLastUpdated,
	formatTime
} from '$lib/formatters';

describe('convertUnixToTime', () => {
	it('returns a blank string when its input is null', () => {
		expect(convertUnixToTime(null)).toBe('');
	});

	it('returns a blank string when its input is an empty string', () => {
		expect(convertUnixToTime('')).toBe('');
	});

	it('converts a Unix timestamp to a locale-specific formatted time', () => {
		expect(convertUnixToTime(1727442050)).toBe('01:00 PM');
	});
});

describe('formatSecondsFromMidnight', () => {
	it('returns a blank string when its input is null', () => {
		expect(formatSecondsFromMidnight(null)).toBe('');
	});

	it('returns a blank string when its input is undefined', () => {
		expect(formatSecondsFromMidnight(undefined)).toBe('');
	});

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
		const timestamp = new Date('2024-01-16T11:59:30Z');
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('30 sec ago');
	});

	it('formats time more than a minute ago', () => {
		const timestamp = new Date('2024-01-16T11:58:30Z');
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('1 min 30 sec ago');
	});

	it('formats time multiple minutes ago', () => {
		const timestamp = new Date('2024-01-16T11:57:15Z');
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('2 min 45 sec ago');
	});

	it('handles just-now timestamps', () => {
		const timestamp = new Date('2024-01-16T11:59:59Z');
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('1 sec ago');
	});

	it('works with different translation objects', () => {
		const spanishTranslations = {
			min: 'min',
			sec: 'seg',
			ago: 'atrás'
		};
		const timestamp = new Date('2024-01-16T11:58:30Z');
		const result = formatLastUpdated(timestamp, spanishTranslations);
		expect(result).toBe('1 min 30 seg atrás');
	});

	it('handles zero seconds case', () => {
		const timestamp = new Date('2024-01-16T12:00:00Z');
		const result = formatLastUpdated(timestamp, translations);
		expect(result).toBe('0 sec ago');
	});
});

describe('formatTime', () => {
	beforeEach(() => {
		// Set timezone to UTC to avoid local timezone issues
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-16T12:00:00Z'));
		// Mock toLocaleTimeString to ensure consistent output
		vi.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(function () {
			const hours = this.getUTCHours();
			const minutes = this.getUTCMinutes();
			const ampm = hours >= 12 ? 'PM' : 'AM';
			const hour12 = hours % 12 || 12;
			const minutesPadded = minutes.toString().padStart(2, '0');
			return `${hour12}:${minutesPadded} ${ampm}`;
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('handles morning times', () => {
		const result = formatTime('2024-01-16T09:15:00Z');
		expect(result).toBe('9:15 AM');
	});

	it('handles afternoon times', () => {
		const result = formatTime('2024-01-16T14:45:00Z');
		expect(result).toBe('2:45 PM');
	});

	it('handles midnight', () => {
		const result = formatTime('2024-01-16T00:00:00Z');
		expect(result).toBe('12:00 AM');
	});

	it('handles noon', () => {
		const result = formatTime('2024-01-16T12:00:00Z');
		expect(result).toBe('12:00 PM');
	});

	it('pads minutes with leading zeros', () => {
		const result = formatTime('2024-01-16T09:05:00Z');
		expect(result).toBe('9:05 AM');
	});
});
