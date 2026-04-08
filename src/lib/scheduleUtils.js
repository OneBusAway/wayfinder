import { msToTimeString } from '$lib/dateTimeFormat.js';

export function groupStopTimesByHour(stopTimes, mainHeadsign) {
	const grouped = {};
	for (let stopTime of stopTimes) {
		const date = new Date(stopTime.arrivalTime);
		const hour = date.getHours();
		if (!grouped[hour]) grouped[hour] = [];
		grouped[hour].push({
			arrivalTime: msToTimeString(stopTime.arrivalTime),
			timestamp: stopTime.arrivalTime,
			stopHeadsign: stopTime.stopHeadsign ?? null,
			isShortLine: !!(stopTime.stopHeadsign && stopTime.stopHeadsign !== mainHeadsign)
		});
	}
	return grouped;
}
