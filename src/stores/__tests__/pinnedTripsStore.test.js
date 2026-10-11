import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
        clear: vi.fn(() => { store = {}; })
    };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });
vi.stubGlobal('alert', vi.fn());
vi.stubGlobal('crypto', { randomUUID: () => `id-${Date.now()}` });

describe('pinnedTripsStore', async () => {
    let pinnedTrips;
    let isMatch;

    const mockTripAtoB = { fromPlace: 'A', toPlace: 'B', fromCoords: { lat: 1, lng: 1 }, toCoords: { lat: 2, lng: 2 } };
    const mockTripBtoA = { fromPlace: 'B', toPlace: 'A', fromCoords: { lat: 2, lng: 2 }, toCoords: { lat: 1, lng: 1 } };
    const incompleteTrip = { fromPlace: 'A', toPlace: 'B', fromCoords: { lat: 1, lng: 1 } }; // missing toCoords

    beforeEach(async () => {
        localStorageMock.clear();
        vi.clearAllMocks();
        vi.resetModules();
        const module = await import('../pinnedTripsStore');
        pinnedTrips = module.pinnedTrips;
        isMatch = module.isMatch;
    });

    it('distinguishes between A→B and B→A trips (isMatch)', () => {
        expect(isMatch(mockTripAtoB, mockTripBtoA)).toBe(false);
        expect(isMatch(mockTripAtoB, mockTripAtoB)).toBe(true);
    });

    it('toggles a pin on and off', () => {
        pinnedTrips.togglePin(mockTripAtoB);
        expect(get(pinnedTrips).length).toBe(1);

        pinnedTrips.togglePin(mockTripAtoB);
        expect(get(pinnedTrips).length).toBe(0);
    });

    it('does not pin a trip with missing coordinates', () => {
        pinnedTrips.togglePin(incompleteTrip);
        expect(get(pinnedTrips).length).toBe(0);
    });

    it('blocks pinning past the 20-item cap', () => {
        for (let i = 0; i < 20; i++) {
            pinnedTrips.togglePin({ fromPlace: `Start ${i}`, toPlace: 'End', fromCoords: { lat: i, lng: 0 }, toCoords: { lat: 0, lng: 0 } });
        }
        
        pinnedTrips.togglePin(mockTripAtoB);
        expect(get(pinnedTrips).length).toBe(20);
        expect(global.alert).toHaveBeenCalled();
    });

    it('handles localStorage write errors gracefully', () => {
        localStorageMock.setItem.mockImplementationOnce(() => { throw new Error('Quota exceeded'); });
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        expect(() => pinnedTrips.togglePin(mockTripAtoB)).not.toThrow();
        expect(get(pinnedTrips).length).toBe(1);
        expect(consoleWarnSpy).toHaveBeenCalled();
    });
});