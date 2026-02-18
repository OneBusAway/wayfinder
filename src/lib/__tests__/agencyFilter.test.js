import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PRIVATE_OBA_AGENCY_FILTER: ''
}));

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

import {
	getAgencyFilter,
	isAgencyFilterEnabled,
	routeBelongsToAgency,
	filterRoutes,
	filterStops,
	filterArrivals,
	filterScheduleRoutes
} from '$lib/agencyFilter.js';

describe('agencyFilter', () => {
	beforeEach(() => {
		mockEnv.PRIVATE_OBA_AGENCY_FILTER = '';
	});

	describe('getAgencyFilter', () => {
		it('returns null when env var is empty string', () => {
			mockEnv.PRIVATE_OBA_AGENCY_FILTER = '';
			expect(getAgencyFilter()).toBeNull();
		});

		it('returns null when env var is undefined', () => {
			mockEnv.PRIVATE_OBA_AGENCY_FILTER = undefined;
			expect(getAgencyFilter()).toBeNull();
		});

		it('returns Set(["19"]) when env var is "19"', () => {
			mockEnv.PRIVATE_OBA_AGENCY_FILTER = '19';
			const result = getAgencyFilter();
			expect(result).toBeInstanceOf(Set);
			expect(result).toEqual(new Set(['19']));
		});

		it('returns Set(["19", "29"]) when env var is "19,29"', () => {
			mockEnv.PRIVATE_OBA_AGENCY_FILTER = '19,29';
			const result = getAgencyFilter();
			expect(result).toEqual(new Set(['19', '29']));
		});

		it('trims whitespace', () => {
			mockEnv.PRIVATE_OBA_AGENCY_FILTER = ' 19 , 29 ';
			const result = getAgencyFilter();
			expect(result).toEqual(new Set(['19', '29']));
		});
	});

	describe('isAgencyFilterEnabled', () => {
		it('returns false when env var is empty', () => {
			mockEnv.PRIVATE_OBA_AGENCY_FILTER = '';
			expect(isAgencyFilterEnabled()).toBe(false);
		});

		it('returns true when env var is set', () => {
			mockEnv.PRIVATE_OBA_AGENCY_FILTER = '19';
			expect(isAgencyFilterEnabled()).toBe(true);
		});
	});

	describe('routeBelongsToAgency', () => {
		it('"19_100" with Set(["19"]) returns true', () => {
			expect(routeBelongsToAgency('19_100', new Set(['19']))).toBe(true);
		});

		it('"1_100" with Set(["19"]) returns false', () => {
			expect(routeBelongsToAgency('1_100', new Set(['19']))).toBe(false);
		});

		it('"19_100" with Set(["19", "29"]) returns true', () => {
			expect(routeBelongsToAgency('19_100', new Set(['19', '29']))).toBe(true);
		});

		it('null routeId returns false', () => {
			expect(routeBelongsToAgency(null, new Set(['19']))).toBe(false);
		});

		it('null agencyIds returns false', () => {
			expect(routeBelongsToAgency('19_100', null)).toBe(false);
		});
	});

	describe('filterRoutes', () => {
		const routes = [
			{ id: 'r1', agencyId: '19', shortName: '1' },
			{ id: 'r2', agencyId: '29', shortName: '2' },
			{ id: 'r3', agencyId: '19', shortName: '3' }
		];

		it('filters by route.agencyId field', () => {
			const result = filterRoutes(routes, new Set(['19']));
			expect(result).toHaveLength(2);
			expect(result.every((r) => r.agencyId === '19')).toBe(true);
		});

		it('returns all routes when agencyIds is null (passthrough)', () => {
			const result = filterRoutes(routes, null);
			expect(result).toEqual(routes);
		});

		it('returns empty array when no routes match', () => {
			const result = filterRoutes(routes, new Set(['99']));
			expect(result).toEqual([]);
		});

		it('handles empty routes array', () => {
			expect(filterRoutes([], new Set(['19']))).toEqual([]);
		});

		it('handles null routes array', () => {
			expect(filterRoutes(null, new Set(['19']))).toEqual([]);
		});
	});

	describe('filterStops', () => {
		const stops = [
			{ id: 's1', routeIds: ['19_100', '19_200'] },
			{ id: 's2', routeIds: ['29_300'] },
			{ id: 's3', routeIds: ['19_100', '29_300'] },
			{ id: 's4', routeIds: [] }
		];

		it('keeps stops where any routeIds entry prefix-matches target agency', () => {
			const result = filterStops(stops, new Set(['19']));
			expect(result).toHaveLength(2);
			expect(result.map((s) => s.id)).toEqual(['s1', 's3']);
		});

		it('removes stops with no matching routeIds', () => {
			const result = filterStops(stops, new Set(['99']));
			expect(result).toEqual([]);
		});

		it('returns all stops when agencyIds is null (passthrough)', () => {
			const result = filterStops(stops, null);
			expect(result).toEqual(stops);
		});

		it('handles stops with missing routeIds', () => {
			const stopsNoRoutes = [{ id: 's1' }, { id: 's2', routeIds: null }];
			const result = filterStops(stopsNoRoutes, new Set(['19']));
			expect(result).toEqual([]);
		});

		it('handles empty stops array', () => {
			expect(filterStops([], new Set(['19']))).toEqual([]);
		});

		it('handles null stops array', () => {
			expect(filterStops(null, new Set(['19']))).toEqual([]);
		});
	});

	describe('filterArrivals', () => {
		const arrivals = [
			{ routeId: '19_100', tripId: 't1' },
			{ routeId: '29_200', tripId: 't2' },
			{ routeId: '19_300', tripId: 't3' }
		];

		it('filters by arrival.routeId prefix', () => {
			const result = filterArrivals(arrivals, new Set(['19']));
			expect(result).toHaveLength(2);
			expect(result.every((a) => a.routeId.startsWith('19_'))).toBe(true);
		});

		it('returns all arrivals when agencyIds is null (passthrough)', () => {
			const result = filterArrivals(arrivals, null);
			expect(result).toEqual(arrivals);
		});

		it('handles empty arrays', () => {
			expect(filterArrivals([], new Set(['19']))).toEqual([]);
		});

		it('handles null array', () => {
			expect(filterArrivals(null, new Set(['19']))).toEqual([]);
		});
	});

	describe('filterScheduleRoutes', () => {
		const schedules = [
			{ routeId: '19_100', schedule: {} },
			{ routeId: '29_200', schedule: {} },
			{ routeId: '19_300', schedule: {} }
		];

		it('filters by schedule.routeId prefix', () => {
			const result = filterScheduleRoutes(schedules, new Set(['19']));
			expect(result).toHaveLength(2);
			expect(result.every((s) => s.routeId.startsWith('19_'))).toBe(true);
		});

		it('returns all schedules when agencyIds is null (passthrough)', () => {
			const result = filterScheduleRoutes(schedules, null);
			expect(result).toEqual(schedules);
		});

		it('handles empty arrays', () => {
			expect(filterScheduleRoutes([], new Set(['19']))).toEqual([]);
		});

		it('handles null array', () => {
			expect(filterScheduleRoutes(null, new Set(['19']))).toEqual([]);
		});
	});
});
