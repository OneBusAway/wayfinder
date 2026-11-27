/* eslint-disable no-restricted-syntax */
import oba, { callOBA } from '$lib/obaSdk.js';
import {
	getAgencyFilter,
	filterByRouteId,
	filterRoutes,
	filterRouteIds
} from '$lib/agencyFilter.js';

/**
 * Loads stop details and arrivals/departures for a stop,
 * applying agency filtering if configured.
 */
export async function load({ params }) {
	const stopID = params.stopID;

	const stopResponse = await callOBA(() => oba.stop.retrieve(stopID), 'stop');

	const arrivalsAndDeparturesResponse = await callOBA(
		() => oba.arrivalAndDeparture.list(stopID),
		'arrivals-and-departures-for-stop'
	);

	const agencyFilter = getAgencyFilter();

	if (arrivalsAndDeparturesResponse.data?.entry?.arrivalsAndDepartures) {
		arrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures = filterByRouteId(
			arrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures,
			agencyFilter
		);
	}

	if (agencyFilter) {
		if (stopResponse.data?.entry?.routeIds) {
			stopResponse.data.entry.routeIds = filterRouteIds(
				stopResponse.data.entry.routeIds,
				agencyFilter
			);
		}
		if (stopResponse.data?.references?.routes) {
			stopResponse.data.references.routes = filterRoutes(
				stopResponse.data.references.routes,
				agencyFilter
			);
		}
	}

	return {
		stopID: params.stopID,
		stopData: stopResponse.data,
		arrivalsAndDeparturesResponse
	};
}
