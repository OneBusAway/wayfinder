import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const MAX_FAVORITES = 50;
const STORAGE_KEY = 'wayfinder_favorites';
const SCHEMA_VERSION = 1;

/**
 * @param {unknown} entry
 * @returns {boolean}
 */
function isValidFavorite(entry) {
	if (!entry || typeof entry !== 'object') return false;

	const { type, id } = /** @type {{ type?: unknown, id?: unknown }} */ (entry);
	if ((type !== 'stop' && type !== 'route') || typeof id !== 'string' || !id) {
		return false;
	}

	if (type === 'stop') {
		const { lat, lon, name } = /** @type {{ lat?: unknown, lon?: unknown, name?: unknown }} */ (
			entry
		);
		if (typeof name !== 'string' || !name) return false;
		// Reject non-finite coords so favorites never call flyTo/addMarker with undefined.
		// Use Number.isFinite (not truthiness) so lat/lon === 0 survive.
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
		return true;
	}

	// Routes can genuinely lack a shortName (the OBA data carries
	// nullSafeShortName for exactly this), so the id alone identifies one and the
	// list falls back to it for display. Requiring shortName here would make the
	// star silently no-op on those routes.
	return true;
}

/**
 * Normalize a favorite entry for storage (denormalized snapshot for zero-API list UI).
 * @param {Object} entry
 * @returns {Object|null}
 */
function normalizeFavorite(entry) {
	if (!isValidFavorite(entry)) return null;

	const savedAt = typeof entry.savedAt === 'number' ? entry.savedAt : Date.now();

	if (entry.type === 'stop') {
		return {
			schemaVersion: SCHEMA_VERSION,
			type: 'stop',
			id: entry.id,
			name: entry.name,
			code: entry.code ?? null,
			direction: entry.direction ?? null,
			lat: entry.lat,
			lon: entry.lon,
			savedAt
		};
	}

	return {
		schemaVersion: SCHEMA_VERSION,
		type: 'route',
		id: entry.id,
		shortName: entry.shortName ?? null,
		description: entry.description ?? null,
		routeType: entry.routeType ?? null,
		savedAt
	};
}

function persist(favorites) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
	} catch (e) {
		console.warn('Failed to persist favorites:', e);
	}
}

/**
 * Creates a store for managing favorited stops and routes.
 * Persists to localStorage, following the recentTripsStore pattern.
 */
function createFavoritesStore() {
	let initialFavorites = [];

	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) {
					initialFavorites = parsed.map(normalizeFavorite).filter(Boolean);
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
		 * Add a favorite. Deduplicates on type+id; newest first; capped at MAX_FAVORITES.
		 * @param {Object} entry
		 */
		add: (entry) => {
			const normalized = normalizeFavorite({ ...entry, savedAt: Date.now() });
			if (!normalized) return;

			update((favorites) => {
				const filtered = favorites.filter(
					(f) => !(f.type === normalized.type && f.id === normalized.id)
				);
				const updated = [normalized, ...filtered].slice(0, MAX_FAVORITES);
				persist(updated);
				return updated;
			});
		},

		/**
		 * Remove a favorite by type and id.
		 * @param {'stop'|'route'} type
		 * @param {string} id
		 */
		remove: (type, id) => {
			update((favorites) => {
				const updated = favorites.filter((f) => !(f.type === type && f.id === id));
				persist(updated);
				return updated;
			});
		},

		/**
		 * Toggle a favorite on/off.
		 * @param {Object} entry
		 * @returns {'added' | 'removed' | null}
		 */
		toggle: (entry) => {
			const type = entry?.type;
			const id = entry?.id;
			if ((type !== 'stop' && type !== 'route') || typeof id !== 'string' || !id) {
				return null;
			}

			/** @type {'added' | 'removed' | null} */
			let result = null;

			update((favorites) => {
				const exists = favorites.some((f) => f.type === type && f.id === id);
				let updated;
				if (exists) {
					updated = favorites.filter((f) => !(f.type === type && f.id === id));
					result = 'removed';
				} else {
					const normalized = normalizeFavorite({ ...entry, savedAt: Date.now() });
					if (!normalized) return favorites;
					updated = [normalized, ...favorites].slice(0, MAX_FAVORITES);
					result = 'added';
				}
				persist(updated);
				return updated;
			});

			return result;
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
