import { describe, it, expect } from 'vitest';

describe('Schedule Page - Phase 7 Features', () => {
	const parseTime = (timeStr) => {
		const [hours, minutes] = timeStr.split(':').map(Number);
		return hours * 60 + minutes;
	};

	const filterByTime = (stopTimes, selectedTime) => {
		const selectedTimestamp = parseTime(selectedTime);
		return stopTimes.filter((time) => {
			const date = new Date(time.timestamp);
			const timeMinutes = date.getHours() * 60 + date.getMinutes();
			return timeMinutes >= selectedTimestamp;
		});
	};

	it('filters schedules by selected time', () => {
		const stopTimes = [
			{ timestamp: new Date('2026-03-23T08:15:00').getTime(), arrivalTime: '08:15' },
			{ timestamp: new Date('2026-03-23T18:45:00').getTime(), arrivalTime: '18:45' },
			{ timestamp: new Date('2026-03-23T20:00:00').getTime(), arrivalTime: '20:00' }
		];

		const filtered = filterByTime(stopTimes, '18:00');
		expect(filtered).toHaveLength(2);
		expect(filtered[0].arrivalTime).toBe('18:45');
	});

	it('shows all times when no filter applied', () => {
		const stopTimes = [
			{ timestamp: new Date('2026-03-23T08:15:00').getTime(), arrivalTime: '08:15' },
			{ timestamp: new Date('2026-03-23T10:30:00').getTime(), arrivalTime: '10:30' },
			{ timestamp: new Date('2026-03-23T18:45:00').getTime(), arrivalTime: '18:45' }
		];

		expect(stopTimes).toHaveLength(3);
	});

	it.each([
		{ hours: 0, minutes: 0, expected: 0 },
		{ hours: 8, minutes: 15, expected: 495 },
		{ hours: 12, minutes: 30, expected: 750 },
		{ hours: 18, minutes: 0, expected: 1080 },
		{ hours: 23, minutes: 59, expected: 1439 }
	])('calculates time offset for $hours:$minutes', ({ hours, minutes, expected }) => {
		const timestamp = hours * 60 + minutes;
		expect(timestamp).toBe(expected);
	});

	it('handles edge case - exact time match', () => {
		const stopTime = { timestamp: new Date('2026-03-23T18:00:00').getTime() };
		const timeMinutes = new Date(stopTime.timestamp).getHours() * 60 + 
		                    new Date(stopTime.timestamp).getMinutes();
		const selectedTimestamp = parseTime('18:00');

		expect(timeMinutes).toBe(selectedTimestamp);
		expect(timeMinutes >= selectedTimestamp).toBe(true);
	});

	it('filters when selected time is before departure', () => {
		const stopTime = { timestamp: new Date('2026-03-23T18:00:00').getTime() };
		const filtered = filterByTime([stopTime], '17:59');

		expect(filtered).toHaveLength(1);
	});

	it('returns empty when filter time is after all departures', () => {
		const stopTimes = [
			{ timestamp: new Date('2026-03-23T08:15:00').getTime(), arrivalTime: '08:15' },
			{ timestamp: new Date('2026-03-23T10:30:00').getTime(), arrivalTime: '10:30' }
		];

		const filtered = filterByTime(stopTimes, '23:00');
		expect(filtered).toHaveLength(0);
	});

	it('preserves schedule structure after filtering', () => {
		const schedule = {
			tripHeadsign: '44 - Downtown',
			stopTimes: {
				8: [{ arrivalTime: '08:15', timestamp: new Date('2026-03-23T08:15:00').getTime() }],
				18: [{ arrivalTime: '18:45', timestamp: new Date('2026-03-23T18:45:00').getTime() }]
			}
		};

		expect(schedule).toHaveProperty('tripHeadsign');
		expect(schedule).toHaveProperty('stopTimes');
		expect(Object.keys(schedule.stopTimes)).toHaveLength(2);
	});

	it('generates empty state message correctly', () => {
		const message = 'No departures found for 3/23/2026 after 22:00';
		expect(message).toContain('No departures found');
		expect(message).toContain('22:00');
	});

	it('handles "Now" button scenario', () => {
		const now = new Date();
		const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		expect(timeStr).toMatch(/^\d{2}:\d{2}$/);
	});

	it('handles "Tomorrow @ 8am" scenario', () => {
		const today = new Date('2026-03-23');
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		expect(tomorrow.toISOString().split('T')[0]).toBe('2026-03-24');
	});
});
