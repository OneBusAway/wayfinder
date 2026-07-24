/**
 * Derives the set of routes a rider can actually board from a stop, from that
 * stop's arrivals-and-departures response.
 *
 * This is deliberately narrower than "routes the stop is signed for": a stop
 * signed "128, 22, 773, C Line" whose 773 has no arrival in the current window
 * yields three routes, not four. A line on the map then means "a bus you can
 * catch from here is running this route now."
 */

/**
 * @typedef {Object} ActiveRoute
 * @property {string} id
 * @property {string} shortName
 * @property {number} type
 * @property {string} tripId
 * @property {string|null} gtfsColor
 */

/**
 * Effective arrival time for ordering.
 *
 * OBA sends `predictedArrivalTime: 0` — not null — when there is no real-time
 * prediction, so `predictedArrivalTime ?? scheduledArrivalTime` would read every
 * unpredicted arrival as "arriving at the epoch" and sort it to the front. This
 * mirrors the guard ArrivalDeparture.svelte already uses to pick its display time.
 * @param {Object} arrival
 * @returns {number}
 */
function effectiveArrivalTime(arrival) {
	return arrival.predicted && arrival.predictedArrivalTime > 0
		? arrival.predictedArrivalTime
		: arrival.scheduledArrivalTime;
}

/**
 * @param {Object} response - an /arrivals-and-departures-for-stop response
 * @returns {ActiveRoute[]} distinct routes, soonest arrival first
 */
export function activeRoutesFromArrivals(response) {
	const arrivals = response?.data?.entry?.arrivalsAndDepartures;
	if (!Array.isArray(arrivals)) return [];

	const routeRefs = new Map(
		(response?.data?.references?.routes ?? []).map((route) => [route.id, route])
	);

	/** @type {Map<string, {arrival: Object, time: number}>} */
	const soonestByRoute = new Map();

	for (const arrival of arrivals) {
		const routeId = arrival?.routeId;
		if (!routeId) continue;

		const time = effectiveArrivalTime(arrival);
		const existing = soonestByRoute.get(routeId);
		if (!existing || time < existing.time) {
			soonestByRoute.set(routeId, { arrival, time });
		}
	}

	return [...soonestByRoute.entries()]
		.sort((a, b) => a[1].time - b[1].time)
		.map(([routeId, { arrival }]) => {
			const ref = routeRefs.get(routeId);
			return {
				id: routeId,
				shortName: ref?.shortName ?? arrival.routeShortName ?? '',
				type: ref?.type ?? 3,
				tripId: arrival.tripId,
				gtfsColor: ref?.color || null
			};
		});
}
