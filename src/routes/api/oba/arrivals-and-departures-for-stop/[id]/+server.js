import oba, { handleOBAResponse } from '$lib/obaSdk.js';
import { getAgencyFilter, filterByRouteId } from '$lib/agencyFilter.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const stopID = params.id;
	const response = await oba.arrivalAndDeparture.list(stopID);

	if (response.data?.entry?.arrivalsAndDepartures) {
		response.data.entry.arrivalsAndDepartures = filterByRouteId(
			response.data.entry.arrivalsAndDepartures,
			getAgencyFilter()
		);
	}

	return handleOBAResponse(response, 'arrivals-and-departures-for-stop');
}
