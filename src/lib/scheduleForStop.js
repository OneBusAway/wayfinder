import { msToTimeString } from '$lib/dateTimeFormat.js';

/**
 * Arrange a direction's stop times for the schedule table and flag trips that
 * end before the direction's normal destination.
 *
 * `stopHeadsign` is not populated by OBA's schedule-for-stop endpoint. The
 * route handler adds the per-trip `tripHeadsign` from schedule-for-route.
 */
export function groupStopTimesByHour(stopTimes, directionHeadsign) {
	const grouped = {};
	for (const stopTime of stopTimes) {
		const hour = new Date(stopTime.arrivalTime).getHours();
		if (!grouped[hour]) grouped[hour] = [];

		const destination = stopTime.tripHeadsign?.trim() || directionHeadsign;
		grouped[hour].push({
			arrivalTime: msToTimeString(stopTime.arrivalTime),
			destination,
			isShortLine: destination !== directionHeadsign
		});
	}

	return grouped;
}
