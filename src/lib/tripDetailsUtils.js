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

/**
 * Restrict a trip's stop list to the segment the rider cares about: from the
 * vehicle's current position through the rider's selected stop. Stops the bus
 * has already passed (before its current position) and stops beyond the rider's
 * stop are hidden.
 *
 * When the vehicle position is unknown (`busPosition < 0`, e.g. a scheduled
 * trip), the range starts at the first stop — passed stops can't be inferred
 * without a live position. The start is never allowed past the rider's stop.
 *
 * @param {Array<{ stopId: string }> | null | undefined} stopTimes
 * @param {number} busPosition index of the vehicle's current stop, or -1
 * @param {string} riderStopId the rider's selected stop id
 * @returns {{ start: number, end: number }} inclusive index range to render
 *   (`end < start` means nothing should be shown)
 */
export function computeVisibleStopRange(stopTimes, busPosition, riderStopId) {
	if (!stopTimes || stopTimes.length === 0) return { start: 0, end: -1 };

	const lastIndex = stopTimes.length - 1;
	const riderIndex = stopTimes.findIndex((st) => st.stopId === riderStopId);
	const end = riderIndex >= 0 ? riderIndex : lastIndex;
	const rawStart = busPosition >= 0 ? busPosition : 0;
	const start = Math.min(rawStart, end);

	return { start, end };
}
