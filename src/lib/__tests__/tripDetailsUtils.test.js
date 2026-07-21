import { describe, it, expect } from 'vitest';
import { resolveVehicleStopIndex } from '$lib/tripDetailsUtils.js';

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
