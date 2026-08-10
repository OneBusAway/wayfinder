/**
 * Arrival filtering utilities for dynamic arrival list updates.
 *
 * Pure functions with no side effects — safe to import anywhere and
 * straightforward to unit-test without mocking Svelte or the DOM.
 */

const MS_IN_MINS = 60000;

/**
 * Produces a stable composite key for an arrival, used to identify the same
 * trip visit across successive poll responses. stopSequence is required so a
 * loop/circulator that serves the same stop twice in one trip does not share
 * a keyed {#each} identity.
 *
 * @param {{ tripId: string, serviceDate: number, stopSequence?: number }} arrival
 * @returns {string} Stable composite key for diffing across polls
 */
export function makeKey(arrival) {
	return `${arrival.tripId}_${arrival.serviceDate}_${arrival.stopSequence}`;
}

/**
 * Filters out arrivals whose best estimated time of arrival (ETA) is negative,
 * meaning the vehicle has already arrived at the stop (as the row displays it).
 *
 * ETA is computed as:
 *   bestTimeMins - nowMins
 * where bestTime is the predicted arrival time when prediction is available
 * and > 0, otherwise the scheduled arrival time.
 *
 * Must stay aligned with ArrivalDeparture.svelte, which defaults
 * `stopSequence || 1` and therefore always renders an arrival-time ETA.
 * Do not special-case stopSequence === 0 here or first-stop layover rows
 * will show "arrived N min ago" while remaining in the list.
 *
 * @param {Array<object>} arrivals - Array of arrival/departure objects from OBA API
 * @param {number} now - Current time in milliseconds since epoch
 * @returns {Array<object>} Filtered array containing only non-departed arrivals (ETA >= 0)
 */
export function filterDeparted(arrivals, now) {
	if (!arrivals || arrivals.length === 0) return [];

	const nowMins = Math.floor(now / MS_IN_MINS);

	return arrivals.filter((arrival) => {
		const predictedArrival = arrival.predictedArrivalTime;
		const scheduledArrival = arrival.scheduledArrivalTime;

		const bestTime =
			arrival.predicted && predictedArrival > 0 ? predictedArrival : scheduledArrival;

		const eta = Math.floor(bestTime / MS_IN_MINS) - nowMins;
		return eta >= 0;
	});
}
