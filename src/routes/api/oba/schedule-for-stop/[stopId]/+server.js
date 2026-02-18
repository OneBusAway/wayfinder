import oba, { handleOBAResponse } from '$lib/obaSdk';
import { getAgencyFilter, filterScheduleRoutes } from '$lib/agencyFilter.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, params }) {
	const stopId = params.stopId;
	const date = url.searchParams.get('date');

	let queryParams = {};
	if (date) {
		queryParams.date = date;
	}

	const response = await oba.scheduleForStop.retrieve(stopId, queryParams);

	const agencyFilter = getAgencyFilter();
	if (agencyFilter && response.data?.entry?.stopRouteSchedules) {
		response.data.entry.stopRouteSchedules = filterScheduleRoutes(
			response.data.entry.stopRouteSchedules,
			agencyFilter
		);
	}

	return handleOBAResponse(response, 'stop-for-schedule');
}
