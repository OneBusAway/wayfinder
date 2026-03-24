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
				initialFavorites = Array.isArray(parsed) ? parsed : [];
			}
		} catch {
			// localStorage access may fail in private browsing or when quota exceeded
		}
	}

	const { subscribe, update, set } = writable(initialFavorites);

	return {
		subscribe,

		addFavorite: (id, type = 'stop', name = '') => {
			update((favorites) => {
				if (favorites.some((fav) => fav.id === id && fav.type === type)) {
					return favorites;
				}

				const newFavorites = [...favorites, { id, type, name, addedAt: Date.now() }];
				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
					} catch {
						// localStorage may be full or unavailable
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
					} catch {
						// localStorage may be full or unavailable
					}
				}
				return newFavorites;
			});
		},

		toggleFavorite: (id, type = 'stop', name = '') => {
			update((favorites) => {
				const exists = favorites.some((fav) => fav.id === id && fav.type === type);
				const newFavorites = exists
					? favorites.filter((fav) => !(fav.id === id && fav.type === type))
					: [...favorites, { id, type, name, addedAt: Date.now() }];

				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
					} catch {
						// localStorage may be full or unavailable
					}
				}
				return newFavorites;
			});
		},

		isFavorite: (id, type = 'stop') => {
			let result = false;
		const unsubscribe = subscribe((favorites) => {
			result = favorites.some((fav) => fav.id === id && fav.type === type);
		});
		unsubscribe();
		return result;
	},

	clearAll: () => {
		if (browser) {
			try {
				localStorage.removeItem(STORAGE_KEY);
			} catch {
				// localStorage may be unavailable
			}
		}
		set([]);
	}
	};
}

export const favorites = createFavoritesStore();
