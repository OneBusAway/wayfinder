import { describe, it, expect } from 'vitest';
import {
	toDirection,
	calculateMidpoint,
	calculateBoundsFromAgencies,
	calculateRadiusFromBounds
} from '$lib/mathUtils';

describe('toDirection', () => {
	it('converts east orientation (0°) to 90° direction', () => {
		expect(toDirection(0)).toBe(90);
	});

	it('converts north orientation (90°) to 0° direction', () => {
		expect(toDirection(90)).toBe(0);
	});

	it('converts west orientation (180°) to 270° direction', () => {
		expect(toDirection(180)).toBe(270);
	});

	it('converts south orientation (270°) to 180° direction', () => {
		expect(toDirection(270)).toBe(180);
	});

	it('handles negative orientations', () => {
		expect(toDirection(-90)).toBe(180); // -90° orientation should be 180° direction
		expect(toDirection(-180)).toBe(270); // -180° orientation should be 270° direction
		expect(toDirection(-270)).toBe(0); // -270° orientation should be 0° direction
	});

	it('handles orientations > 360°', () => {
		expect(toDirection(450)).toBe(0); // 450° orientation (90° + 360°) should be 0° direction
		expect(toDirection(720)).toBe(90); // 720° orientation (0° + 2*360°) should be 90° direction
	});

	it('converts arbitrary angles correctly', () => {
		expect(toDirection(45)).toBe(45); // 45° orientation to 45° direction
		expect(toDirection(135)).toBe(315); // 135° orientation to 315° direction
		expect(toDirection(225)).toBe(225); // 225° orientation to 225° direction
		expect(toDirection(315)).toBe(135); // 315° orientation to 135° direction
	});
});

describe('calculateMidpoint', () => {
	it('calculates midpoint for two stops', () => {
		const stops = [
			{ lat: 47.6062, lon: -122.3321 },
			{ lat: 47.6092, lon: -122.3331 }
		];

		const result = calculateMidpoint(stops);

		expect(result.lat).toBeCloseTo(47.6077);
		expect(result.lng).toBeCloseTo(-122.3326);
	});

	it('calculates midpoint for multiple stops', () => {
		const stops = [
			{ lat: 47.6062, lon: -122.3321 },
			{ lat: 47.6092, lon: -122.3331 },
			{ lat: 47.6082, lon: -122.3341 }
		];

		const result = calculateMidpoint(stops);

		expect(result.lat).toBeCloseTo(47.6079);
		expect(result.lng).toBeCloseTo(-122.3331);
	});

	it('returns same point for single stop', () => {
		const stops = [{ lat: 47.6062, lon: -122.3321 }];

		const result = calculateMidpoint(stops);

		expect(result.lat).toBe(47.6062);
		expect(result.lng).toBe(-122.3321);
	});

	it('handles positive and negative coordinates', () => {
		const stops = [
			{ lat: -33.8688, lon: 151.2093 }, // Sydney
			{ lat: 40.7128, lon: -74.006 } // New York
		];

		const result = calculateMidpoint(stops);

		expect(result.lat).toBeCloseTo(3.422);
		expect(result.lng).toBeCloseTo(38.6017);
	});

	it('handles coordinates around the same area', () => {
		const stops = [
			{ lat: 47.6062, lon: -122.3321 },
			{ lat: 47.6065, lon: -122.3324 },
			{ lat: 47.6068, lon: -122.3327 }
		];

		const result = calculateMidpoint(stops);

		expect(result.lat).toBeCloseTo(47.6065);
		expect(result.lng).toBeCloseTo(-122.3324);
	});
});

describe('calculateBoundsFromAgencies', () => {
	it('calculates bounds for a single agency', () => {
		const agencies = [
			{
				lat: 47.5,
				lon: -122.0,
				latSpan: 2.0,
				lonSpan: 3.0
			}
		];

		const result = calculateBoundsFromAgencies(agencies);

		expect(result).toEqual({
			north: 48.5, // 47.5 + 1.0
			south: 46.5, // 47.5 - 1.0
			east: -120.5, // -122.0 + 1.5
			west: -123.5 // -122.0 - 1.5
		});
	});

	it('calculates bounds for multiple agencies (union)', () => {
		const agencies = [
			{
				lat: 47.5,
				lon: -122.0,
				latSpan: 2.0,
				lonSpan: 3.0
			},
			{
				lat: 48.0,
				lon: -121.5,
				latSpan: 1.0,
				lonSpan: 2.0
			}
		];

		const result = calculateBoundsFromAgencies(agencies);

		expect(result).toEqual({
			north: 48.5, // max(47.5 + 1.0, 48.0 + 0.5) = 48.5
			south: 46.5, // min(47.5 - 1.0, 48.0 - 0.5) = 46.5
			east: -120.5, // max(-122.0 + 1.5, -121.5 + 1.0) = -120.5
			west: -123.5 // min(-122.0 - 1.5, -121.5 - 1.0) = -123.5
		});
	});

	it('handles agencies with overlapping coverage areas', () => {
		const agencies = [
			{
				lat: 47.6062,
				lon: -122.3321,
				latSpan: 0.5,
				lonSpan: 0.5
			},
			{
				lat: 47.6065,
				lon: -122.3324,
				latSpan: 0.5,
				lonSpan: 0.5
			}
		];

		const result = calculateBoundsFromAgencies(agencies);

		expect(result.north).toBeCloseTo(47.8565, 2);
		expect(result.south).toBeCloseTo(47.3562, 2);
		expect(result.east).toBeCloseTo(-122.0821, 2);
		expect(result.west).toBeCloseTo(-122.5824, 2);
	});

	it('returns null for empty agencies array', () => {
		const result = calculateBoundsFromAgencies([]);
		expect(result).toBeNull();
	});

	it('returns null for null input', () => {
		const result = calculateBoundsFromAgencies(null);
		expect(result).toBeNull();
	});

	it('returns null for undefined input', () => {
		const result = calculateBoundsFromAgencies(undefined);
		expect(result).toBeNull();
	});

	it('skips agencies with missing required fields', () => {
		const agencies = [
			{
				lat: 47.5,
				lon: -122.0,
				latSpan: 2.0,
				lonSpan: 3.0
			},
			{
				lat: 48.0,
				lon: -121.5
				// Missing latSpan and lonSpan
			},
			{
				lat: 46.0,
				lon: -123.0,
				latSpan: 1.0,
				lonSpan: 1.0
			}
		];

		const result = calculateBoundsFromAgencies(agencies);

		// Should only use first and third agencies
		expect(result).toEqual({
			north: 48.5, // max(47.5 + 1.0, 46.0 + 0.5) = 48.5
			south: 45.5, // min(47.5 - 1.0, 46.0 - 0.5) = 45.5
			east: -120.5, // max(-122.0 + 1.5, -123.0 + 0.5) = -120.5
			west: -123.5 // min(-122.0 - 1.5, -123.0 - 0.5) = -123.5
		});
	});

	it('handles real Puget Sound region data', () => {
		// Realistic data from OBA Puget Sound region
		const agencies = [
			{
				lat: 47.6097,
				lon: -122.3331,
				latSpan: 1.5,
				lonSpan: 2.0
			}
		];

		const result = calculateBoundsFromAgencies(agencies);

		expect(result.north).toBeCloseTo(48.3597);
		expect(result.south).toBeCloseTo(46.8597);
		expect(result.east).toBeCloseTo(-121.3331);
		expect(result.west).toBeCloseTo(-123.3331);
	});
});

describe('calculateRadiusFromBounds', () => {
	it('calculates radius for a simple bounding box', () => {
		const bounds = {
			north: 48.0,
			south: 47.0,
			east: -121.0,
			west: -122.0
		};

		const radius = calculateRadiusFromBounds(bounds);

		// Distance from center (47.5, -121.5) to northeast corner (48.0, -121.0)
		// Should be approximately 69-70 km
		expect(radius).toBeGreaterThan(65000); // meters
		expect(radius).toBeLessThan(75000); // meters
	});

	it('calculates radius for Puget Sound region bounds', () => {
		const bounds = {
			north: 48.3597,
			south: 46.8597,
			east: -121.3331,
			west: -123.3331
		};

		const radius = calculateRadiusFromBounds(bounds);

		// Distance from center to corner should be around 110-115 km
		expect(radius).toBeGreaterThan(105000); // meters
		expect(radius).toBeLessThan(120000); // meters
	});

	it('calculates radius for a small area', () => {
		const bounds = {
			north: 47.61,
			south: 47.6,
			east: -122.32,
			west: -122.33
		};

		const radius = calculateRadiusFromBounds(bounds);

		// Small area should have small radius (around 650-750 meters)
		expect(radius).toBeGreaterThan(600);
		expect(radius).toBeLessThan(800);
	});

	it('calculates radius for a square bounding box', () => {
		const bounds = {
			north: 48.0,
			south: 47.0,
			east: -121.0,
			west: -122.0
		};

		const radius = calculateRadiusFromBounds(bounds);

		// 1 degree lat ≈ 111 km, 1 degree lon at 47.5° ≈ 75 km
		// Diagonal should be √(111² + 75²)/2 ≈ 67 km
		expect(radius).toBeGreaterThan(60000);
		expect(radius).toBeLessThan(75000);
	});

	it('handles wide east-west bounds', () => {
		const bounds = {
			north: 47.6,
			south: 47.5,
			east: -120.0,
			west: -124.0
		};

		const radius = calculateRadiusFromBounds(bounds);

		// Wide east-west, narrow north-south
		// Should be dominated by longitude span
		expect(radius).toBeGreaterThan(140000); // meters
		expect(radius).toBeLessThan(160000); // meters
	});

	it('handles tall north-south bounds', () => {
		const bounds = {
			north: 50.0,
			south: 45.0,
			east: -122.1,
			west: -122.0
		};

		const radius = calculateRadiusFromBounds(bounds);

		// Tall north-south, narrow east-west
		// Should be dominated by latitude span
		expect(radius).toBeGreaterThan(275000); // meters
		expect(radius).toBeLessThan(285000); // meters
	});
});
