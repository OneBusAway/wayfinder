import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const MAX_PINNED = 20;
const STORAGE_KEY = 'wayfinder_pinned_trips';

function createPinnedTripsStore() {
	let initialTrips = [];
	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) {
					initialTrips = parsed.filter((t) => t && t.fromCoords && t.toCoords);
				}
			}
		} catch (e) {
			console.warn('Failed to load pinned trips:', e);
		}
	}

	const { subscribe, update } = writable(initialTrips);

	const isMatch = (t1, t2) => {
		if (!t1.fromCoords || !t1.toCoords || !t2.fromCoords || !t2.toCoords) return false;
		return (
			t1.fromCoords.lat === t2.fromCoords.lat &&
			t1.fromCoords.lng === t2.fromCoords.lng &&
			t1.toCoords.lat === t2.toCoords.lat &&
			t1.toCoords.lng === t2.toCoords.lng
		);
	};

	return {
		subscribe,
		togglePin: (trip) => {
			update((trips) => {
				const exists = trips.some((t) => isMatch(t, trip));
				let updated;

				if (exists) {
					updated = trips.filter((t) => !isMatch(t, trip));
				} else {
					const fromCoords = trip.fromCoords || trip.selectedFrom;
					const toCoords = trip.toCoords || trip.selectedTo;

					if (!fromCoords || !toCoords) {
						return trips;
					}

					const newTrip = {
						id: crypto.randomUUID(),
						timestamp: Date.now(),
						fromPlace: trip.fromPlace,
						toPlace: trip.toPlace,
						fromCoords,
						toCoords
					};
					updated = [newTrip, ...trips].slice(0, MAX_PINNED);
				}

				try {
					if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
				} catch (e) {
					console.warn('Failed to save pinned trips:', e);
				}

				return updated;
			});
		},
		removeTrip: (id) => {
			update((trips) => {
				const updated = trips.filter((t) => t.id !== id);

				try {
					if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
				} catch (e) {
					console.warn('Failed to remove pinned trip:', e);
				}

				return updated;
			});
		}
	};
}

export const pinnedTrips = createPinnedTripsStore();
