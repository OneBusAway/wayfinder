import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { parseTimeInput } from '$lib/otp';
import {
	resolveDistanceUnit,
	getWalkDistanceOptions,
	formatWalkDistanceLabel,
	snapToClosestOption,
	UNIT_METRIC,
	UNIT_IMPERIAL
} from '$lib/distanceUtils';

// Modal visibility store
export const showTripOptionsModal = writable(false);

// Default walk distance for UI (1 mile in meters)
// Note: This is intentionally different from OTP_DEFAULTS.maxWalkDistance (3 miles)
// which serves as the API fallback. The UI default is more conservative.
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
	maxWalkDistance: DEFAULT_WALK_DISTANCE_METERS, // meters (1 mile default)
	distanceUnit: null // null = auto-detect, 'metric', or 'imperial'
};

// Re-export for use by components
export { getWalkDistanceOptions, snapToClosestOption, UNIT_METRIC, UNIT_IMPERIAL };

// Legacy static options - kept for backwards compatibility
// New code should use getWalkDistanceOptions(unit) instead
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
		const storedDistanceUnit = localStorage.getItem('tripOptions_distanceUnit');

		const parsedMaxWalk = storedMaxWalk ? parseInt(storedMaxWalk, 10) : NaN;
		// Validate distanceUnit is one of the valid values or null
		const validDistanceUnit =
			storedDistanceUnit === UNIT_METRIC || storedDistanceUnit === UNIT_IMPERIAL
				? storedDistanceUnit
				: null;

		persisted = {
			wheelchair: storedWheelchair === 'true',
			optimize: storedOptimize || 'fastest',
			// Handle corrupted localStorage values (NaN, negative, etc.)
			maxWalkDistance:
				!isNaN(parsedMaxWalk) && parsedMaxWalk > 0 ? parsedMaxWalk : DEFAULT_WALK_DISTANCE_METERS,
			distanceUnit: validDistanceUnit
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
				localStorage.removeItem('tripOptions_distanceUnit');
			}
			set(defaults);
		},

		// Update a persisted option (saves to localStorage)
		setPersisted: (key, value) => {
			update((opts) => {
				const newOpts = { ...opts, [key]: value };
				if (
					browser &&
					['wheelchair', 'optimize', 'maxWalkDistance', 'distanceUnit'].includes(key)
				) {
					if (value === null) {
						localStorage.removeItem(`tripOptions_${key}`);
					} else {
						localStorage.setItem(`tripOptions_${key}`, String(value));
					}
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

/**
 * Derived store that resolves the effective distance unit based on priority chain:
 * 1. User preference (highest priority)
 * 2. Environment variable (deployment default)
 * 3. Browser locale detection
 * 4. Fallback to metric
 */
export const effectiveDistanceUnit = derived(tripOptions, ($tripOptions) => {
	return resolveDistanceUnit($tripOptions.distanceUnit);
});

// Helper to format walk distance for display
// @param {number} meters - Distance in meters
// @param {string} [unit] - Optional unit system. If not provided, uses default (imperial).
export function formatWalkDistance(meters, unit) {
	// For backwards compatibility, if unit is not provided, use imperial (original behavior)
	const effectiveUnit = unit || UNIT_IMPERIAL;
	return formatWalkDistanceLabel(meters, effectiveUnit);
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
		// Use OTP module's parseTimeInput to format time (avoids duplicate logic)
		const formattedTime = parseTimeInput(timeStr);
		return formattedTime ? `${prefix} ${formattedTime}` : prefix;
	}

	return prefix;
}
