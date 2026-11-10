/**
 * Removes the agency prefix from an ID string, returning only the numeric/identifier part.
 * Handles IDs in the format "AGENCY_ID" or "AGENCY_NUMBER" where the separator is an underscore.
 *
 * @param {string} idString - The full ID string (e.g., "MTS_41242", "1_41242")
 * @returns {string} The ID without the agency prefix (e.g., "41242")
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
 * Returns the displayed name for a route, falling back to id without agency prefix.
 *
 * @param {Object} [route]
 * @returns {string}
 */
export function getRouteDisplayName(route) {
	return route?.shortName || (route?.id ? removeAgencyPrefix(route.id) : '');
}

/**
 * Extracts numeric value from route short name (or id fallback) for sorting purposes.
 * Routes without numeric values are placed at the end.
 *
 * @param {Object} route - Route object
 * @param {string} [route.shortName] - Route short name (e.g., "44", "B Line", "Route 7")
 * @param {string} [route.id] - Route id (e.g., "1_44")
 * @returns {number} Numeric value for sorting, or MAX_SAFE_INTEGER if no numeric value found
 *
 * @example
 * extractNumericValue({ shortName: "44" }) // returns 44
 * extractNumericValue({ shortName: "Route 7" }) // returns 7
 * extractNumericValue({ id: "1_44" }) // returns 44
 * extractNumericValue({ shortName: "B Line" }) // returns Number.MAX_SAFE_INTEGER -> no numeric value so placed at the end
 */
export function extractNumericValue(route) {
	const name = getRouteDisplayName(route);
	if (!name) {
		return Number.MAX_SAFE_INTEGER;
	}

	const matches = name.match(/(\d+)/);
	return matches ? parseInt(matches[1], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Compares two routes for sorting purposes.
 * Sorts numerically when both routes have numeric values,
 * otherwise falls back to alphabetical comparison.
 */
export function compareRoutes(a, b) {
	const aNumeric = extractNumericValue(a);
	const bNumeric = extractNumericValue(b);

	if (aNumeric !== bNumeric) {
		return aNumeric - bNumeric;
	}

	const aName = getRouteDisplayName(a);
	const bName = getRouteDisplayName(b);
	return aName.localeCompare(bName);
}

/**
 * Checks if a route matches the search query.
 * Searches across route short name, long name, description, and agency name.
 *
 * @param {Object} route - Route object to check
 * @param {string} [route.shortName] - Route short name
 * @param {string} [route.longName] - Route long name
 * @param {string} [route.description] - Route description
 * @param {Object} [route.agencyInfo] - Agency information
 * @param {string} [route.agencyInfo.name] - Agency name
 * @param {string} query - Search query string
 * @returns {boolean} True if route matches query
 *
 * @example
 * matchesQuery({ shortName: "44", description: "Ballard" }, "ball") // returns true
 * matchesQuery({ shortName: "7" }, "44") // returns false
 */
export function matchesQuery(route, query) {
	if (!query) {
		return true; // Empty query matches all routes
	}

	const lowerCaseQuery = query.toLowerCase();
	const shortName = route?.shortName?.toLowerCase() || '';
	const longName = route?.longName?.toLowerCase() || '';
	const description = route?.description?.toLowerCase() || '';
	const agencyName = route?.agencyInfo?.name?.toLowerCase() || '';

	return (
		shortName.includes(lowerCaseQuery) ||
		longName.includes(lowerCaseQuery) ||
		description.includes(lowerCaseQuery) ||
		agencyName.includes(lowerCaseQuery)
	);
}

/**
 * Filters and sorts routes based on search query.
 * Combines filtering by query and sorting by numeric/alphabetical order.
 *
 * @param {Array<Object>} routes - Array of route objects to filter and sort
 * @param {string} [query=''] - Search query string
 * @returns {Array<Object>} Filtered and sorted array of routes
 *
 * @example
 * const routes = [
 *   { shortName: "7", description: "Rainier" },
 *   { shortName: "44", description: "Ballard" },
 *   { shortName: "B Line", description: "RapidRide" }
 * ];
 *
 * filterAndSortRoutes(routes, "ball") // returns [{ shortName: "44", ... }]
 * filterAndSortRoutes(routes, "") // returns all routes sorted numerically
 */
export function filterAndSortRoutes(routes, query = '') {
	if (!Array.isArray(routes)) {
		return [];
	}

	return routes.filter((route) => matchesQuery(route, query)).sort(compareRoutes);
}
