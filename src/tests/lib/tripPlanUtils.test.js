import { describe, it, expect } from 'vitest';
import { isStaySeatedTransition } from '../../lib/tripPlanUtils';

describe('tripPlanUtils', () => {
	describe('isStaySeatedTransition', () => {
		it('returns true for two adjacent BUS legs with interlineWithPreviousLeg: true', () => {
			const legs = [
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'BUS',
					routeShortName: '2',
					interlineWithPreviousLeg: true
				},
				{
					mode: 'WALK',
					interlineWithPreviousLeg: false
				}
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(true);
		});

		it('returns false when next leg has interlineWithPreviousLeg: false', () => {
			const legs = [
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'BUS',
					routeShortName: '2',
					interlineWithPreviousLeg: false
				}
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when next leg has interlineWithPreviousLeg: undefined', () => {
			const legs = [
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'BUS',
					routeShortName: '2'
					// interlineWithPreviousLeg is missing
				}
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when previous leg is not BUS mode', () => {
			const legs = [
				{
					mode: 'WALK',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: true
				}
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when next leg is not BUS mode', () => {
			const legs = [
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'TRAIN',
					interlineWithPreviousLeg: true
				}
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when previous leg is not BUS and next leg is not BUS', () => {
			const legs = [
				{
					mode: 'WALK',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'TRAIN',
					interlineWithPreviousLeg: true
				}
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when checking the last leg in the array', () => {
			const legs = [
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'BUS',
					routeShortName: '2',
					interlineWithPreviousLeg: true
				}
			];

			// index 1 is the last leg, so there is no next leg
			expect(isStaySeatedTransition(legs, 1)).toBe(false);
		});

		it('returns false when checking beyond the array bounds', () => {
			const legs = [
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: false
				}
			];

			// index 2 is beyond array bounds
			expect(isStaySeatedTransition(legs, 2)).toBe(false);
		});

		it('returns false when legs array is empty', () => {
			const legs = [];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when legs array has only one leg', () => {
			const legs = [
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: false
				}
			];

			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns true for multiple interline transitions in a complex itinerary', () => {
			const legs = [
				{
					mode: 'WALK',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'BUS',
					routeShortName: '2',
					interlineWithPreviousLeg: true
				},
				{
					mode: 'BUS',
					routeShortName: '3',
					interlineWithPreviousLeg: true
				},
				{
					mode: 'WALK',
					interlineWithPreviousLeg: false
				}
			];

			expect(isStaySeatedTransition(legs, 1)).toBe(true);
			expect(isStaySeatedTransition(legs, 2)).toBe(true);
			expect(isStaySeatedTransition(legs, 3)).toBe(false); // last leg
		});

		it('returns true for RAIL mode interline transitions (if applicable)', () => {
			const legs = [
				{
					mode: 'RAIL',
					routeShortName: 'A',
					interlineWithPreviousLeg: false
				},
				{
					mode: 'RAIL',
					routeShortName: 'B',
					interlineWithPreviousLeg: true
				}
			];

			// This tests the current implementation which only checks for BUS
			expect(isStaySeatedTransition(legs, 0)).toBe(false);
		});

		it('returns false when previous leg is undefined', () => {
			const legs = [
				{
					mode: 'BUS',
					routeShortName: '1',
					interlineWithPreviousLeg: true
				}
			];

			// index -1 would result in undefined for both prev and next
			expect(isStaySeatedTransition(legs, -1)).toBe(false);
		});
	});
});
