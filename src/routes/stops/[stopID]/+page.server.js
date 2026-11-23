/* eslint-disable no-restricted-syntax */
import oba, { callOBA } from '$lib/obaSdk.js';
import { getAgencyFilter, filterByRouteId } from '$lib/agencyFilter.js';

export async function load({ params }) {
	const stopID = params.stopID;

	const stopResponse = await callOBA(() => oba.stop.retrieve(stopID), 'stop');

	const arrivalsAndDeparturesResponse = await callOBA(
		() => oba.arrivalAndDeparture.list(stopID),
		'arrivals-and-departures-for-stop'
	);

	if (arrivalsAndDeparturesResponse.data?.entry?.arrivalsAndDepartures) {
		arrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures = filterByRouteId(
			arrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures,
			getAgencyFilter()
		);
	}

	return {
		stopID: params.stopID,
		stopData: stopResponse.data,
		arrivalsAndDeparturesResponse
	};
}
