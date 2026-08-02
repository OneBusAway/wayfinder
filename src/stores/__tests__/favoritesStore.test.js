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

	function makeStop(overrides = {}) {
		return {
			type: 'stop',
			id: '1_75403',
			name: 'Pine St & 3rd Ave',
			code: '75403',
			direction: 'N',
			lat: 47.6105,
			lon: -122.3363,
			...overrides
		};
	}

	function makeRoute(overrides = {}) {
		return {
			type: 'route',
			id: '1_100479',
			shortName: '10',
			description: 'Capitol Hill - Downtown Seattle',
			routeType: 3,
			...overrides
		};
	}

	it('should add a stop favorite and persist to localStorage', () => {
		favorites.add(makeStop());

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0]).toMatchObject({
			schemaVersion: 1,
			type: 'stop',
			id: '1_75403',
			name: 'Pine St & 3rd Ave',
			code: '75403',
			direction: 'N',
			lat: 47.6105,
			lon: -122.3363
		});
		expect(value[0]).toHaveProperty('savedAt');
		expect(localStorage.setItem).toHaveBeenCalledWith('wayfinder_favorites', expect.any(String));
	});

	it('should add a route favorite keyed by full OBA id', () => {
		favorites.add(makeRoute());

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].id).toBe('1_100479');
		expect(value[0].shortName).toBe('10');
		expect(value[0].type).toBe('route');
	});

	it('should deduplicate on type+id and keep the newest first', () => {
		favorites.add(makeStop({ name: 'Old name' }));
		favorites.add(makeStop({ name: 'New name' }));

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].name).toBe('New name');
	});

	it('should allow the same numeric shortName for different route ids', () => {
		favorites.add(makeRoute({ id: '1_100', shortName: '1' }));
		favorites.add(makeRoute({ id: '40_200', shortName: '1' }));

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(2);
	});

	it('should cap at 50 favorites and drop the oldest', () => {
		for (let i = 0; i < 55; i++) {
			favorites.add(makeStop({ id: `1_${i}`, name: `Stop ${i}`, lat: i, lon: i }));
		}

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(50);
		expect(value[0].id).toBe('1_54');
		expect(value[49].id).toBe('1_5');
	});

	it('should remove a favorite by type and id', () => {
		favorites.add(makeStop());
		favorites.add(makeRoute());

		favorites.remove('stop', '1_75403');

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].type).toBe('route');
		expect(localStorage.setItem).toHaveBeenCalled();
	});

	it('should toggle a favorite on and off', () => {
		expect(favorites.toggle(makeStop())).toBe('added');
		expect(getStoreValue(favorites)).toHaveLength(1);

		expect(favorites.toggle(makeStop())).toBe('removed');
		expect(getStoreValue(favorites)).toHaveLength(0);
	});

	it('should clear all favorites and remove from localStorage', () => {
		favorites.add(makeStop());
		favorites.add(makeRoute());

		favorites.clearAll();

		expect(getStoreValue(favorites)).toHaveLength(0);
		expect(localStorage.removeItem).toHaveBeenCalledWith('wayfinder_favorites');
	});

	it('should reject stop entries with missing or non-finite coordinates', () => {
		favorites.add(makeStop({ lat: null, lon: -122 }));
		favorites.add(makeStop({ lat: undefined, lon: -122 }));
		favorites.add(makeStop({ lat: NaN, lon: -122 }));
		favorites.add(makeStop({ lat: 47.6, lon: Infinity }));
		favorites.add(makeStop({ id: '1_ok', lat: 47.6, lon: -122 }));

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].id).toBe('1_ok');
	});

	it('should accept stop coordinates at zero (equator / prime meridian)', () => {
		favorites.add(makeStop({ id: '1_zero', lat: 0, lon: 0 }));

		const value = getStoreValue(favorites);
		expect(value).toHaveLength(1);
		expect(value[0].lat).toBe(0);
		expect(value[0].lon).toBe(0);
	});

	it('should reject route entries without a shortName', () => {
		favorites.add(makeRoute({ shortName: '' }));
		favorites.add(makeRoute({ shortName: null }));
		expect(getStoreValue(favorites)).toHaveLength(0);
	});

	it('should use ?? for optional fields so empty strings are preserved', () => {
		favorites.add(makeStop({ direction: '', code: '' }));

		const value = getStoreValue(favorites);
		expect(value[0].direction).toBe('');
		expect(value[0].code).toBe('');
	});

	it('should filter out malformed entries from localStorage on load', async () => {
		const malformedData = [
			makeStop({ id: '1_good' }),
			{ type: 'stop', id: '1_bad', name: 'No coords' },
			{ type: 'route', id: '1_r', shortName: '10' },
			{ type: 'route', id: '1_bad_route' },
			null,
			'invalid'
		];
		localStorage.getItem.mockReturnValue(JSON.stringify(malformedData));

		vi.resetModules();
		const mod = await import('../../stores/favoritesStore.js');
		const value = getStoreValue(mod.favorites);

		expect(value).toHaveLength(2);
		expect(value.map((f) => f.id)).toEqual(['1_good', '1_r']);
	});

	it('should survive corrupted JSON in localStorage', async () => {
		localStorage.getItem.mockReturnValue('{not-json');

		vi.resetModules();
		const mod = await import('../../stores/favoritesStore.js');
		expect(getStoreValue(mod.favorites)).toEqual([]);
	});

	it('should not throw when localStorage.setItem exceeds quota', () => {
		localStorage.setItem.mockImplementation(() => {
			throw new DOMException('QuotaExceededError');
		});

		expect(() => favorites.add(makeStop())).not.toThrow();
		expect(getStoreValue(favorites)).toHaveLength(1);
	});

	it('should ignore add/toggle with invalid type or id', () => {
		favorites.add({ type: 'place', id: 'x', name: 'Nope', lat: 1, lon: 2 });
		expect(favorites.toggle({ type: 'stop', id: '' })).toBeNull();
		expect(favorites.toggle(null)).toBeNull();
		expect(getStoreValue(favorites)).toHaveLength(0);
	});
});
