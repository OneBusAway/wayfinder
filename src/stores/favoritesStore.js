import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'wayfinder_favorites';

function createFavoritesStore() {
	let initialFavorites = [];

	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) {
					initialFavorites = parsed;
				}
			}
		} catch (e) {
			console.warn('Failed to load favorites from localStorage:', e);
		}
	}

	const { subscribe, update, set } = writable(initialFavorites);

	return {
		subscribe,

		addFavorite: (id, type = 'stop') => {
			update((favorites) => {
				const exists = favorites.some((fav) => fav.id === id && fav.type === type);
				if (exists) return favorites;

				const newFavorites = [...favorites, { id, type, addedAt: Date.now() }];
				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
					} catch (e) {
						console.warn('Failed to persist favorites:', e);
					}
				}
				return newFavorites;
			});
		},

		removeFavorite: (id, type = 'stop') => {
			update((favorites) => {
				const newFavorites = favorites.filter((fav) => !(fav.id === id && fav.type === type));
				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
					} catch (e) {
						console.warn('Failed to persist favorites:', e);
					}
				}
				return newFavorites;
			});
		},

		toggleFavorite: (id, type = 'stop') => {
			update((favorites) => {
				const exists = favorites.some((fav) => fav.id === id && fav.type === type);
				let newFavorites;

				if (exists) {
					newFavorites = favorites.filter((fav) => !(fav.id === id && fav.type === type));
				} else {
					newFavorites = [...favorites, { id, type, addedAt: Date.now() }];
				}

				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
					} catch (e) {
						console.warn('Failed to persist favorites:', e);
					}
				}
				return newFavorites;
			});
		},

		isFavorite: (id, type = 'stop') => {
			let result = false;
			subscribe((favorites) => {
				result = favorites.some((fav) => fav.id === id && fav.type === type);
			})();
			return result;
		},

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
