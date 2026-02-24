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
				initialTrips = JSON.parse(stored);
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
					toCoords: trip.selectedTo,     // Store raw coords object {lat, lng}
					// Store relevant options if needed
					tripOptions: trip.tripOptions
				};

				// Filter out duplicates (same from/to coordinates)
				// We check if coords match roughly to avoid floating point issues
				const isDuplicate = (t) => {
					const isSameFrom = 
						t.fromCoords.lat === newTrip.fromCoords.lat && 
						t.fromCoords.lng === newTrip.fromCoords.lng;
					const isSameTo = 
						t.toCoords.lat === newTrip.toCoords.lat && 
						t.toCoords.lng === newTrip.toCoords.lng;
					return isSameFrom && isSameTo;
				};

				// Remove any existing duplicate so we can add the new one at the top
				const filtered = trips.filter(t => !isDuplicate(t));
				
				// Add new trip to the beginning
				const updated = [newTrip, ...filtered].slice(0, MAX_RECENT_TRIPS);
				
				// Persist
				if (browser) {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
				const updated = trips.filter(t => t.id !== id);
				if (browser) {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
