import { writable } from 'svelte/store';

const STORAGE_KEY = 'wayfinder_pinned_trips';
const MAX_PINNED = 20;

const hasStorage = () => typeof localStorage !== 'undefined';

export const isMatch = (t1, t2) => {
	if (!t1?.fromCoords || !t1?.toCoords || !t2?.fromCoords || !t2?.toCoords) return false;
	return (
		t1.fromCoords.lat === t2.fromCoords.lat &&
		t1.fromCoords.lng === t2.fromCoords.lng &&
		t1.toCoords.lat === t2.toCoords.lat &&
		t1.toCoords.lng === t2.toCoords.lng
	);
};

function createPinnedTripsStore() {
	let initialTrips = [];

	if (hasStorage()) {
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
			console.error('Failed to load pinned trips from localStorage:', e);
		}
	}

	const { subscribe, set, update } = writable(initialTrips);

	function saveToStorage(trips) {
		if (hasStorage()) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
			} catch (e) {
				console.error('Failed to save pinned trips to localStorage:', e);
			}
		}
	}

	return {
		subscribe,
		togglePin: (trip) => {
			if (!trip || !trip.fromCoords || !trip.toCoords || !trip.fromPlace || !trip.toPlace) {
				return 'invalid';
			}

			let status = 'pinned';

			update((trips) => {
				const existingIndex = trips.findIndex((t) => isMatch(t, trip));
				if (existingIndex !== -1) {
					status = 'unpinned';
					const updated = trips.filter((_, i) => i !== existingIndex);
					saveToStorage(updated);
					return updated;
				}

				if (trips.length >= MAX_PINNED) {
					status = 'limit';
					return trips;
				}

				const newTrip = {
					...trip,
					id: trip.id || crypto.randomUUID()
				};
				const updated = [newTrip, ...trips];
				saveToStorage(updated);
				return updated;
			});

			return status;
		},
		removeTrip: (tripId) => {
			update((trips) => {
				const updated = trips.filter((t) => t.id !== tripId);
				saveToStorage(updated);
				return updated;
			});
		},
		clearAll: () => {
			set([]);
			if (hasStorage()) {
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch (e) {
					console.error('Failed to clear pinned trips from localStorage:', e);
				}
			}
		}
	};
}

export const pinnedTrips = createPinnedTripsStore();
