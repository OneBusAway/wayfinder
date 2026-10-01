import { describe, it, expect } from 'vitest';
import { polygonsOf, isClockwise, orientRing } from '$lib/MapHelpers/zoneGeometry.js';
import { square } from '../../fixtures/onDemand.js';

const ccwSquare = square(0, 0, 1, 1).coordinates[0];

describe('zoneGeometry', () => {
	it('wraps a Polygon and passes a MultiPolygon through', () => {
		expect(polygonsOf({ type: 'Polygon', coordinates: [ccwSquare] })).toEqual([[ccwSquare]]);
		expect(
			polygonsOf({ type: 'MultiPolygon', coordinates: [[ccwSquare], [ccwSquare]] })
		).toHaveLength(2);
	});

	it('drops degenerate rings and unknown geometry', () => {
		expect(
			polygonsOf({
				type: 'Polygon',
				coordinates: [
					[
						[0, 0],
						[1, 1]
					]
				]
			})
		).toEqual([]);
		expect(polygonsOf({ type: 'Point', coordinates: [0, 0] })).toEqual([]);
		expect(polygonsOf(null)).toEqual([]);
	});

	it('drops a polygon whose exterior is invalid instead of promoting a hole', () => {
		const degenerate = [
			[0, 0],
			[1, 1]
		];
		const hole = [
			[0.2, 0.2],
			[0.2, 0.8],
			[0.8, 0.8],
			[0.2, 0.2]
		];
		expect(
			polygonsOf({
				type: 'MultiPolygon',
				coordinates: [
					[degenerate, hole],
					[ccwSquare, degenerate, hole]
				]
			})
		).toEqual([[ccwSquare, hole]]);
	});

	it('detects and fixes winding', () => {
		expect(isClockwise(ccwSquare)).toBe(false);
		expect(isClockwise(orientRing(ccwSquare, true))).toBe(true);
		expect(orientRing(ccwSquare, false)).toBe(ccwSquare);
	});
});
