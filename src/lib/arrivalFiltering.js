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

/**
 * True when `arrival` is the row for a trip's final stop with a vehicle
 * assigned -- the only rows that can be the arrival half of a layover pair.
 */
function endsTripHere(arrival) {
	return arrival.stopSequence === arrival.totalStopsInTrip - 1 && Boolean(arrival.vehicleId);
}

/**
 * True when `departure` is the same vehicle beginning the next trip of its
 * block right after finishing `arrival`'s trip at this stop.
 *
 * "Next trip" is pinned to blockTripSequence + 1 so a vehicle on a short route
 * that revisits the stop later in the window (trip N+2, N+3, ...) is not
 * merged with an unrelated earlier arrival.
 */
function continuesTrip(arrival, departure) {
	return (
		departure.stopSequence === 0 &&
		departure.vehicleId === arrival.vehicleId &&
		departure.serviceDate === arrival.serviceDate &&
		departure.blockTripSequence === arrival.blockTripSequence + 1
	);
}

/**
 * Collapses layover pairs: when a vehicle ends one trip at this stop and
 * begins its next trip here, the API returns two rows for one parked bus --
 * the arrival on the finishing trip's final stop and the departure on the
 * next trip's first stop. Drops the arrival row and keeps the departure the
 * rider can actually board.
 *
 * Matching is by vehicleId, so rows with no vehicle assigned (schedule-only
 * data, or a trip before AVL picks it up) are never collapsed.
 *
 * @param {Array<object>} arrivals - Array of arrival/departure objects from OBA API
 * @returns {Array<object>} Arrivals with layover arrival rows removed
 */
export function collapseLayovers(arrivals) {
	if (!arrivals || arrivals.length === 0) return [];

	return arrivals.filter(
		(arrival) =>
			!(
				arrival &&
				endsTripHere(arrival) &&
				arrivals.some((other) => other && continuesTrip(arrival, other))
			)
	);
}

/**
 * The rows a rider should see for a stop: departed rows removed (when a clock
 * is supplied), then layover pairs collapsed. Every consumer that renders or
 * reasons about the arrival list (StopPane, the map's active-route picker)
 * goes through this so they cannot disagree about which trips are boardable.
 *
 * @param {Array<object>} arrivals - Array of arrival/departure objects from OBA API
 * @param {number} [now] - Current time in ms since epoch; omit to skip the
 *   clock-dependent departed filter (e.g. a server-rendered seed that must
 *   hydrate identically on the client)
 * @returns {Array<object>} Boardable arrivals in their original order
 */
export function visibleArrivals(arrivals, now) {
	const upcoming = Number.isFinite(now) ? filterDeparted(arrivals, now) : arrivals;
	return collapseLayovers(upcoming);
}
