/**
 * Path for a stop opened on the map. Shareable, and pushed onto history when a
 * marker is tapped. Distinct from the standalone `/stops/{id}` detail page.
 * @param {string} id - OBA stop id (e.g. "1_75403")
 * @returns {string}
 */
export function mapStopPath(id) {
	return `/map/stops/${encodeURIComponent(id)}`;
}

/**
 * The stop id embedded in a `/map/stops/{id}` pathname, or null for any other
 * path. Used to derive "which stop is open" from the URL — works for both
 * shallow `pushState` and real navigation.
 * @param {string} pathname
 * @returns {string | null}
 */
export function stopIdFromPath(pathname) {
	const match = /^\/map\/stops\/([^/]+)\/?$/.exec(pathname);
	return match ? decodeURIComponent(match[1]) : null;
}
