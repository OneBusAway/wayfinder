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
