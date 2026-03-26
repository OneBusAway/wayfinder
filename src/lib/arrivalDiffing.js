/**
 * Arrival filtering utilities for dynamic arrival list updates.
 *
 * Pure functions with no side effects — safe to import anywhere and
 * straightforward to unit-test without mocking Svelte or the DOM.
 */

const MS_IN_MINS = 60000;

/**
 * Produces a stable composite key for an arrival, used to identify the same
 * trip across successive poll responses.
 *
 * @param {{ tripId: string, serviceDate: number }} arrival
 * @returns {string} Stable composite key for diffing across polls
 */
export function makeKey(arrival) {
	return `${arrival.tripId}_${arrival.serviceDate}`;
}

/**
 * Filters out arrivals whose best estimated time of arrival (ETA) is negative,
 * meaning the bus has already departed the stop.
 *
 * ETA is computed as:
 *   bestTimeMins - nowMins
 * where bestTime is the predicted time when prediction is available and > 0,
 * otherwise the scheduled time.
 *
 * For stopSequence === 0 (first stop in a trip), departure times are used
 * instead of arrival times.
 *
 * @param {Array<object>} arrivals - Array of arrival/departure objects from OBA API
 * @param {number} now - Current time in milliseconds since epoch
 * @returns {Array<object>} Filtered array containing only non-departed arrivals (ETA >= 0)
 */
export function filterDeparted(arrivals, now) {
	if (!arrivals || arrivals.length === 0) return [];

	const nowMins = Math.floor(now / MS_IN_MINS);

	return arrivals.filter((arrival) => {
		let bestTime;

		if (arrival.stopSequence === 0) {
			// First stop in trip — use departure times
			const bestPredictedDeparture = arrival.predictedDepartureTime;
			const scheduledDeparture = arrival.scheduledDepartureTime;

			if (arrival.predicted && bestPredictedDeparture > 0) {
				bestTime = bestPredictedDeparture;
			} else {
				bestTime = scheduledDeparture;
			}
		} else {
			// All other stops — use arrival times
			const bestPredictedArrival = arrival.predictedArrivalTime;
			const scheduledArrival = arrival.scheduledArrivalTime;

			if (arrival.predicted && bestPredictedArrival > 0) {
				bestTime = bestPredictedArrival;
			} else {
				bestTime = scheduledArrival;
			}
		}

		const eta = Math.floor(bestTime / MS_IN_MINS) - nowMins;
		return eta >= 0;
	});
}

