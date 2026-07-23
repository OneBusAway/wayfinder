/**
 * Path for a stop opened on the map. Shareable, and pushed onto history when a
 * marker is tapped. Distinct from the standalone `/stops/{id}` detail page.
 * @param {string} id - OBA stop id (e.g. "1_75403")
 * @returns {string}
 */
export function mapStopPath(id) {
	return `/map/stops/${encodeURIComponent(id)}`;
}
