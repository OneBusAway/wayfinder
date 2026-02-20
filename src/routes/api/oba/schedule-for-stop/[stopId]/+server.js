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
		response.data.entry.stopRouteSchedules = filterByRouteId(
			response.data.entry.stopRouteSchedules,
			getAgencyFilter()
		);
	}

	return handleOBAResponse(response, 'stop-for-schedule');
}
