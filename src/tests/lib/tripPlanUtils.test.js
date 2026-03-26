import { describe, it, expect } from 'vitest';
import { isStaySeatedTransition, getRouteName } from '$lib/tripPlanUtils';

describe('tripPlanUtils', () => {
	describe('isStaySeatedTransition', () => {
		it('returns true for two adjacent BUS legs with interlineWithPreviousLeg: true', () => {
			const legs = [
				{ mode: 'BUS', interlineWithPreviousLeg: false },
				{ mode: 'BUS', interlineWithPreviousLeg: true },
				{ mode: 'WALK', interlineWithPreviousLeg: false }
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(true);
		});

		it('returns false when next leg has interlineWithPreviousLeg: false', () => {
			const legs = [
				{ mode: 'BUS', interlineWithPreviousLeg: false },
				{ mode: 'BUS', interlineWithPreviousLeg: false }
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when next leg has interlineWithPreviousLeg: undefined', () => {
			const legs = [{ mode: 'BUS', interlineWithPreviousLeg: false }, { mode: 'BUS' }];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when previous leg is WALK', () => {
			const legs = [
				{ mode: 'WALK', interlineWithPreviousLeg: false },
				{ mode: 'BUS', interlineWithPreviousLeg: true }
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when next leg is WALK even with interlineWithPreviousLeg: true', () => {
			const legs = [
				{ mode: 'BUS', interlineWithPreviousLeg: false },
				{ mode: 'WALK', interlineWithPreviousLeg: true }
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when modes differ', () => {
			const legs = [
				{ mode: 'BUS', interlineWithPreviousLeg: false },
				{ mode: 'TRAIN', interlineWithPreviousLeg: true }
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when both legs are non-BUS non-matching modes', () => {
			const legs = [
				{ mode: 'WALK', interlineWithPreviousLeg: false },
				{ mode: 'TRAIN', interlineWithPreviousLeg: true }
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when checking the last leg in the array', () => {
			const legs = [
				{ mode: 'BUS', interlineWithPreviousLeg: false },
				{ mode: 'BUS', interlineWithPreviousLeg: true }
			];

			expect(isStaySeatedTransition(legs, 1)).toBe(false);
		});

		it('returns false when checking beyond the array bounds', () => {
			const legs = [{ mode: 'BUS', interlineWithPreviousLeg: false }];

			expect(isStaySeatedTransition(legs, 2)).toBe(false);
		});

		it('returns false when legs array is empty', () => {
			expect(isStaySeatedTransition([], 0)).toBe(false);
		});

		it('returns false when legs array has only one leg', () => {
			const legs = [{ mode: 'BUS', interlineWithPreviousLeg: false }];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns true for multiple interline transitions in a complex itinerary', () => {
			const legs = [
				{ mode: 'WALK', interlineWithPreviousLeg: false },
				{ mode: 'BUS', interlineWithPreviousLeg: false },
				{ mode: 'BUS', interlineWithPreviousLeg: true },
				{ mode: 'BUS', interlineWithPreviousLeg: true },
				{ mode: 'WALK', interlineWithPreviousLeg: false }
			];

			expect(isStaySeatedTransition(legs, 1)).toBe(true);
			expect(isStaySeatedTransition(legs, 2)).toBe(true);
			expect(isStaySeatedTransition(legs, 3)).toBe(false);
		});

		it('returns true for RAIL mode interline transitions', () => {
			const legs = [
				{ mode: 'RAIL', interlineWithPreviousLeg: false },
				{ mode: 'RAIL', interlineWithPreviousLeg: true }
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(true);
		});

		it('returns false when index is negative', () => {
			const legs = [{ mode: 'BUS', interlineWithPreviousLeg: true }];

			expect(isStaySeatedTransition(legs, -1)).toBe(false);
		});
	});

	describe('getRouteName', () => {
		it('returns empty string for null leg', () => {
			expect(getRouteName(null)).toBe('');
		});

		it('returns empty string for undefined leg', () => {
			expect(getRouteName(undefined)).toBe('');
		});

		it('returns routeShortName and headsign when both are present', () => {
			const leg = { routeShortName: '44', routeLongName: 'Ballard', headsign: 'Downtown' };
			expect(getRouteName(leg)).toBe('44 - Downtown');
		});

		it('falls back to routeLongName when routeShortName is missing but headsign is present', () => {
			const leg = { routeLongName: 'Ballard Express', headsign: 'Downtown' };
			expect(getRouteName(leg)).toBe('Ballard Express - Downtown');
		});

		it('returns routeShortName when headsign is absent', () => {
			const leg = { routeShortName: '44', routeLongName: 'Ballard' };
			expect(getRouteName(leg)).toBe('44');
		});

		it('returns routeLongName when both routeShortName and headsign are absent', () => {
			const leg = { routeLongName: 'Ballard Express' };
			expect(getRouteName(leg)).toBe('Ballard Express');
		});

		it('returns empty string when all route fields are missing', () => {
			const leg = { mode: 'BUS' };
			expect(getRouteName(leg)).toBe('');
		});

		it('returns headsign alone when both route names are missing', () => {
			const leg = { headsign: 'Downtown' };
			expect(getRouteName(leg)).toBe('Downtown');
		});

		it('uses headsign not tripHeadsign', () => {
			const leg = { routeShortName: '44', tripHeadsign: 'Via Pike', headsign: 'Downtown' };
			expect(getRouteName(leg)).toBe('44 - Downtown');
		});
	});
});
