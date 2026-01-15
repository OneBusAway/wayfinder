import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTripPlanRequest, createRequestFromTripOptions } from '$lib/otp/otpRequest.js';

describe('createTripPlanRequest', () => {
	const from = { lat: 47.6062, lng: -122.3321 };
	const to = { lat: 47.6205, lng: -122.3493 };

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 0, 14, 14, 30)); // Jan 14, 2026 2:30 PM

		// Mock toLocaleTimeString for consistent output
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

	// Default values
	it('uses default mode when not specified', () => {
		const request = createTripPlanRequest({ from, to });
		expect(request.mode).toBe('TRANSIT,WALK');
	});

	it('uses default maxWalkDistance when not specified', () => {
		const request = createTripPlanRequest({ from, to });
		expect(request.maxWalkDistance).toBe(4828);
	});

	it('uses default wheelchair=false when not specified', () => {
		const request = createTripPlanRequest({ from, to });
		expect(request.wheelchair).toBe(false);
	});

	it('uses default arriveBy=false when not specified', () => {
		const request = createTripPlanRequest({ from, to });
		expect(request.arriveBy).toBe(false);
	});

	it('uses default transferPenalty=0 for fastest optimization', () => {
		const request = createTripPlanRequest({ from, to, optimize: 'fastest' });
		expect(request.transferPenalty).toBe(0);
	});

	it('always sets showIntermediateStops to true', () => {
		const request = createTripPlanRequest({ from, to });
		expect(request.showIntermediateStops).toBe(true);
	});

	// Time handling
	it('uses current time when departureType is "now"', () => {
		const request = createTripPlanRequest({ from, to, departureType: 'now' });
		expect(request.time).toBe('2:30 PM');
		expect(request.date).toBe('01-14-2026');
	});

	it('uses current time when no time/date provided', () => {
		const request = createTripPlanRequest({ from, to });
		expect(request.time).toBe('2:30 PM');
		expect(request.date).toBe('01-14-2026');
	});

	it('uses provided time for scheduled departure', () => {
		const request = createTripPlanRequest({
			from,
			to,
			departureType: 'departAt',
			time: '09:30',
			date: '2026-01-15'
		});
		expect(request.time).toBe('9:30 AM');
		expect(request.date).toBe('01-15-2026');
	});

	it('uses provided time for arrive-by mode', () => {
		const request = createTripPlanRequest({
			from,
			to,
			departureType: 'arriveBy',
			time: '17:00',
			date: '2026-01-15'
		});
		expect(request.time).toBe('5:00 PM');
		expect(request.date).toBe('01-15-2026');
	});

	it('sets arriveBy=true for arrive-by mode', () => {
		const request = createTripPlanRequest({
			from,
			to,
			departureType: 'arriveBy',
			time: '17:00',
			date: '2026-01-15'
		});
		expect(request.arriveBy).toBe(true);
	});

	it('sets arriveBy=false for depart-at mode', () => {
		const request = createTripPlanRequest({
			from,
			to,
			departureType: 'departAt',
			time: '09:30',
			date: '2026-01-15'
		});
		expect(request.arriveBy).toBe(false);
	});

	// Optimization
	it('sets transferPenalty=600 for fewestTransfers optimization', () => {
		const request = createTripPlanRequest({ from, to, optimize: 'fewestTransfers' });
		expect(request.transferPenalty).toBe(600);
	});

	it('sets transferPenalty=0 for fastest optimization', () => {
		const request = createTripPlanRequest({ from, to, optimize: 'fastest' });
		expect(request.transferPenalty).toBe(0);
	});

	it('defaults transferPenalty to 0 for unknown optimization', () => {
		const request = createTripPlanRequest({ from, to, optimize: 'unknown' });
		expect(request.transferPenalty).toBe(0);
	});

	// Coordinate formatting
	it('formats coordinates with 4 decimal places', () => {
		const request = createTripPlanRequest({ from, to });
		expect(request.fromPlace).toBe('47.6062,-122.3321');
		expect(request.toPlace).toBe('47.6205,-122.3493');
	});

	// Custom options
	it('applies custom maxWalkDistance', () => {
		const request = createTripPlanRequest({ from, to, maxWalkDistance: 1609 });
		expect(request.maxWalkDistance).toBe(1609);
	});

	it('applies wheelchair=true', () => {
		const request = createTripPlanRequest({ from, to, wheelchair: true });
		expect(request.wheelchair).toBe(true);
	});

	it('applies custom mode', () => {
		const request = createTripPlanRequest({ from, to, mode: 'BUS,WALK' });
		expect(request.mode).toBe('BUS,WALK');
	});

	// Fallback handling
	it('falls back to current time if time parsing fails', () => {
		const request = createTripPlanRequest({
			from,
			to,
			departureType: 'departAt',
			time: 'invalid',
			date: '2026-01-15'
		});
		expect(request.time).toBe('2:30 PM'); // Falls back to current time
	});

	it('falls back to current date if date parsing fails', () => {
		const request = createTripPlanRequest({
			from,
			to,
			departureType: 'departAt',
			time: '09:30',
			date: 'invalid'
		});
		expect(request.date).toBe('01-14-2026'); // Falls back to current date
	});
});

describe('createRequestFromTripOptions', () => {
	const from = { lat: 47.6062, lng: -122.3321 };
	const to = { lat: 47.6205, lng: -122.3493 };

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 0, 14, 14, 30)); // Jan 14, 2026 2:30 PM

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

	it('converts tripOptions store format to request', () => {
		const tripOptions = {
			departureType: 'departAt',
			departureTime: '09:30',
			departureDate: '2026-01-15',
			wheelchair: false,
			optimize: 'fastest',
			maxWalkDistance: 1609
		};

		const request = createRequestFromTripOptions(from, to, tripOptions);

		expect(request.fromPlace).toBe('47.6062,-122.3321');
		expect(request.toPlace).toBe('47.6205,-122.3493');
		expect(request.time).toBe('9:30 AM');
		expect(request.date).toBe('01-15-2026');
		expect(request.arriveBy).toBe(false);
		expect(request.wheelchair).toBe(false);
		expect(request.maxWalkDistance).toBe(1609);
		expect(request.transferPenalty).toBe(0);
	});

	it('handles departureType "now"', () => {
		const tripOptions = {
			departureType: 'now',
			departureTime: null,
			departureDate: null,
			wheelchair: false,
			optimize: 'fastest',
			maxWalkDistance: 4828
		};

		const request = createRequestFromTripOptions(from, to, tripOptions);
		expect(request.time).toBe('2:30 PM');
		expect(request.date).toBe('01-14-2026');
	});

	it('handles departureType "departAt"', () => {
		const tripOptions = {
			departureType: 'departAt',
			departureTime: '14:30',
			departureDate: '2026-01-15',
			wheelchair: false,
			optimize: 'fastest',
			maxWalkDistance: 4828
		};

		const request = createRequestFromTripOptions(from, to, tripOptions);
		expect(request.arriveBy).toBe(false);
		expect(request.time).toBe('2:30 PM');
	});

	it('handles departureType "arriveBy"', () => {
		const tripOptions = {
			departureType: 'arriveBy',
			departureTime: '17:00',
			departureDate: '2026-01-15',
			wheelchair: false,
			optimize: 'fastest',
			maxWalkDistance: 4828
		};

		const request = createRequestFromTripOptions(from, to, tripOptions);
		expect(request.arriveBy).toBe(true);
		expect(request.time).toBe('5:00 PM');
	});

	it('maps optimize "fewestTransfers" to transferPenalty', () => {
		const tripOptions = {
			departureType: 'now',
			departureTime: null,
			departureDate: null,
			wheelchair: false,
			optimize: 'fewestTransfers',
			maxWalkDistance: 4828
		};

		const request = createRequestFromTripOptions(from, to, tripOptions);
		expect(request.transferPenalty).toBe(600);
	});

	it('passes through wheelchair option', () => {
		const tripOptions = {
			departureType: 'now',
			departureTime: null,
			departureDate: null,
			wheelchair: true,
			optimize: 'fastest',
			maxWalkDistance: 4828
		};

		const request = createRequestFromTripOptions(from, to, tripOptions);
		expect(request.wheelchair).toBe(true);
	});

	it('passes through maxWalkDistance option', () => {
		const tripOptions = {
			departureType: 'now',
			departureTime: null,
			departureDate: null,
			wheelchair: false,
			optimize: 'fastest',
			maxWalkDistance: 1609
		};

		const request = createRequestFromTripOptions(from, to, tripOptions);
		expect(request.maxWalkDistance).toBe(1609);
	});
});
