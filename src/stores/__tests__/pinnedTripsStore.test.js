import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { pinnedTrips, isMatch } from '../pinnedTripsStore';

describe('pinnedTripsStore', () => {
	const tripAtoB = {
		id: 'trip-1',
		fromPlace: 'Capitol Hill',
		toPlace: 'University District',
		fromCoords: { lat: 47.62, lng: -122.32 },
		toCoords: { lat: 47.66, lng: -122.31 }
	};

	const tripBtoA = {
		id: 'trip-2',
		fromPlace: 'University District',
		toPlace: 'Capitol Hill',
		fromCoords: { lat: 47.66, lng: -122.31 },
		toCoords: { lat: 47.62, lng: -122.32 }
	};

	beforeEach(() => {
		localStorage.clear();
		pinnedTrips.clearAll();
		vi.restoreAllMocks();
	});

	it('toggles a trip on and off', () => {
		expect(pinnedTrips.togglePin(tripAtoB)).toBe('pinned');
		expect(get(pinnedTrips)).toHaveLength(1);

		expect(pinnedTrips.togglePin(tripAtoB)).toBe('unpinned');
		expect(get(pinnedTrips)).toHaveLength(0);
	});

	it('removes a specific pinned trip by id', () => {
		pinnedTrips.togglePin(tripAtoB);
		pinnedTrips.togglePin(tripBtoA);
		expect(get(pinnedTrips)).toHaveLength(2);

		pinnedTrips.removeTrip('trip-1');
		expect(get(pinnedTrips)).toEqual([tripBtoA]);
	});

	it('treats A->B and B->A as distinct trips', () => {
		pinnedTrips.togglePin(tripAtoB);
		pinnedTrips.togglePin(tripBtoA);

		expect(get(pinnedTrips)).toHaveLength(2);
		expect(isMatch(tripAtoB, tripBtoA)).toBe(false);
	});

	it('returns invalid and ignores trips with missing coordinates or place names', () => {
		expect(pinnedTrips.togglePin(null)).toBe('invalid');
		expect(pinnedTrips.togglePin({ fromPlace: 'A', toPlace: 'B' })).toBe('invalid');
		expect(
			pinnedTrips.togglePin({ fromCoords: { lat: 1, lng: 1 }, toCoords: { lat: 2, lng: 2 } })
		).toBe('invalid');
		expect(get(pinnedTrips)).toHaveLength(0);
	});

	it('caps pinned trips at 20 and returns limit status without dropping oldest', () => {
		for (let i = 0; i < 20; i++) {
			const res = pinnedTrips.togglePin({
				id: `trip-${i}`,
				fromPlace: `Origin ${i}`,
				toPlace: `Dest ${i}`,
				fromCoords: { lat: 47.0 + i * 0.01, lng: -122.0 },
				toCoords: { lat: 47.5 + i * 0.01, lng: -122.5 }
			});
			expect(res).toBe('pinned');
		}

		expect(get(pinnedTrips)).toHaveLength(20);

		const extraTrip = {
			id: 'trip-21',
			fromPlace: 'Extra Origin',
			toPlace: 'Extra Dest',
			fromCoords: { lat: 48.0, lng: -122.0 },
			toCoords: { lat: 48.5, lng: -122.5 }
		};

		const status = pinnedTrips.togglePin(extraTrip);
		expect(status).toBe('limit');
		expect(get(pinnedTrips)).toHaveLength(20);
		expect(get(pinnedTrips).some((t) => t.id === 'trip-0')).toBe(true);
	});

	it('handles corrupted localStorage and filters malformed entries on load', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const getItemSpy = vi.spyOn(localStorage, 'getItem');

		getItemSpy.mockReturnValueOnce('{not-valid-json');
		vi.resetModules();
		const { pinnedTrips: freshStoreCorrupt } = await import('../pinnedTripsStore');
		expect(get(freshStoreCorrupt)).toEqual([]);

		getItemSpy.mockReturnValueOnce(
			JSON.stringify([{ id: 'bad-entry', fromCoords: { lat: 1, lng: 1 } }, tripAtoB])
		);
		vi.resetModules();
		const { pinnedTrips: freshStoreFiltered } = await import('../pinnedTripsStore');
		expect(get(freshStoreFiltered)).toEqual([tripAtoB]);

		getItemSpy.mockRestore();
		consoleSpy.mockRestore();
	});

	it('handles localStorage write errors gracefully', () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError');
		});

		expect(() => pinnedTrips.togglePin(tripAtoB)).not.toThrow();
		expect(get(pinnedTrips)).toHaveLength(1);

		setItemSpy.mockRestore();
		consoleSpy.mockRestore();
	});
});
