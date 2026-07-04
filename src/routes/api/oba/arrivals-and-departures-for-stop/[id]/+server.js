import oba, { handleOBAResponse } from '$lib/obaSdk.js';
import { getAgencyFilter, filterByRouteId } from '$lib/agencyFilter.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, url }) {
	const stopID = params.id;

	// Optional time-window controls. `minutesAfter` lets the client request a
	// wider window ("load more arrivals"); both fall back to the OBA defaults
	// when absent or invalid.
	const query = {};
	const minutesAfter = Number(url.searchParams.get('minutesAfter'));
	const minutesBefore = Number(url.searchParams.get('minutesBefore'));
	if (Number.isFinite(minutesAfter) && minutesAfter > 0) {
		query.minutesAfter = minutesAfter;
	}
	if (Number.isFinite(minutesBefore) && minutesBefore > 0) {
		query.minutesBefore = minutesBefore;
	}

	const response = await oba.arrivalAndDeparture.list(stopID, query);

	if (response.data?.entry?.arrivalsAndDepartures) {
		response.data.entry.arrivalsAndDepartures = filterByRouteId(
			response.data.entry.arrivalsAndDepartures,
			getAgencyFilter()
		);
	}

	return handleOBAResponse(response, 'arrivals-and-departures-for-stop');
}
