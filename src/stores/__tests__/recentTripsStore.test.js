import { describe, it, expect, beforeEach, vi } from 'vitest';

// Override the global vitest-setup mock: store tests need browser = true
// so localStorage calls actually execute
vi.mock('$app/environment', () => ({
	browser: true
}));

// fresh store for each test, so we use dynamic import + resetModules
describe('recentTripsStore', () => {
	let recentTrips;

	beforeEach(async () => {
		// Clear localStorage mock state
		localStorage.getItem.mockReset();
		localStorage.setItem.mockReset();
		localStorage.removeItem.mockReset();
		localStorage.clear.mockReset();
		localStorage.getItem.mockReturnValue(null);

		// Reset modules so createRecentTripsStore() runs fresh each time
		vi.resetModules();
		const mod = await import('../../stores/recentTripsStore.js');
		recentTrips = mod.recentTrips;
	});

	// Helper to read the current store value
	function getStoreValue(store) {
		let value;
		store.subscribe((v) => (value = v))();
		return value;
	}

	// Helper to create a minimal trip object
	function makeTripInput(from, to, fromLat = 1, toLat = 2) {
		return {
			fromPlace: from,
			toPlace: to,
			selectedFrom: { lat: fromLat, lng: -122 },
			selectedTo: { lat: toLat, lng: -122 }
		};
	}

	it('should add a trip and persist to localStorage', () => {
		recentTrips.addTrip(makeTripInput('Capitol Hill', 'UDistrict'));

		const value = getStoreValue(recentTrips);
		expect(value).toHaveLength(1);
		expect(value[0].fromPlace).toBe('Capitol Hill');
		expect(value[0].toPlace).toBe('UDistrict');
		expect(value[0]).toHaveProperty('id');
		expect(value[0]).toHaveProperty('timestamp');

		// Verify localStorage.setItem was called with the correct key
		expect(localStorage.setItem).toHaveBeenCalledWith('wayfinder_recent_trips', expect.any(String));
	});

	it('should limit to 3 recent trips (LIFO)', () => {
		for (let i = 0; i < 5; i++) {
			recentTrips.addTrip(makeTripInput(`From ${i}`, `To ${i}`, i * 10, i * 10 + 1));
		}

		const value = getStoreValue(recentTrips);
		expect(value).toHaveLength(3);
		// Most recent trip should be first
		expect(value[0].fromPlace).toBe('From 4');
		expect(value[1].fromPlace).toBe('From 3');
		expect(value[2].fromPlace).toBe('From 2');
	});

	it('should deduplicate by matching from/to coordinates', () => {
		// Add a trip
		recentTrips.addTrip(makeTripInput('Capitol Hill', 'UDistrict', 47.62, 47.66));

		// Add a trip with same coords but different name
		recentTrips.addTrip(makeTripInput('Cap Hill (renamed)', 'UDistrict', 47.62, 47.66));

		const value = getStoreValue(recentTrips);
		expect(value).toHaveLength(1);
		// Should keep the most recent version
		expect(value[0].fromPlace).toBe('Cap Hill (renamed)');
	});

	it('should remove a trip by ID and update localStorage', () => {
		recentTrips.addTrip(makeTripInput('A', 'B'));
		recentTrips.addTrip(makeTripInput('C', 'D', 3, 4));

		let value = getStoreValue(recentTrips);
		expect(value).toHaveLength(2);

		const idToRemove = value[0].id;
		recentTrips.removeTrip(idToRemove);

		value = getStoreValue(recentTrips);
		expect(value).toHaveLength(1);
		expect(value[0].fromPlace).toBe('A');

		// Verify localStorage was updated
		expect(localStorage.setItem).toHaveBeenCalled();
	});

	it('should clear all trips and remove from localStorage', () => {
		recentTrips.addTrip(makeTripInput('A', 'B'));
		recentTrips.addTrip(makeTripInput('C', 'D', 3, 4));

		recentTrips.clearAll();

		const value = getStoreValue(recentTrips);
		expect(value).toHaveLength(0);
		expect(localStorage.removeItem).toHaveBeenCalledWith('wayfinder_recent_trips');
	});
});
