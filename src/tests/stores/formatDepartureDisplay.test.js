import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDepartureDisplay } from '$stores/tripOptionsStore.js';

describe('formatDepartureDisplay', () => {
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
		const translator = (key) => {
			if (key === 'trip-planner.depart') return 'Salir';
			if (key === 'trip-planner.arrive') return 'Llegar';
			return key;
		};

		const result = formatDepartureDisplay(
			{
				departureType: 'departAt',
				departureTime: '09:00',
				departureDate: '2025-06-16'
			},
			translator
		);
		expect(result).toBe('Salir 9:00 AM, Tomorrow');
	});

	it('uses translator for arriveBy prefix', () => {
		const translator = (key) => {
			if (key === 'trip-planner.arrive') return 'Llegar';
			return key;
		};

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
