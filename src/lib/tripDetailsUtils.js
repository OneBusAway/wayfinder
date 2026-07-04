/**
 * Locate the vehicle's current stop within a trip's ordered `stopTimes`, using
 * the stop IDs the server reports for exactly this purpose. `closestStop` is the
 * stop nearest the vehicle's current position; fall back to `nextStop`.
 *
 * This intentionally does NOT infer position from raw lat/lon: that assumed
 * stops were ordered monotonically by coordinate, which is false on most route
 * directions and highlighted the wrong stop.
 *
 * @param {{ closestStop?: string, nextStop?: string } | null | undefined} status
 * @param {Array<{ stopId: string }> | null | undefined} stopTimes
 * @returns {number} index into `stopTimes`, or -1 when it can't be determined
 */
export function resolveVehicleStopIndex(status, stopTimes) {
	if (!status || !stopTimes) return -1;

	const targetStopId = status.closestStop || status.nextStop;
	return targetStopId ? stopTimes.findIndex((st) => st.stopId === targetStopId) : -1;
}
