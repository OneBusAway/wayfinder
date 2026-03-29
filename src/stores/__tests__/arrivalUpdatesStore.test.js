import { describe, it, expect, beforeEach, vi } from 'vitest';
import { arrivalUpdatesStore } from '../arrivalUpdatesStore';

describe('arrivalUpdatesStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		arrivalUpdatesStore.stopPolling();
	});

	it('initializes with polling stopped', () => {
		let isPollingValue = false;
		const unsubscribe = arrivalUpdatesStore.isPolling.subscribe((value) => {
			isPollingValue = value;
		});

		expect(isPollingValue).toBe(false);
		unsubscribe();
	});

	it('detects new arrivals', () => {
		const oldArrivals = [
			{ tripId: '1', arrivalTime: 1000 },
			{ tripId: '2', arrivalTime: 2000 }
		];

		const newArrivals = [
			{ tripId: '1', arrivalTime: 1000 },
			{ tripId: '2', arrivalTime: 2000 },
			{ tripId: '3', arrivalTime: 3000 }
		];

		arrivalUpdatesStore.updateArrivals(oldArrivals, newArrivals);

		let newArrivalsValue = [];
		const unsubscribe = arrivalUpdatesStore.newArrivals.subscribe((value) => {
			newArrivalsValue = value;
		});

		expect(newArrivalsValue).toHaveLength(1);
		expect(newArrivalsValue[0].tripId).toBe('3');
		unsubscribe();
	});

	it('detects removed arrivals', () => {
		const oldArrivals = [
			{ tripId: '1', arrivalTime: 1000 },
			{ tripId: '2', arrivalTime: 2000 },
			{ tripId: '3', arrivalTime: 3000 }
		];

		const newArrivals = [
			{ tripId: '1', arrivalTime: 1000 },
			{ tripId: '2', arrivalTime: 2000 }
		];

		arrivalUpdatesStore.updateArrivals(oldArrivals, newArrivals);

		let removedArrivalsValue = [];
		const unsubscribe = arrivalUpdatesStore.removedArrivals.subscribe((value) => {
			removedArrivalsValue = value;
		});

		expect(removedArrivalsValue).toHaveLength(1);
		expect(removedArrivalsValue[0].tripId).toBe('3');
		unsubscribe();
	});

	it('clears diff after update', () => {
		const oldArrivals = [{ tripId: '1', arrivalTime: 1000 }];
		const newArrivals = [
			{ tripId: '1', arrivalTime: 1000 },
			{ tripId: '2', arrivalTime: 2000 }
		];

		arrivalUpdatesStore.updateArrivals(oldArrivals, newArrivals);
		arrivalUpdatesStore.clearDiff();

		let newArrivalsValue = [];
		let removedArrivalsValue = [];

		arrivalUpdatesStore.newArrivals.subscribe((value) => {
			newArrivalsValue = value;
		})();

		arrivalUpdatesStore.removedArrivals.subscribe((value) => {
			removedArrivalsValue = value;
		})();

		expect(newArrivalsValue).toHaveLength(0);
		expect(removedArrivalsValue).toHaveLength(0);
	});

	it('stores previous arrivals', () => {
		const arrivals = [
			{ tripId: '1', arrivalTime: 1000 },
			{ tripId: '2', arrivalTime: 2000 }
		];

		arrivalUpdatesStore.updateArrivals([], arrivals);

		let previousArrivalsValue = [];
		const unsubscribe = arrivalUpdatesStore.previousArrivals.subscribe((value) => {
			previousArrivalsValue = value;
		});

		expect(previousArrivalsValue).toEqual(arrivals);
		unsubscribe();
	});

	it('handles empty arrivals gracefully', () => {
		const oldArrivals = [{ tripId: '1', arrivalTime: 1000 }];

		arrivalUpdatesStore.updateArrivals(oldArrivals, []);

		let removedArrivalsValue = [];
		const unsubscribe = arrivalUpdatesStore.removedArrivals.subscribe((value) => {
			removedArrivalsValue = value;
		});

		expect(removedArrivalsValue).toHaveLength(1);
		unsubscribe();
	});

	it('updates lastUpdated timestamp', () => {
		const initialTime = new Date();
		let lastUpdatedValue = null;

		const unsubscribe = arrivalUpdatesStore.lastUpdated.subscribe((value) => {
			lastUpdatedValue = value;
		});

		arrivalUpdatesStore.updateArrivals([], [{ tripId: '1', arrivalTime: 1000 }]);

		expect(lastUpdatedValue).toBeTruthy();
		expect(lastUpdatedValue.getTime()).toBeGreaterThanOrEqual(initialTime.getTime());
		unsubscribe();
	});

	it('uses trip ID or item ID for comparison', () => {
		const oldArrivals = [
			{ id: 'item1', arrivalTime: 1000 },
			{ id: 'item2', arrivalTime: 2000 }
		];

		const newArrivals = [
			{ id: 'item1', arrivalTime: 1000 },
			{ id: 'item2', arrivalTime: 2000 },
			{ id: 'item3', arrivalTime: 3000 }
		];

		arrivalUpdatesStore.updateArrivals(oldArrivals, newArrivals);

		let newArrivalsValue = [];
		const unsubscribe = arrivalUpdatesStore.newArrivals.subscribe((value) => {
			newArrivalsValue = value;
		});

		expect(newArrivalsValue).toHaveLength(1);
		expect(newArrivalsValue[0].id).toBe('item3');
		unsubscribe();
	});
});
