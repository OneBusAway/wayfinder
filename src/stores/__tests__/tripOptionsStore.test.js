import { describe, it, expect, beforeEach, vi } from 'vitest';

// Override the global vitest-setup mock: store tests need browser = true
// so localStorage calls actually execute
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('tripOptionsStore', () => {
	let tripOptions;
	let DEFAULT_TRIP_OPTIONS;

	beforeEach(async () => {
		localStorage.getItem.mockReset();
		localStorage.setItem.mockReset();
		localStorage.removeItem.mockReset();
		localStorage.clear.mockReset();
		localStorage.getItem.mockReturnValue(null);

		vi.resetModules();
		const mod = await import('../../stores/tripOptionsStore.js');
		tripOptions = mod.tripOptions;
		DEFAULT_TRIP_OPTIONS = mod.DEFAULT_TRIP_OPTIONS;
	});

	function getStoreValue(store) {
		let value;
		store.subscribe((v) => (value = v))();
		return value;
	}

	it('exposes the default option values', () => {
		expect(DEFAULT_TRIP_OPTIONS).toMatchObject({
			departureType: 'now',
			departureTime: null,
			departureDate: null,
			wheelchair: false,
			optimize: 'fastest',
			distanceUnit: null
		});
	});

	it('resetAll restores defaults and clears persisted values', () => {
		tripOptions.setPersisted('wheelchair', true);
		tripOptions.setPersisted('optimize', 'fewestTransfers');
		tripOptions.setSession('departureType', 'arriveBy');

		let value = getStoreValue(tripOptions);
		expect(value.wheelchair).toBe(true);
		expect(value.optimize).toBe('fewestTransfers');
		expect(value.departureType).toBe('arriveBy');

		tripOptions.resetAll();

		value = getStoreValue(tripOptions);
		expect(value.wheelchair).toBe(false);
		expect(value.optimize).toBe('fastest');
		expect(value.departureType).toBe('now');

		// Persisted keys are removed from localStorage
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_wheelchair');
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_optimize');
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_maxWalkDistance');
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_distanceUnit');
	});
});
