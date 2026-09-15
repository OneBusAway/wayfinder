export function debounce(func, wait) {
	let timeout;

	return function (...args) {
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(this, args), wait);
	};
}

/**
 * Removes the agency prefix from an ID string, returning only the numeric part.
 * Handles IDs in the format "AGENCY_ID" or "AGENCY_NUMBER" where the separator is an underscore.
 *
 * @param {string} idString - The full ID string (e.g., "MTS_41242", "1_41242")
 * @returns {string} The ID without the agency prefix (e.g., "41242")
 *
 * @example
 * removeAgencyPrefix("MTS_41242") // returns "41242"
 * removeAgencyPrefix("1_41242")   // returns "41242"
 * removeAgencyPrefix("41242")     // returns "41242" (no prefix to remove)
 */
export function removeAgencyPrefix(idString) {
	if (!idString || typeof idString !== 'string') {
		return idString;
	}

	const underscoreIndex = idString.indexOf('_');
	if (underscoreIndex === -1) {
		return idString;
	}

	// Return everything after the first underscore
	return idString.substring(underscoreIndex + 1);
}

/**
 * Extracts the sorted route short names served by a stop from an
 * arrivals-and-departures API response.
 *
 * @param {Object} arrivalsAndDeparturesResponse - Response from the arrivals-and-departures-for-stop API
 * @param {Object} stop - Stop object with a routeIds array
 * @returns {Array<string>|null} Lexicographically sorted route short names (falling back to the
 *   route id without its agency prefix), or null when the response has no route references
 *   or the stop has no routeIds array
 */
export function routeShortNamesForStop(arrivalsAndDeparturesResponse, stop) {
	const routes = arrivalsAndDeparturesResponse?.data?.references?.routes;
	if (!routes || !Array.isArray(stop?.routeIds)) {
		return null;
	}

	const stopRouteIds = new Set(stop.routeIds);

	return (
		routes
			.filter((r) => stopRouteIds.has(r.id))
			// the route id will always be present, so if the shortName is missing, fall back to the id without its agency prefix
			.map((r) => r.shortName || removeAgencyPrefix(r.id))
			.sort()
	);
}

/**
 * Localizes a stop's compass direction code ("N", "SW", …) via the `direction.*`
 * messages. OneBusAway is not guaranteed to return one of the eight codes those
 * messages cover — CompassArrow already hides its arrow for anything else — so an
 * unrecognized code falls back to itself rather than leaking the literal message
 * id ("direction.FOO") into the UI.
 *
 * @param {string | null | undefined} direction - Compass code from the OBA stop
 * @param {(id: string, options?: Object) => string} translate - svelte-i18n's `$t`
 * @returns {string | null} The localized direction, or null when the stop has none
 */
export function directionLabel(direction, translate) {
	if (!direction) {
		return null;
	}
	return translate(`direction.${direction}`, { default: direction });
}

/**
 * Builds the one-line subtitle shown under a stop's name wherever stops are
 * listed (search results, favorites), so the two lists read identically.
 * A stop with no code falls back to its id instead of showing "undefined".
 *
 * @param {Object} stop - Stop object with `direction`, `code` and `id`
 * @param {(id: string, options?: Object) => string} translate - svelte-i18n's `$t`
 * @returns {string} e.g. "Southwest · Code: 41242"
 */
export function stopSubtitle(stop, translate) {
	return [
		directionLabel(stop.direction, translate),
		`${translate('favorites.stop_code')}: ${stop.code || removeAgencyPrefix(stop.id)}`
	]
		.filter(Boolean)
		.join(' · ');
}
