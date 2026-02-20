import { describe, it, expect, beforeEach, vi } from 'vitest';
import { swapTripLocations } from '$lib/tripPlanUtils';

describe('tripPlanUtils', () => {
	describe('swapTripLocations', () => {
		let mockMapProvider;
		let mockT;

		beforeEach(() => {
			// Mock map provider
			mockMapProvider = {
				addPinMarker: vi.fn((coords, label) => ({ id: `marker-${label}`, coords, label })),
				removePinMarker: vi.fn()
			};

			// Mock translation function
			mockT = vi.fn((key) => {
				const translations = {
					'trip-planner.from': 'From',
					'trip-planner.to': 'To'
				};
				return translations[key] || key;
			});
		});

		it('should swap text values when both are populated', () => {
			const result = swapTripLocations({
				fromPlace: 'Capitol Hill',
				toPlace: 'University District',
				selectedFrom: null,
				selectedTo: null,
				fromMarker: null,
				toMarker: null,
				mapProvider: mockMapProvider,
				t: mockT
			});

			expect(result.fromPlace).toBe('University District');
			expect(result.toPlace).toBe('Capitol Hill');
		});

		it('should swap coordinates when both are set', () => {
			const fromCoords = { lat: 47.6205, lng: -122.3212 };
			const toCoords = { lat: 47.6587, lng: -122.3138 };

			const result = swapTripLocations({
				fromPlace: 'Capitol Hill',
				toPlace: 'University District',
				selectedFrom: fromCoords,
				selectedTo: toCoords,
				fromMarker: null,
				toMarker: null,
				mapProvider: mockMapProvider,
				t: mockT
			});

			expect(result.selectedFrom).toEqual(toCoords);
			expect(result.selectedTo).toEqual(fromCoords);
		});

		it('should remove existing markers and create new ones with swapped positions', () => {
			const fromCoords = { lat: 47.6205, lng: -122.3212 };
			const toCoords = { lat: 47.6587, lng: -122.3138 };
			const fromMarker = { id: 'marker-from' };
			const toMarker = { id: 'marker-to' };

			const result = swapTripLocations({
				fromPlace: 'Capitol Hill',
				toPlace: 'University District',
				selectedFrom: fromCoords,
				selectedTo: toCoords,
				fromMarker,
				toMarker,
				mapProvider: mockMapProvider,
				t: mockT
			});

			// Verify old markers were removed
			expect(mockMapProvider.removePinMarker).toHaveBeenCalledWith(fromMarker);
			expect(mockMapProvider.removePinMarker).toHaveBeenCalledWith(toMarker);
			expect(mockMapProvider.removePinMarker).toHaveBeenCalledTimes(2);

			// Verify new markers were created with swapped coordinates
			expect(mockMapProvider.addPinMarker).toHaveBeenCalledWith(toCoords, 'From');
			expect(mockMapProvider.addPinMarker).toHaveBeenCalledWith(fromCoords, 'To');
			expect(mockMapProvider.addPinMarker).toHaveBeenCalledTimes(2);

			// Verify returned markers are the new ones
			expect(result.fromMarker).toEqual({ id: 'marker-From', coords: toCoords, label: 'From' });
			expect(result.toMarker).toEqual({ id: 'marker-To', coords: fromCoords, label: 'To' });
		});

		it('should handle swap when only fromMarker exists', () => {
			const fromCoords = { lat: 47.6205, lng: -122.3212 };
			const fromMarker = { id: 'marker-from' };

			const result = swapTripLocations({
				fromPlace: 'Capitol Hill',
				toPlace: '',
				selectedFrom: fromCoords,
				selectedTo: null,
				fromMarker,
				toMarker: null,
				mapProvider: mockMapProvider,
				t: mockT
			});

			// Verify old marker was removed
			expect(mockMapProvider.removePinMarker).toHaveBeenCalledWith(fromMarker);
			expect(mockMapProvider.removePinMarker).toHaveBeenCalledTimes(1);

			// Verify only toMarker was created (with swapped fromCoords)
			expect(mockMapProvider.addPinMarker).toHaveBeenCalledWith(fromCoords, 'To');
			expect(mockMapProvider.addPinMarker).toHaveBeenCalledTimes(1);

			// Verify fromMarker is null and toMarker exists
			expect(result.fromMarker).toBeNull();
			expect(result.toMarker).toEqual({ id: 'marker-To', coords: fromCoords, label: 'To' });
		});

		it('should handle swap when only toMarker exists', () => {
			const toCoords = { lat: 47.6587, lng: -122.3138 };
			const toMarker = { id: 'marker-to' };

			const result = swapTripLocations({
				fromPlace: '',
				toPlace: 'University District',
				selectedFrom: null,
				selectedTo: toCoords,
				fromMarker: null,
				toMarker,
				mapProvider: mockMapProvider,
				t: mockT
			});

			// Verify old marker was removed
			expect(mockMapProvider.removePinMarker).toHaveBeenCalledWith(toMarker);
			expect(mockMapProvider.removePinMarker).toHaveBeenCalledTimes(1);

			// Verify only fromMarker was created (with swapped toCoords)
			expect(mockMapProvider.addPinMarker).toHaveBeenCalledWith(toCoords, 'From');
			expect(mockMapProvider.addPinMarker).toHaveBeenCalledTimes(1);

			// Verify toMarker is null and fromMarker exists
			expect(result.fromMarker).toEqual({ id: 'marker-From', coords: toCoords, label: 'From' });
			expect(result.toMarker).toBeNull();
		});

		it('should handle swap when no markers exist', () => {
			const result = swapTripLocations({
				fromPlace: 'Capitol Hill',
				toPlace: 'University District',
				selectedFrom: null,
				selectedTo: null,
				fromMarker: null,
				toMarker: null,
				mapProvider: mockMapProvider,
				t: mockT
			});

			// Verify no markers were removed or created
			expect(mockMapProvider.removePinMarker).not.toHaveBeenCalled();
			expect(mockMapProvider.addPinMarker).not.toHaveBeenCalled();

			// Verify both markers are null
			expect(result.fromMarker).toBeNull();
			expect(result.toMarker).toBeNull();
		});

		it('should handle null-safe marker removal', () => {
			// Test that removePinMarker is only called for non-null markers
			const fromMarker = { id: 'marker-from' };

			swapTripLocations({
				fromPlace: 'Capitol Hill',
				toPlace: '',
				selectedFrom: null,
				selectedTo: null,
				fromMarker,
				toMarker: null,
				mapProvider: mockMapProvider,
				t: mockT
			});

			// Should only call removePinMarker once (for fromMarker)
			expect(mockMapProvider.removePinMarker).toHaveBeenCalledTimes(1);
			expect(mockMapProvider.removePinMarker).toHaveBeenCalledWith(fromMarker);
		});

		it('should return all swapped values in correct structure', () => {
			const result = swapTripLocations({
				fromPlace: 'A',
				toPlace: 'B',
				selectedFrom: { lat: 1, lng: 2 },
				selectedTo: { lat: 3, lng: 4 },
				fromMarker: null,
				toMarker: null,
				mapProvider: mockMapProvider,
				t: mockT
			});

			// Verify return structure
			expect(result).toHaveProperty('fromPlace');
			expect(result).toHaveProperty('toPlace');
			expect(result).toHaveProperty('selectedFrom');
			expect(result).toHaveProperty('selectedTo');
			expect(result).toHaveProperty('fromMarker');
			expect(result).toHaveProperty('toMarker');
		});
	});
});
