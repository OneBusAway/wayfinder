/**
 * Centralized serialization and parsing of shareable URL state.
 *
 * These are pure functions with no Svelte or DOM dependencies, so the query
 * string contract for shareable links stays in one place and is easy to test.
 *
 * Trip params: `from` and `to` are "lat,lng" strings; `fromName` and `toName`
 * are optional human readable labels.
 */

/** Number of decimal places kept for coordinates (about 1 meter precision). */
const COORD_PRECISION = 5;

/**
 * Rounds a coordinate pair and renders it as a compact "lat,lng" string.
 *
 * @param {{ lat: number, lng: number } | null | undefined} coords
 * @returns {string | null} The "lat,lng" string, or null if coords are invalid
 */
export function formatCoord(coords) {
	if (!coords) return null;
	const { lat, lng } = coords;
	if (!isValidLat(lat) || !isValidLng(lng)) return null;
	return `${round(lat)},${round(lng)}`;
}

/**
 * Parses a "lat,lng" string into a validated coordinate object.
 *
 * @param {string | null | undefined} value
 * @returns {{ lat: number, lng: number } | null} The coordinates, or null if invalid
 */
export function parseCoord(value) {
	if (!value || typeof value !== 'string') return null;

	const parts = value.split(',');
	if (parts.length !== 2) return null;

	const lat = parseFloat(parts[0]);
	const lng = parseFloat(parts[1]);

	if (!isValidLat(lat) || !isValidLng(lng)) return null;

	return { lat, lng };
}

/**
 * Reads trip context from URL search params.
 *
 * @param {URLSearchParams} searchParams
 * @returns {{ selectedFrom: { lat: number, lng: number }, selectedTo: { lat: number, lng: number }, fromPlace: string, toPlace: string } | null}
 *          The restored trip, or null when from/to are missing or invalid
 */
export function parseTripParams(searchParams) {
	if (!searchParams) return null;

	const selectedFrom = parseCoord(searchParams.get('from'));
	const selectedTo = parseCoord(searchParams.get('to'));

	if (!selectedFrom || !selectedTo) return null;

	const fromName = searchParams.get('fromName');
	const toName = searchParams.get('toName');

	return {
		selectedFrom,
		selectedTo,
		fromPlace: fromName || formatCoord(selectedFrom),
		toPlace: toName || formatCoord(selectedTo)
	};
}

/**
 * Writes trip context onto a URL's search params in place. Skips writing when
 * either coordinate is invalid so a broken link is never produced.
 *
 * @param {URL} url - URL whose searchParams will be mutated
 * @param {{ selectedFrom: object, selectedTo: object, fromPlace?: string, toPlace?: string }} trip
 * @returns {URL} The same url, for chaining
 */
export function applyTripParams(url, trip) {
	const from = formatCoord(trip?.selectedFrom);
	const to = formatCoord(trip?.selectedTo);

	if (!from || !to) return url;

	url.searchParams.set('from', from);
	url.searchParams.set('to', to);

	if (trip.fromPlace) {
		url.searchParams.set('fromName', trip.fromPlace);
	} else {
		url.searchParams.delete('fromName');
	}

	if (trip.toPlace) {
		url.searchParams.set('toName', trip.toPlace);
	} else {
		url.searchParams.delete('toName');
	}

	return url;
}

/**
 * Removes all trip params from a URL's search params in place.
 *
 * @param {URL} url - URL whose searchParams will be mutated
 * @returns {URL} The same url, for chaining
 */
export function removeTripParams(url) {
	url.searchParams.delete('from');
	url.searchParams.delete('to');
	url.searchParams.delete('fromName');
	url.searchParams.delete('toName');
	return url;
}

function round(value) {
	return Number(value.toFixed(COORD_PRECISION));
}

function isValidLat(lat) {
	return typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLng(lng) {
	return typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180;
}
