import oba, { handleOBAResponse } from '$lib/obaSdk.js';
import { getAgencyFilter, filterArrivals } from '$lib/agencyFilter.js';

export async function load({ params }) {
	const stopID = params.stopID;

	const stopResponse = await oba.stop.retrieve(stopID);
	const stopBody = await handleOBAResponse(stopResponse, 'stop').json();

	const arrivalsAndDeparturesResponse = await oba.arrivalAndDeparture.list(stopID);

	const arrivalsAndDeparturesResponseJSON = await handleOBAResponse(
		arrivalsAndDeparturesResponse,
		'arrivals-and-departures-for-stop'
	).json();

	const agencyFilter = getAgencyFilter();
	if (agencyFilter && arrivalsAndDeparturesResponseJSON.data?.entry?.arrivalsAndDepartures) {
		arrivalsAndDeparturesResponseJSON.data.entry.arrivalsAndDepartures = filterArrivals(
			arrivalsAndDeparturesResponseJSON.data.entry.arrivalsAndDepartures,
			agencyFilter
		);
	}

	return {
		stopID: params.stopID,
		stopData: stopBody.data,
		arrivalsAndDeparturesResponse: arrivalsAndDeparturesResponseJSON
	};
}
