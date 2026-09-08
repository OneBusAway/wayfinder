import { env } from '$env/dynamic/public';
import { getTodayDateForInput } from '$lib/dateTimeInput.js';
import oba, { handleOBAResponse } from '$lib/obaSdk';
import { getTripHeadsigns } from '$lib/server/tripHeadsigns.js';
import { getAgencyFilter, filterByRouteId } from '$lib/agencyFilter.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, params }) {
	const stopId = params.stopId;
	// Resolve once before either upstream call, including requests crossing midnight.
	// An undated stop response's entry.date is wall-clock time, not a service-day key.
	const date = url.searchParams.get('date') || getTodayDateForInput(env.PUBLIC_OBA_TIMEZONE);
	const queryParams = { date };

	const response = await oba.scheduleForStop.retrieve(stopId, queryParams);

	if (response.data?.entry?.stopRouteSchedules) {
		const routeSchedules = filterByRouteId(
			response.data.entry.stopRouteSchedules,
			getAgencyFilter()
		);
		response.data.entry.stopRouteSchedules = routeSchedules;
		await addTripHeadsigns(routeSchedules, date);
	}

	return handleOBAResponse(response, 'stop-for-schedule');
}

async function addTripHeadsigns(routeSchedules, date) {
	await Promise.all(
		routeSchedules.map(async (routeSchedule) => {
			const directions = routeSchedule?.stopRouteDirectionSchedules;
			if (!routeSchedule?.routeId || !Array.isArray(directions)) return;
			const stopTimesByDirection = directions.map((direction) =>
				Array.isArray(direction?.scheduleStopTimes)
					? direction.scheduleStopTimes.filter((stopTime) => stopTime?.tripId)
					: []
			);
			if (
				!stopTimesByDirection.some((times) => new Set(times.map((time) => time.tripId)).size > 1)
			) {
				return;
			}

			try {
				const tripHeadsigns = await getTripHeadsigns(routeSchedule.routeId, date);
				for (const stopTime of stopTimesByDirection.flat()) {
					const tripHeadsign = tripHeadsigns.get(stopTime.tripId);
					if (tripHeadsign) stopTime.tripHeadsign = tripHeadsign;
				}
			} catch (error) {
				console.error(`Unable to load trip headsigns for route ${routeSchedule.routeId}:`, error);
			}
		})
	);
}
