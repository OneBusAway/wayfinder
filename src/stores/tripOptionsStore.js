import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Modal visibility store
export const showTripOptionsModal = writable(false);

// Default walk distance constant (1 mile in meters)
export const DEFAULT_WALK_DISTANCE_METERS = 1609;

// Default values
const defaults = {
	// Session-only (not persisted)
	departureType: 'now', // 'now' | 'departAt' | 'arriveBy'
	departureTime: null, // Time string (e.g., "14:30") or null
	departureDate: null, // Date string (e.g., "2026-01-13") or null

	// Persisted in localStorage
	wheelchair: false,
	optimize: 'fastest', // 'fastest' | 'fewestTransfers'
	maxWalkDistance: DEFAULT_WALK_DISTANCE_METERS // meters (1 mile default)
};

// Walking distance options (in meters)
export const walkDistanceOptions = [
	{ label: '¼ mile', value: 402 },
	{ label: '½ mile', value: 805 },
	{ label: '1 mile', value: 1609 },
	{ label: '2 miles', value: 3219 },
	{ label: '3 miles', value: 4828 }
];

function createTripOptionsStore() {
	// Load persisted values from localStorage
	let persisted = {};
	if (browser) {
		const storedWheelchair = localStorage.getItem('tripOptions_wheelchair');
		const storedOptimize = localStorage.getItem('tripOptions_optimize');
		const storedMaxWalk = localStorage.getItem('tripOptions_maxWalkDistance');

		persisted = {
			wheelchair: storedWheelchair === 'true',
			optimize: storedOptimize || 'fastest',
			maxWalkDistance: storedMaxWalk ? parseInt(storedMaxWalk, 10) : DEFAULT_WALK_DISTANCE_METERS
		};
	}

	const initial = { ...defaults, ...persisted };
	const { subscribe, set, update } = writable(initial);

	return {
		subscribe,
		set,
		update,

		// Reset only session values (departure time)
		resetSession: () => {
			update((opts) => ({
				...opts,
				departureType: 'now',
				departureTime: null,
				departureDate: null
			}));
		},

		// Reset all values to defaults
		resetAll: () => {
			if (browser) {
				localStorage.removeItem('tripOptions_wheelchair');
				localStorage.removeItem('tripOptions_optimize');
				localStorage.removeItem('tripOptions_maxWalkDistance');
			}
			set(defaults);
		},

		// Update a persisted option (saves to localStorage)
		setPersisted: (key, value) => {
			update((opts) => {
				const newOpts = { ...opts, [key]: value };
				if (browser && ['wheelchair', 'optimize', 'maxWalkDistance'].includes(key)) {
					localStorage.setItem(`tripOptions_${key}`, String(value));
				}
				return newOpts;
			});
		},

		// Update a session option (not persisted)
		setSession: (key, value) => {
			update((opts) => ({ ...opts, [key]: value }));
		}
	};
}

export const tripOptions = createTripOptionsStore();

// Helper to format walk distance for display
export function formatWalkDistance(meters) {
	const option = walkDistanceOptions.find((opt) => opt.value === meters);
	return option ? option.label : `${Math.round((meters / 1609) * 10) / 10} mi`;
}

// Helper to format departure time for pill display
// Accepts an optional translator function for i18n support
export function formatDepartureDisplay(opts, translator = null) {
	if (opts.departureType === 'now') return null;

	const timeStr = opts.departureTime || '';
	// Use translator if provided, otherwise fall back to English
	const prefix =
		opts.departureType === 'arriveBy'
			? translator
				? translator('trip-planner.arrive')
				: 'Arrive'
			: translator
				? translator('trip-planner.depart')
				: 'Depart';

	if (timeStr) {
		// Format time for display (e.g., "2:30 PM")
		const [hours, minutes] = timeStr.split(':').map(Number);
		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		return `${prefix} ${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
	}

	return prefix;
}
