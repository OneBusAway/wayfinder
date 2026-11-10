import oba, { handleOBAResponse } from '$lib/obaSdk.js';
import {
	getAgencyFilter,
	filterByRouteId,
	filterRoutes,
	filterRouteIds
} from '$lib/agencyFilter.js';

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

	if (arrivalsAndDeparturesResponseJSON.data?.entry?.arrivalsAndDepartures) {
		arrivalsAndDeparturesResponseJSON.data.entry.arrivalsAndDepartures = filterByRouteId(
			arrivalsAndDeparturesResponseJSON.data.entry.arrivalsAndDepartures,
			agencyFilter
		);
	}

	if (agencyFilter) {
		if (stopBody.data?.entry?.routeIds) {
			stopBody.data.entry.routeIds = filterRouteIds(stopBody.data.entry.routeIds, agencyFilter);
		}
		if (stopBody.data?.references?.routes) {
			stopBody.data.references.routes = filterRoutes(stopBody.data.references.routes, agencyFilter);
		}
	}

	return {
		stopID: params.stopID,
		stopData: stopBody.data,
		arrivalsAndDeparturesResponse: arrivalsAndDeparturesResponseJSON
	};
}
