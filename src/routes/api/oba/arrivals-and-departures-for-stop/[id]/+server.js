import oba, { handleOBAResponse } from '$lib/obaSdk.js';
import { getAgencyFilter, filterArrivals } from '$lib/agencyFilter.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const stopID = params.id;
	const response = await oba.arrivalAndDeparture.list(stopID);

	const agencyFilter = getAgencyFilter();
	if (agencyFilter && response.data?.entry?.arrivalsAndDepartures) {
		response.data.entry.arrivalsAndDepartures = filterArrivals(
			response.data.entry.arrivalsAndDepartures,
			agencyFilter
		);
	}

	return handleOBAResponse(response, 'arrivals-and-departures-for-stop');
}
