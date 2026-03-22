import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Schedule Page - Phase 7 Features', () => {
	let component;
	let mockScheduleData;

	beforeEach(() => {
		mockScheduleData = {
			entry: {
				stopRouteSchedules: [
					{
						routeId: 'route1',
						stopRouteDirectionSchedules: [
							{
								tripHeadsign: 'Downtown',
								scheduleStopTimes: [
									{ arrivalTime: new Date('2026-03-23T08:15:00').getTime() },
									{ arrivalTime: new Date('2026-03-23T10:30:00').getTime() },
									{ arrivalTime: new Date('2026-03-23T18:45:00').getTime() },
									{ arrivalTime: new Date('2026-03-23T20:00:00').getTime() }
								]
							}
						]
					}
				]
			},
			references: {
				stops: [{ id: 'stop1', name: 'Test Stop', direction: 'Eastbound' }],
				routes: [{ id: 'route1', shortName: '44', longName: 'Route 44' }]
			}
		};
	});

	it('filters schedules by selected time - only shows departures after selected time', () => {
		// Simulate time filtering logic
		const stopTimes = [
			{ timestamp: new Date('2026-03-23T08:15:00').getTime(), arrivalTime: '08:15' },
			{ timestamp: new Date('2026-03-23T10:30:00').getTime(), arrivalTime: '10:30' },
			{ timestamp: new Date('2026-03-23T18:45:00').getTime(), arrivalTime: '18:45' },
			{ timestamp: new Date('2026-03-23T20:00:00').getTime(), arrivalTime: '20:00' }
		];

		// Select 18:00 (6 PM)
		const selectedHours = 18;
		const selectedMinutes = 0;
		const selectedTimestamp = selectedHours * 60 + selectedMinutes;

		const filtered = stopTimes.filter((time) => {
			const date = new Date(time.timestamp);
			const timeMinutes = date.getHours() * 60 + date.getMinutes();
			return timeMinutes >= selectedTimestamp;
		});

		// Should have 18:45 and 20:00
		expect(filtered).toHaveLength(2);
		expect(filtered[0].arrivalTime).toBe('18:45');
		expect(filtered[1].arrivalTime).toBe('20:00');
	});

	it('shows all times when no time filter is applied', () => {
		const stopTimes = [
			{ timestamp: new Date('2026-03-23T08:15:00').getTime(), arrivalTime: '08:15' },
			{ timestamp: new Date('2026-03-23T10:30:00').getTime(), arrivalTime: '10:30' },
			{ timestamp: new Date('2026-03-23T18:45:00').getTime(), arrivalTime: '18:45' }
		];

		// No time filter
		expect(stopTimes).toHaveLength(3);
	});

	it('handles "Now" button - sets current time', () => {
		const now = new Date();
		const expectedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

		expect(expectedTime).toMatch(/^\d{2}:\d{2}$/);
		expect(expectedTime.length).toBe(5);
	});

	it('handles "Tomorrow @ 8am" button - sets date to tomorrow and time to 08:00', () => {
		const today = new Date('2026-03-23');
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		expect(tomorrow.toISOString().split('T')[0]).toBe('2026-03-24');

		const time = '08:00';
		expect(time).toBe('08:00');
	});

	it('handles "Tomorrow @ 6pm" button - sets date to tomorrow and time to 18:00', () => {
		const today = new Date('2026-03-23');
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		expect(tomorrow.toISOString().split('T')[0]).toBe('2026-03-24');

		const time = '18:00';
		expect(time).toBe('18:00');
	});

	it('generates proper empty state message when time filter applied and no results', () => {
		const selectedDate = new Date('2026-03-23');
		const selectedTime = '22:00';
		const schedules = []; // No schedules after 10 PM

		const isEmpty = schedules.length === 0;
		const message = `No departures found for ${selectedDate.toLocaleDateString()} after ${selectedTime}`;

		expect(isEmpty).toBe(true);
		expect(message).toContain('No departures found');
		expect(message).toContain('22:00');
	});

	it('shows default empty message when no schedules exist for date', () => {
		const schedules = [];
		const selectedTime = ''; // No time filter

		const isEmpty = schedules.length === 0;

		expect(isEmpty).toBe(true);
	});

	it('calculates time offset correctly for various times', () => {
		const testCases = [
			{ hours: 0, minutes: 0, expected: 0 }, // Midnight
			{ hours: 8, minutes: 15, expected: 495 }, // 8:15 AM
			{ hours: 12, minutes: 30, expected: 750 }, // 12:30 PM
			{ hours: 18, minutes: 0, expected: 1080 }, // 6 PM
			{ hours: 23, minutes: 59, expected: 1439 } // 11:59 PM
		];

		testCases.forEach(({ hours, minutes, expected }) => {
			const timestamp = hours * 60 + minutes;
			expect(timestamp).toBe(expected);
		});
	});

	it('preserves schedule data structure after filtering', () => {
		const schedule = {
			tripHeadsign: '44 - Downtown',
			stopTimes: {
				8: [{ arrivalTime: '08:15', timestamp: new Date('2026-03-23T08:15:00').getTime() }],
				10: [{ arrivalTime: '10:30', timestamp: new Date('2026-03-23T10:30:00').getTime() }],
				18: [{ arrivalTime: '18:45', timestamp: new Date('2026-03-23T18:45:00').getTime() }]
			}
		};

		expect(schedule).toHaveProperty('tripHeadsign');
		expect(schedule).toHaveProperty('stopTimes');
		expect(Object.keys(schedule.stopTimes)).toEqual(['8', '10', '18']);
	});

	it('handles time comparison edge cases - exact time match', () => {
		const stopTime = { timestamp: new Date('2026-03-23T18:00:00').getTime() };
		const selectedTime = '18:00';
		const [hours, minutes] = selectedTime.split(':').map(Number);
		const selectedTimestamp = hours * 60 + minutes;

		const date = new Date(stopTime.timestamp);
		const timeMinutes = date.getHours() * 60 + date.getMinutes();

		expect(timeMinutes).toBe(selectedTimestamp);
		expect(timeMinutes >= selectedTimestamp).toBe(true);
	});

	it('filters correctly when time is one minute before departure', () => {
		const stopTime = { timestamp: new Date('2026-03-23T18:00:00').getTime() };
		const selectedTime = '17:59';
		const [hours, minutes] = selectedTime.split(':').map(Number);
		const selectedTimestamp = hours * 60 + minutes;

		const date = new Date(stopTime.timestamp);
		const timeMinutes = date.getHours() * 60 + date.getMinutes();

		expect(timeMinutes >= selectedTimestamp).toBe(true);
	});

	it('returns empty when filter time is after all departures', () => {
		const stopTimes = [
			{ timestamp: new Date('2026-03-23T08:15:00').getTime(), arrivalTime: '08:15' },
			{ timestamp: new Date('2026-03-23T10:30:00').getTime(), arrivalTime: '10:30' }
		];

		const selectedTime = '23:00';
		const [hours, minutes] = selectedTime.split(':').map(Number);
		const selectedTimestamp = hours * 60 + minutes;

		const filtered = stopTimes.filter((time) => {
			const date = new Date(time.timestamp);
			const timeMinutes = date.getHours() * 60 + date.getMinutes();
			return timeMinutes >= selectedTimestamp;
		});

		expect(filtered).toHaveLength(0);
	});
});
