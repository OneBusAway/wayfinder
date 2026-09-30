import { describe, it, expect } from 'vitest';
import { polygonsOf, isClockwise, orientRing } from '$lib/MapHelpers/zoneGeometry.js';

const ccwSquare = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1],
	[0, 0]
];

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

	it('detects and fixes winding', () => {
		expect(isClockwise(ccwSquare)).toBe(false);
		expect(isClockwise(orientRing(ccwSquare, true))).toBe(true);
		expect(orientRing(ccwSquare, false)).toBe(ccwSquare);
	});
});
