import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const MAX_RECENT_TRIPS = 3;
const STORAGE_KEY = 'wayfinder_recent_trips';

/**
 * Creates a store for managing recent trip searches.
 * Persists to localStorage.
 */
function createRecentTripsStore() {
	// Initialize with empty array or load from storage
	let initialTrips = [];

	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) {
					initialTrips = parsed.filter(
						(t) => t && t.fromCoords && t.toCoords && t.fromPlace && t.toPlace
					);
				}
			}
		} catch (e) {
			console.error('Failed to load recent trips from localStorage:', e);
		}
	}

	const { subscribe, update, set } = writable(initialTrips);

	return {
		subscribe,

		/**
		 * Add a trip to recent searches.
		 * Deduplicates based on from/to coordinates and handles max limit (LIFO).
		 * @param {Object} trip - The trip object to add
		 */
		addTrip: (trip) => {
			update((trips) => {
				// Create a simplified trip object for storage
				// We store minimal data needed to reconstruct the search
				const newTrip = {
					id: crypto.randomUUID(),
					timestamp: Date.now(),
					fromPlace: trip.fromPlace,
					toPlace: trip.toPlace,
					fromCoords: trip.selectedFrom, // Store raw coords object {lat, lng}
					toCoords: trip.selectedTo, // Store raw coords object {lat, lng}
					// Store relevant options if needed
					tripOptions: trip.tripOptions
				};

				// Filter out duplicates (same from/to coordinates)
				// Uses strict equality since coords are stored/recalled via JSON without arithmetic
				const isDuplicate = (t) => {
					if (!t.fromCoords || !t.toCoords || !newTrip.fromCoords || !newTrip.toCoords) {
						return false;
					}
					const isSameFrom =
						t.fromCoords.lat === newTrip.fromCoords.lat &&
						t.fromCoords.lng === newTrip.fromCoords.lng;
					const isSameTo =
						t.toCoords.lat === newTrip.toCoords.lat && t.toCoords.lng === newTrip.toCoords.lng;
					return isSameFrom && isSameTo;
				};

				// Remove any existing duplicate so we can add the new one at the top
				const filtered = trips.filter((t) => !isDuplicate(t));

				// Add new trip to the beginning
				const updated = [newTrip, ...filtered].slice(0, MAX_RECENT_TRIPS);

				// Persist
				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
					} catch (e) {
						console.warn('Failed to persist recent trips:', e);
					}
				}

				return updated;
			});
		},

		/**
		 * Remove a specific trip by ID.
		 * @param {string} id - The ID of the trip to remove
		 */
		removeTrip: (id) => {
			update((trips) => {
				const updated = trips.filter((t) => t.id !== id);
				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
					} catch (e) {
						console.warn('Failed to persist recent trips:', e);
					}
				}
				return updated;
			});
		},

		/**
		 * Clear all recent trips.
		 */
		clearAll: () => {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
			set([]);
		}
	};
}

export const recentTrips = createRecentTripsStore();
