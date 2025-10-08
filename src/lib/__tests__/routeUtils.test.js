import { describe, it, expect } from 'vitest';
import {
	extractNumericValue,
	compareRoutes,
	matchesQuery,
	filterAndSortRoutes
} from '../routeUtils';

describe('routeUtils', () => {
	describe('extractNumericValue', () => {
		it('should extract numeric value from route shortName', () => {
			expect(extractNumericValue({ shortName: '44' })).toBe(44);
			expect(extractNumericValue({ shortName: '7' })).toBe(7);
			expect(extractNumericValue({ shortName: '100' })).toBe(100);
		});

		it('should extract first numeric value from mixed strings', () => {
			expect(extractNumericValue({ shortName: 'Route 7' })).toBe(7);
			expect(extractNumericValue({ shortName: 'Bus 44 Express' })).toBe(44);
			expect(extractNumericValue({ shortName: '99 North' })).toBe(99);
		});

		it('should return MAX_SAFE_INTEGER for non-numeric routes', () => {
			expect(extractNumericValue({ shortName: 'B Line' })).toBe(Number.MAX_SAFE_INTEGER);
			expect(extractNumericValue({ shortName: 'RapidRide' })).toBe(Number.MAX_SAFE_INTEGER);
			expect(extractNumericValue({ shortName: 'Express' })).toBe(Number.MAX_SAFE_INTEGER);
		});

		it('should return MAX_SAFE_INTEGER for missing shortName', () => {
			expect(extractNumericValue({ shortName: null })).toBe(Number.MAX_SAFE_INTEGER);
			expect(extractNumericValue({ shortName: undefined })).toBe(Number.MAX_SAFE_INTEGER);
			expect(extractNumericValue({ shortName: '' })).toBe(Number.MAX_SAFE_INTEGER);
			expect(extractNumericValue({})).toBe(Number.MAX_SAFE_INTEGER);
			expect(extractNumericValue(null)).toBe(Number.MAX_SAFE_INTEGER);
		});
	});

	describe('compareRoutes', () => {
		it('should sort routes numerically when both have numeric values', () => {
			const route7 = { shortName: '7' };
			const route44 = { shortName: '44' };
			const route100 = { shortName: '100' };

			expect(compareRoutes(route7, route44)).toBeLessThan(0);
			expect(compareRoutes(route44, route7)).toBeGreaterThan(0);
			expect(compareRoutes(route7, route100)).toBeLessThan(0);
			expect(compareRoutes(route100, route44)).toBeGreaterThan(0);
		});

		it('should sort alphabetically when numeric values are equal', () => {
			const routeA = { shortName: 'A Line' };
			const routeB = { shortName: 'B Line' };

			expect(compareRoutes(routeA, routeB)).toBeLessThan(0);
			expect(compareRoutes(routeB, routeA)).toBeGreaterThan(0);
		});

		it('should place numeric routes before non-numeric routes', () => {
			const route7 = { shortName: '7' };
			const routeB = { shortName: 'B Line' };

			expect(compareRoutes(route7, routeB)).toBeLessThan(0);
			expect(compareRoutes(routeB, route7)).toBeGreaterThan(0);
		});

		it('should handle routes without shortName', () => {
			const route7 = { shortName: '7' };
			const routeNoName = {};

			expect(compareRoutes(route7, routeNoName)).toBeLessThan(0);
			expect(compareRoutes(routeNoName, route7)).toBeGreaterThan(0);
		});

		it('should return 0 for identical routes', () => {
			const route1 = { shortName: '44' };
			const route2 = { shortName: '44' };

			expect(compareRoutes(route1, route2)).toBe(0);
		});
	});

	describe('matchesQuery', () => {
		const route = {
			shortName: '44',
			longName: 'University District',
			description: 'Ballard to University District',
			agencyInfo: { name: 'King County Metro' }
		};

		it('should match query against shortName', () => {
			expect(matchesQuery(route, '44')).toBe(true);
			expect(matchesQuery(route, '4')).toBe(true);
			expect(matchesQuery(route, '7')).toBe(false);
		});

		it('should match query against longName', () => {
			expect(matchesQuery(route, 'university')).toBe(true);
			expect(matchesQuery(route, 'UNIVERSITY')).toBe(true);
			expect(matchesQuery(route, 'district')).toBe(true);
		});

		it('should match query against description', () => {
			expect(matchesQuery(route, 'ballard')).toBe(true);
			expect(matchesQuery(route, 'BALLARD')).toBe(true);
			expect(matchesQuery(route, 'to')).toBe(true);
		});

		it('should match query against agency name', () => {
			expect(matchesQuery(route, 'king')).toBe(true);
			expect(matchesQuery(route, 'metro')).toBe(true);
			expect(matchesQuery(route, 'COUNTY')).toBe(true);
		});

		it('should be case-insensitive', () => {
			expect(matchesQuery(route, 'BALLARD')).toBe(true);
			expect(matchesQuery(route, 'ballard')).toBe(true);
			expect(matchesQuery(route, 'BaLLaRd')).toBe(true);
		});

		it('should return true for empty query', () => {
			expect(matchesQuery(route, '')).toBe(true);
			expect(matchesQuery(route, null)).toBe(true);
			expect(matchesQuery(route, undefined)).toBe(true);
		});

		it('should return false when query does not match', () => {
			expect(matchesQuery(route, 'xyz')).toBe(false);
			expect(matchesQuery(route, '999')).toBe(false);
			expect(matchesQuery(route, 'random')).toBe(false);
		});

		it('should handle routes with missing fields', () => {
			const minimalRoute = { shortName: '7' };
			expect(matchesQuery(minimalRoute, '7')).toBe(true);
			expect(matchesQuery(minimalRoute, 'ballard')).toBe(false);

			const noShortName = { description: 'Express Route' };
			expect(matchesQuery(noShortName, 'express')).toBe(true);
		});

		it('should prioritize description when longName is missing', () => {
			const routeNoLongName = {
				shortName: '7',
				description: 'Rainier Valley',
				agencyInfo: { name: 'Metro' }
			};
			expect(matchesQuery(routeNoLongName, 'rainier')).toBe(true);
		});
	});

	describe('filterAndSortRoutes', () => {
		const routes = [
			{ shortName: '44', description: 'Ballard' },
			{ shortName: '7', description: 'Rainier' },
			{ shortName: '100', description: 'Express' },
			{ shortName: 'B Line', description: 'RapidRide' },
			{ shortName: 'A Line', description: 'RapidRide South' },
			{ shortName: '8', description: 'Capitol Hill' }
		];

		it('should filter and sort routes by query', () => {
			const result = filterAndSortRoutes(routes, 'line');
			expect(result).toHaveLength(2);
			expect(result[0].shortName).toBe('A Line');
			expect(result[1].shortName).toBe('B Line');
		});

		it('should return all routes sorted when query is empty', () => {
			const result = filterAndSortRoutes(routes, '');
			expect(result).toHaveLength(6);
			// Numeric routes should come first, sorted numerically
			expect(result[0].shortName).toBe('7');
			expect(result[1].shortName).toBe('8');
			expect(result[2].shortName).toBe('44');
			expect(result[3].shortName).toBe('100');
			// Non-numeric routes should come last, sorted alphabetically
			expect(result[4].shortName).toBe('A Line');
			expect(result[5].shortName).toBe('B Line');
		});

		it('should filter by description', () => {
			const result = filterAndSortRoutes(routes, 'rapidride');
			expect(result).toHaveLength(2);
			expect(result[0].shortName).toBe('A Line');
			expect(result[1].shortName).toBe('B Line');
		});

		it('should return empty array for non-matching query', () => {
			const result = filterAndSortRoutes(routes, 'nonexistent');
			expect(result).toHaveLength(0);
		});

		it('should handle empty routes array', () => {
			const result = filterAndSortRoutes([], 'test');
			expect(result).toHaveLength(0);
		});

		it('should handle null or undefined routes', () => {
			expect(filterAndSortRoutes(null, 'test')).toEqual([]);
			expect(filterAndSortRoutes(undefined, 'test')).toEqual([]);
		});

		it('should maintain route objects unchanged', () => {
			const result = filterAndSortRoutes(routes, '44');
			expect(result[0]).toBe(routes[0]);
		});

		it('should handle numeric queries', () => {
			const result = filterAndSortRoutes(routes, '7');
			expect(result).toHaveLength(1);
			expect(result[0].shortName).toBe('7');
		});

		it('should filter by partial matches', () => {
			const result = filterAndSortRoutes(routes, 'ball');
			expect(result).toHaveLength(1);
			expect(result[0].description).toBe('Ballard');
		});
	});

	describe('Integration tests', () => {
		it('should handle real-world route data', () => {
			const realWorldRoutes = [
				{
					shortName: 'C Line',
					longName: 'RapidRide C Line',
					description: 'West Seattle to Downtown',
					agencyInfo: { name: 'King County Metro' }
				},
				{
					shortName: '40',
					longName: 'Fremont to Downtown',
					description: 'Fremont to Downtown',
					agencyInfo: { name: 'King County Metro' }
				},
				{
					shortName: '62',
					description: 'Roosevelt to Georgetown',
					agencyInfo: { name: 'King County Metro' }
				},
				{
					shortName: 'Link Light Rail',
					description: 'Northgate to Angle Lake',
					agencyInfo: { name: 'Sound Transit' }
				}
			];

			// Filter by agency
			const metroRoutes = filterAndSortRoutes(realWorldRoutes, 'metro');
			expect(metroRoutes).toHaveLength(3);

			// Filter by description
			const downtownRoutes = filterAndSortRoutes(realWorldRoutes, 'downtown');
			expect(downtownRoutes).toHaveLength(2);

			// All routes sorted
			const allRoutes = filterAndSortRoutes(realWorldRoutes, '');
			expect(allRoutes[0].shortName).toBe('40'); // Numeric first
			expect(allRoutes[1].shortName).toBe('62');
			expect(allRoutes[2].shortName).toBe('C Line'); // Alphabetical last
		});
	});
});
