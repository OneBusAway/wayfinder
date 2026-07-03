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
			maxWalkDistance: 1609,
			distanceUnit: null
		});
	});

	it('setPersisted writes non-default values to localStorage', () => {
		tripOptions.setPersisted('wheelchair', true);
		tripOptions.setPersisted('optimize', 'fewestTransfers');

		expect(getStoreValue(tripOptions).wheelchair).toBe(true);
		expect(localStorage.setItem).toHaveBeenCalledWith('tripOptions_wheelchair', 'true');
		expect(localStorage.setItem).toHaveBeenCalledWith('tripOptions_optimize', 'fewestTransfers');
	});

	it('setPersisted clears the key when the value equals the default', () => {
		// Setting a value back to its default should remove the key so the user
		// tracks future default changes instead of being pinned to today's value.
		tripOptions.setPersisted('wheelchair', false);
		tripOptions.setPersisted('optimize', 'fastest');
		tripOptions.setPersisted('maxWalkDistance', DEFAULT_TRIP_OPTIONS.maxWalkDistance);

		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_wheelchair');
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_optimize');
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_maxWalkDistance');
		expect(localStorage.setItem).not.toHaveBeenCalled();
	});

	it('setPersisted clears the key when the value is null (distanceUnit)', () => {
		tripOptions.setPersisted('distanceUnit', null);

		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_distanceUnit');
	});
});
