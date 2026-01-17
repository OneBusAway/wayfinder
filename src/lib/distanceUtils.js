import { PUBLIC_DISTANCE_UNIT } from '$env/static/public';
import { browser } from '$app/environment';

// Conversion constants
const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

// Distance unit constants
export const UNIT_METRIC = 'metric';
export const UNIT_IMPERIAL = 'imperial';

/**
 * Detect preferred distance unit from browser locale.
 * Returns 'imperial' for en-US, 'metric' for everything else.
 */
export function detectDistanceUnit() {
	if (!browser) {
		return UNIT_METRIC;
	}

	const locale = navigator?.language || '';
	// US uses imperial (en-US)
	// Myanmar and Liberia also use imperial; so change this logic if needed in the future
	if (locale === 'en-US' || locale.startsWith('en-US-')) {
		return UNIT_IMPERIAL;
	}
	return UNIT_METRIC;
}

/**
 * Resolve the effective distance unit based on priority chain:
 * 1. User preference (highest priority)
 * 2. Environment variable (deployment default)
 * 3. Browser locale detection
 * 4. Fallback to metric
 *
 * @param {string|null} userPref - User preference from localStorage (null = auto)
 * @returns {string} - 'metric' or 'imperial'
 */
export function resolveDistanceUnit(userPref) {
	// 1. User preference (if explicitly set)
	if (userPref === UNIT_METRIC || userPref === UNIT_IMPERIAL) {
		return userPref;
	}

	// 2. Environment variable (deployment default)
	if (PUBLIC_DISTANCE_UNIT === UNIT_METRIC || PUBLIC_DISTANCE_UNIT === UNIT_IMPERIAL) {
		return PUBLIC_DISTANCE_UNIT;
	}

	// 3. Browser locale detection
	return detectDistanceUnit();
}

/**
 * Format a distance in meters to the appropriate unit.
 *
 * Imperial:
 * - Under 0.1 miles (161m): show feet, rounded to nearest 10 → "330 ft"
 * - 0.1+ miles: show miles with 1 decimal → "1.5 miles"
 *
 * Metric:
 * - Under 1000m: show meters, rounded → "467 m"
 * - 1000m+: show km with 1 decimal → "1.5 km"
 *
 * @param {number} meters - Distance in meters
 * @param {string} unit - 'metric' or 'imperial'
 * @param {function} translator - Translation function ($t from svelte-i18n)
 * @returns {string} - Formatted distance string
 */
export function formatDistance(meters, unit, translator) {
	if (unit === UNIT_IMPERIAL) {
		const miles = meters / METERS_PER_MILE;

		if (miles < 0.1) {
			// Show feet, rounded to nearest 10
			const feet = Math.round(meters / METERS_PER_FOOT / 10) * 10;
			return `${feet} ${translator('units.feet')}`;
		} else {
			// Show miles with 1 decimal
			const milesRounded = Math.round(miles * 10) / 10;
			const unitKey = milesRounded === 1 ? 'units.mile' : 'units.miles';
			return `${milesRounded} ${translator(unitKey)}`;
		}
	} else {
		// Metric
		if (meters < 1000) {
			// Show meters, rounded
			return `${Math.round(meters)} ${translator('units.meters')}`;
		} else {
			// Show km with 1 decimal
			const km = Math.round((meters / 1000) * 10) / 10;
			return `${km} ${translator('units.kilometers')}`;
		}
	}
}

/**
 * Get walk distance options for the given unit system.
 *
 * Imperial: ¼ mi, ½ mi, 1 mi, 2 mi, 3 mi
 * Metric: 400 m, 800 m, 1.5 km, 3 km, 5 km
 *
 * @param {string} unit - 'metric' or 'imperial'
 * @returns {Array<{label: string, value: number}>} - Options array
 */
export function getWalkDistanceOptions(unit) {
	if (unit === UNIT_IMPERIAL) {
		return [
			{ label: '¼ mile', value: 402 },
			{ label: '½ mile', value: 805 },
			{ label: '1 mile', value: 1609 },
			{ label: '2 miles', value: 3219 },
			{ label: '3 miles', value: 4828 }
		];
	} else {
		return [
			{ label: '400 m', value: 400 },
			{ label: '800 m', value: 800 },
			{ label: '1.5 km', value: 1500 },
			{ label: '3 km', value: 3000 },
			{ label: '5 km', value: 5000 }
		];
	}
}

/**
 * Snap a distance value to the closest option in the given unit system.
 * Useful when switching between unit systems to find the closest equivalent.
 *
 * @param {number} meters - Current distance in meters
 * @param {string} unit - Target unit system ('metric' or 'imperial')
 * @returns {number} - Value of the closest option in the target system
 */
export function snapToClosestOption(meters, unit) {
	const options = getWalkDistanceOptions(unit);

	let closest = options[0].value;
	let minDiff = Math.abs(meters - options[0].value);

	for (const option of options) {
		const diff = Math.abs(meters - option.value);
		if (diff < minDiff) {
			minDiff = diff;
			closest = option.value;
		}
	}

	return closest;
}

/**
 * Format walk distance for display based on unit.
 *
 * @param {number} meters - Distance in meters
 * @param {string} unit - 'metric' or 'imperial'
 * @returns {string} - Formatted label (e.g., "1 mile" or "1.5 km")
 */
export function formatWalkDistanceLabel(meters, unit) {
	const options = getWalkDistanceOptions(unit);
	const option = options.find((opt) => opt.value === meters);

	if (option) {
		return option.label;
	}

	// Fallback: format the value
	if (unit === UNIT_IMPERIAL) {
		const miles = Math.round((meters / METERS_PER_MILE) * 10) / 10;
		return miles === 1 ? '1 mile' : `${miles} miles`;
	} else {
		if (meters < 1000) {
			return `${Math.round(meters)} m`;
		}
		const km = Math.round((meters / 1000) * 10) / 10;
		return `${km} km`;
	}
}
