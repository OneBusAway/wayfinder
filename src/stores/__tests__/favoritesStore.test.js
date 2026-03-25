import { describe, it, expect, beforeEach, vi } from 'vitest';

// Override the global vitest-setup mock: store tests need browser = true
// so localStorage calls actually execute
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('favoritesStore', () => {
	let favorites;

	beforeEach(async () => {
		localStorage.getItem.mockReset();
		localStorage.setItem.mockReset();
		localStorage.removeItem.mockReset();
		localStorage.clear.mockReset();
		localStorage.getItem.mockReturnValue(null);

		vi.resetModules();
		const mod = await import('../../stores/favoritesStore.js');
		favorites = mod.favorites;
	});

	function getStoreValue(store) {
		let value;
		store.subscribe((v) => (value = v))();
		return value;
	}

	function makeStopInput(entityId = '1_75403', name = 'Pine St & 3rd Ave') {
		return {
			type: 'stop',
			entityId,
			name,
			direction: 'N',
			coords: { lat: 47.61, lng: -122.33 }
		};
	}

	function makeRouteInput(entityId = '1_100479', name = 'Route 10 - Capitol Hill') {
		return {
			type: 'route',
			entityId,
			name
		};
	}

	it('should add a stop favorite and persist to localStorage', () => {
		favorites.addFavorite(makeStopInput());

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].type).toBe('stop');
		expect(value[0].entityId).toBe('1_75403');
		expect(value[0].name).toBe('Pine St & 3rd Ave');
		expect(value[0].direction).toBe('N');
		expect(value[0].coords).toEqual({ lat: 47.61, lng: -122.33 });
		expect(value[0]).toHaveProperty('id');
		expect(value[0]).toHaveProperty('timestamp');

		expect(localStorage.setItem).toHaveBeenCalledWith('wayfinder_favorites', expect.any(String));
	});

	it('should add a route favorite and persist to localStorage', () => {
		favorites.addFavorite(makeRouteInput());

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].type).toBe('route');
		expect(value[0].entityId).toBe('1_100479');
		expect(value[0].direction).toBeNull();
		expect(value[0].coords).toBeNull();

		expect(localStorage.setItem).toHaveBeenCalledWith('wayfinder_favorites', expect.any(String));
	});

	it('should order favorites LIFO (newest first)', () => {
		favorites.addFavorite(makeStopInput('1_001', 'First'));
		favorites.addFavorite(makeStopInput('1_002', 'Second'));
		favorites.addFavorite(makeStopInput('1_003', 'Third'));

		const value = getStoreValue(favorites);
		expect(value[0].name).toBe('Third');
		expect(value[1].name).toBe('Second');
		expect(value[2].name).toBe('First');
	});

	it('should not enforce a max limit', () => {
		for (let i = 0; i < 20; i++) {
			favorites.addFavorite(makeStopInput(`1_${i}`, `Stop ${i}`));
		}

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(20);
	});

	it('should deduplicate by type + entityId', () => {
		favorites.addFavorite(makeStopInput('1_75403', 'Old Name'));
		favorites.addFavorite(makeStopInput('1_75403', 'New Name'));

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].name).toBe('New Name');
	});

	it('should allow same entityId with different types', () => {
		favorites.addFavorite(makeStopInput('1_75403', 'Stop'));
		favorites.addFavorite(makeRouteInput('1_75403', 'Route'));

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(2);
	});

	it('should remove a favorite by ID', () => {
		favorites.addFavorite(makeStopInput('1_001', 'A'));
		favorites.addFavorite(makeStopInput('1_002', 'B'));

		let value = getStoreValue(favorites);
		expect(value).toHaveLength(2);

		const idToRemove = value[0].id;
		favorites.removeFavorite(idToRemove);

		value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].name).toBe('A');

		expect(localStorage.setItem).toHaveBeenCalled();
	});

	it('should return true from isFavorite for existing entries', () => {
		favorites.addFavorite(makeStopInput('1_75403', 'Pine St'));

		expect(favorites.isFavorite('stop', '1_75403')).toBe(true);
	});

	it('should return false from isFavorite for non-existing entries', () => {
		favorites.addFavorite(makeStopInput('1_75403', 'Pine St'));

		expect(favorites.isFavorite('stop', '1_99999')).toBe(false);
		expect(favorites.isFavorite('route', '1_75403')).toBe(false);
	});

	it('should clear all favorites and remove from localStorage', () => {
		favorites.addFavorite(makeStopInput('1_001', 'A'));
		favorites.addFavorite(makeStopInput('1_002', 'B'));

		favorites.clearAll();

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(0);
		expect(localStorage.removeItem).toHaveBeenCalledWith('wayfinder_favorites');
	});

	it('should handle missing optional fields gracefully', () => {
		favorites.addFavorite({ type: 'stop', entityId: '1_123', name: 'Bare Stop' });

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].direction).toBeNull();
		expect(value[0].coords).toBeNull();
	});

	it('should filter out malformed entries from localStorage on load', async () => {
		const malformedData = [
			{ id: '1', type: 'stop', entityId: '1_75403', name: 'Good Stop', timestamp: 1000 },
			{ id: '2', type: 'stop' },
			{ id: '3', type: 'invalid', entityId: 'x', name: 'Bad Type', timestamp: 1 },
			null,
			'string entry',
			{ id: '4', type: 'route', entityId: '1_100', name: 'Good Route', timestamp: 2000 }
		];
		localStorage.getItem.mockReturnValue(JSON.stringify(malformedData));

		vi.resetModules();
		const mod = await import('../../stores/favoritesStore.js');
		const store = mod.favorites;

		const value = getStoreValue(store);
		expect(value).toHaveLength(2);
		expect(value[0].entityId).toBe('1_75403');
		expect(value[1].entityId).toBe('1_100');
	});

	it('should handle corrupted JSON in localStorage on load', async () => {
		localStorage.getItem.mockReturnValue('not valid json {{');

		vi.resetModules();
		const mod = await import('../../stores/favoritesStore.js');
		const store = mod.favorites;

		const value = getStoreValue(store);
		expect(value).toHaveLength(0);
		expect(console.warn).toHaveBeenCalled();
	});

	it('should not crash when localStorage.setItem throws', () => {
		localStorage.setItem.mockImplementation(() => {
			throw new Error('QuotaExceeded');
		});

		expect(() => {
			favorites.addFavorite(makeStopInput());
		}).not.toThrow();

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
	});
});
