import { describe, it, expect } from 'vitest';
import {
	resolveVehicleStopIndex,
	computeVisibleStopRange,
	buildStopSegments
} from '$lib/tripDetailsUtils.js';

describe('resolveVehicleStopIndex', () => {
	const stopTimes = [{ stopId: 'a' }, { stopId: 'b' }, { stopId: 'c' }, { stopId: 'd' }];

	it('uses closestStop to find the index', () => {
		expect(resolveVehicleStopIndex({ closestStop: 'c' }, stopTimes)).toBe(2);
	});

	it('falls back to nextStop when closestStop is absent', () => {
		expect(resolveVehicleStopIndex({ nextStop: 'b' }, stopTimes)).toBe(1);
	});

	it('prefers closestStop over nextStop', () => {
		expect(resolveVehicleStopIndex({ closestStop: 'd', nextStop: 'a' }, stopTimes)).toBe(3);
	});

	// Regression: the old approach guessed position from raw lat/lon ranges,
	// assuming stops were ordered monotonically by coordinate. This resolves the
	// stop purely by id, so ordering of coordinates is irrelevant.
	it('resolves by stop id regardless of coordinate ordering', () => {
		const unordered = [
			{ stopId: 'a', lat: 47.9, lon: -122.1 },
			{ stopId: 'b', lat: 47.1, lon: -122.9 },
			{ stopId: 'c', lat: 47.5, lon: -122.5 }
		];
		expect(resolveVehicleStopIndex({ closestStop: 'b' }, unordered)).toBe(1);
	});

	it('returns -1 when the target stop is not in stopTimes', () => {
		expect(resolveVehicleStopIndex({ closestStop: 'z' }, stopTimes)).toBe(-1);
	});

	it('returns -1 when status is missing', () => {
		expect(resolveVehicleStopIndex(null, stopTimes)).toBe(-1);
		expect(resolveVehicleStopIndex(undefined, stopTimes)).toBe(-1);
	});

	it('returns -1 when stopTimes is missing', () => {
		expect(resolveVehicleStopIndex({ closestStop: 'a' }, null)).toBe(-1);
		expect(resolveVehicleStopIndex({ closestStop: 'a' }, undefined)).toBe(-1);
	});

	it('returns -1 when status has neither closestStop nor nextStop', () => {
		expect(resolveVehicleStopIndex({}, stopTimes)).toBe(-1);
	});
});

describe('computeVisibleStopRange', () => {
	const stopTimes = [
		{ stopId: 'a' },
		{ stopId: 'b' },
		{ stopId: 'c' },
		{ stopId: 'd' },
		{ stopId: 'e' }
	];

	it('spans from the vehicle position through the rider stop', () => {
		// bus at index 1 (b), rider stop d (index 3) => show b..d, hide a and e
		expect(computeVisibleStopRange(stopTimes, 1, 'd')).toEqual({ start: 1, end: 3 });
	});

	it('starts at the first stop when the vehicle position is unknown', () => {
		expect(computeVisibleStopRange(stopTimes, -1, 'c')).toEqual({ start: 0, end: 2 });
	});

	it('ends at the last stop when the rider stop is not in the list', () => {
		expect(computeVisibleStopRange(stopTimes, 1, 'zzz')).toEqual({ start: 1, end: 4 });
	});

	it('clamps the start to the rider stop when the bus has already passed it', () => {
		// bus at 3 (d) but rider stop is b (index 1) => show only the rider stop
		expect(computeVisibleStopRange(stopTimes, 3, 'b')).toEqual({ start: 1, end: 1 });
	});

	it('returns an empty range for no stop times', () => {
		expect(computeVisibleStopRange([], 0, 'a')).toEqual({ start: 0, end: -1 });
		expect(computeVisibleStopRange(null, 0, 'a')).toEqual({ start: 0, end: -1 });
	});
});

describe('buildStopSegments', () => {
	// 10 stops: a..j
	const stopTimes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((stopId) => ({
		stopId
	}));

	it('collapses the middle stops when the vehicle is far from the rider stop', () => {
		// bus at index 0 (a), rider stop j (index 9): 8 intermediate stops,
		// keep the last 3 (g, h, i), collapse the other 5.
		expect(buildStopSegments(stopTimes, 0, 'j')).toEqual([
			{ type: 'stop', index: 0 },
			{ type: 'collapsed', count: 5 },
			{ type: 'stop', index: 6 },
			{ type: 'stop', index: 7 },
			{ type: 'stop', index: 8 },
			{ type: 'stop', index: 9 }
		]);
	});

	it('collapses exactly one stop when the vehicle is tailCount + 2 stops away', () => {
		// bus at 0, rider at index 5: 4 intermediate stops, collapse 1, keep 3.
		expect(buildStopSegments(stopTimes, 0, 'f')).toEqual([
			{ type: 'stop', index: 0 },
			{ type: 'collapsed', count: 1 },
			{ type: 'stop', index: 2 },
			{ type: 'stop', index: 3 },
			{ type: 'stop', index: 4 },
			{ type: 'stop', index: 5 }
		]);
	});

	it('does not collapse when intermediate stops equal the tail count', () => {
		// bus at 0, rider at index 4: 3 intermediate stops == tailCount, show all.
		expect(buildStopSegments(stopTimes, 0, 'e')).toEqual([
			{ type: 'stop', index: 0 },
			{ type: 'stop', index: 1 },
			{ type: 'stop', index: 2 },
			{ type: 'stop', index: 3 },
			{ type: 'stop', index: 4 }
		]);
	});

	it('respects a custom tailCount', () => {
		// bus at 0, rider at index 9, tailCount 2: keep last 2 (h, i), collapse 6.
		expect(buildStopSegments(stopTimes, 0, 'j', 2)).toEqual([
			{ type: 'stop', index: 0 },
			{ type: 'collapsed', count: 6 },
			{ type: 'stop', index: 7 },
			{ type: 'stop', index: 8 },
			{ type: 'stop', index: 9 }
		]);
	});

	it('collapses long scheduled trips even without a known vehicle position', () => {
		// busPosition -1 => range starts at 0; rider at index 9 => collapse 5.
		expect(buildStopSegments(stopTimes, -1, 'j')).toEqual([
			{ type: 'stop', index: 0 },
			{ type: 'collapsed', count: 5 },
			{ type: 'stop', index: 6 },
			{ type: 'stop', index: 7 },
			{ type: 'stop', index: 8 },
			{ type: 'stop', index: 9 }
		]);
	});

	it('returns a single stop when the vehicle sits at the rider stop', () => {
		expect(buildStopSegments(stopTimes, 3, 'd')).toEqual([{ type: 'stop', index: 3 }]);
	});

	it('returns an empty list when the bus has already passed the rider stop', () => {
		// bus at 5, rider at index 3 => computeVisibleStopRange clamps to 3..3.
		expect(buildStopSegments(stopTimes, 5, 'd')).toEqual([{ type: 'stop', index: 3 }]);
	});

	it('returns an empty list when there are no stop times', () => {
		expect(buildStopSegments([], 0, 'a')).toEqual([]);
		expect(buildStopSegments(null, 0, 'a')).toEqual([]);
	});
});
