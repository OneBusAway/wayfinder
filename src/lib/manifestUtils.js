/**
 * Truncates a name to fit within maxLength, respecting word boundaries when possible.
 * @param {string} name - The name to truncate
 * @param {number} maxLength - Maximum length (default 12 for iOS home screen)
 * @returns {string} Truncated name
 */
export function truncateShortName(name, maxLength = 12) {
	if (name.length <= maxLength) {
		return name;
	}

	// Try to find a word boundary within the limit
	const lastSpace = name.lastIndexOf(' ', maxLength);
	if (lastSpace > 0) {
		return name.substring(0, lastSpace).trim();
	}

	// No word boundary found, just truncate
	return name.substring(0, maxLength);
}
