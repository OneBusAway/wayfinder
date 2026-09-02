import oba, { handleOBAResponse } from '$lib/obaSdk';
import { getAgencyFilter, filterByRouteId } from '$lib/agencyFilter.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, params }) {
	const stopId = params.stopId;
	const date = url.searchParams.get('date');

	let queryParams = {};
	if (date) {
		queryParams.date = date;
	}

	const response = await oba.scheduleForStop.retrieve(stopId, queryParams);

	if (response.data?.entry?.stopRouteSchedules) {
		const routeSchedules = filterByRouteId(
			response.data.entry.stopRouteSchedules,
			getAgencyFilter()
		);
		response.data.entry.stopRouteSchedules = routeSchedules;
		await addTripHeadsigns(routeSchedules, queryParams);
	}

	return handleOBAResponse(response, 'stop-for-schedule');
}

async function addTripHeadsigns(routeSchedules, queryParams) {
	const routeSchedulesWithMultipleTrips = routeSchedules.filter((routeSchedule) =>
		routeSchedule.stopRouteDirectionSchedules.some(
			(directionSchedule) =>
				new Set(directionSchedule.scheduleStopTimes.map(({ tripId }) => tripId)).size > 1
		)
	);

	const routeResponses = await Promise.all(
		routeSchedulesWithMultipleTrips.map(async ({ routeId }) => {
			try {
				return await oba.scheduleForRoute.retrieve(routeId, queryParams);
			} catch (error) {
				console.error(`Unable to load trip headsigns for route ${routeId}:`, error);
				return null;
			}
		})
	);

	const tripHeadsigns = new Map(
		routeResponses.flatMap((routeResponse) =>
			(routeResponse?.data?.entry?.trips ?? []).flatMap(({ id, tripHeadsign }) =>
				tripHeadsign ? [[id, tripHeadsign]] : []
			)
		)
	);

	for (const routeSchedule of routeSchedulesWithMultipleTrips) {
		for (const directionSchedule of routeSchedule.stopRouteDirectionSchedules) {
			for (const stopTime of directionSchedule.scheduleStopTimes) {
				const tripHeadsign = tripHeadsigns.get(stopTime.tripId);
				if (tripHeadsign) stopTime.tripHeadsign = tripHeadsign;
			}
		}
	}
}
