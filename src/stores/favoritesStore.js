import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'wayfinder_favorites';

/**
 * Validates that an entry loaded from localStorage has the required fields.
 * @param {unknown} entry - The entry to validate
 * @returns {boolean}
 */
function isValidFavorite(entry) {
	return (
		entry &&
		typeof entry === 'object' &&
		entry.id &&
		(entry.type === 'stop' || entry.type === 'route') &&
		entry.entityId &&
		entry.name &&
		Number.isFinite(entry.timestamp)
	);
}

/**
 * Creates a store for managing favorite stops and routes.
 * Persists to localStorage.
 */
function createFavoritesStore() {
	let initialFavorites = [];

	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) {
					initialFavorites = parsed.filter(isValidFavorite);
				}
			}
		} catch (e) {
			console.warn('Failed to load favorites from localStorage:', e);
		}
	}

	const { subscribe, update, set } = writable(initialFavorites);

	return {
		subscribe,

		/**
		 * Add a stop or route to favorites.
		 * Deduplicates by type + entityId. Newest entry wins.
		 * @param {Object} item - Must have type, entityId, name. Optional: direction, coords.
		 */
		addFavorite: (item) => {
			update((favorites) => {
				const newFavorite = {
					id: crypto.randomUUID(),
					type: item.type,
					entityId: item.entityId,
					name: item.name,
					direction: item.direction || null,
					coords: item.coords || null,
					timestamp: Date.now()
				};

				const filtered = favorites.filter(
					(f) => !(f.type === newFavorite.type && f.entityId === newFavorite.entityId)
				);

				const updated = [newFavorite, ...filtered];

				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
					} catch (e) {
						console.warn('Failed to persist favorites:', e);
					}
				}

				return updated;
			});
		},

		/**
		 * Remove a favorite by its ID.
		 * @param {string} id
		 */
		removeFavorite: (id) => {
			update((favorites) => {
				const updated = favorites.filter((f) => f.id !== id);
				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
					} catch (e) {
						console.warn('Failed to persist favorites:', e);
					}
				}
				return updated;
			});
		},

		/**
		 * Check if an entity is currently favorited.
		 * @param {string} type - 'stop' or 'route'
		 * @param {string} entityId
		 * @returns {boolean}
		 */
		isFavorite: (type, entityId) => {
			let found = false;
			const unsubscribe = subscribe((favorites) => {
				found = favorites.some((f) => f.type === type && f.entityId === entityId);
			});
			unsubscribe();
			return found;
		},

		/**
		 * Clear all favorites.
		 */
		clearAll: () => {
			if (browser) {
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch (e) {
					console.warn('Failed to remove favorites from localStorage:', e);
				}
			}
			set([]);
		}
	};
}

export const favorites = createFavoritesStore();
