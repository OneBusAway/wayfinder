/**
 * @type {Map<activeTripId, trip>}
 * for faster lookup
 */

const activeTripMap = new Map();

/**
 * @type {Map<activeTripId, marker>}
 * using activeTripId as key instead of vehicleId
 * see (https://developer.onebusaway.org/api/where/elements/trip-status)
 *
 */
const vehicleMarkersMap = new Map();

export async function fetchVehicles(routeId) {
	const response = await fetch(`/api/oba/trips-for-route/${routeId}`);
	if (!response.ok) {
		console.warn('fetchVehicles: request failed', routeId, response.status);
		return { references: { trips: [] }, list: [] };
	}
	const responseBody = await response.json();
	const data = responseBody.data;
	if (!data?.references?.trips || !Array.isArray(data.list)) {
		console.warn('fetchVehicles: unexpected response structure for route', routeId);
		return { references: { trips: [] }, list: [] };
	}
	return data;
}

export async function updateVehicleMarkers(
	routeId,
	mapProvider,
	routeType,
	highlightedTripId = null
) {
	const data = await fetchVehicles(routeId);

	const activeTripIds = new Set();

	for (const trip of data.references.trips) {
		if (!activeTripMap.has(trip.id)) {
			activeTripMap.set(trip.id, trip);
		}
	}

	for (const tripStatus of data.list) {
		const activeTripId = tripStatus?.status?.activeTripId;
		const activeTrip = activeTripMap.get(activeTripId);

		// OBA puts the trip state string on status.status (e.g. SCHEDULED, CANCELED), not on status itself
		if (activeTrip && activeTrip.routeId === routeId && tripStatus.status?.status !== 'CANCELED') {
			const vehicleStatus = tripStatus.status;
			// Highlight the vehicle serving the trip the user clicked on.
			const isHighlighted = highlightedTripId != null && activeTripId === highlightedTripId;

			activeTripIds.add(activeTripId);

			if (vehicleMarkersMap.has(activeTripId)) {
				const marker = vehicleMarkersMap.get(activeTripId);

				mapProvider.updateVehicleMarker(
					marker,
					vehicleStatus,
					activeTrip,
					routeType,
					isHighlighted
				);
			} else {
				const marker = mapProvider.addVehicleMarker(
					vehicleStatus,
					activeTrip,
					routeType,
					isHighlighted
				);
				vehicleMarkersMap.set(activeTripId, marker);
			}
		}
	}

	removeInactiveMarkers(activeTripIds, mapProvider);
}

export function removeInactiveMarkers(activeTripIds, mapProvider) {
	for (const [activeTripId, marker] of vehicleMarkersMap) {
		if (!activeTripIds.has(activeTripId)) {
			mapProvider.removeVehicleMarker(marker);
			vehicleMarkersMap.delete(activeTripId);
		}
	}
}

export async function fetchAndUpdateVehicles(
	routeId,
	mapProvider,
	routeType,
	highlightedTripId = null
) {
	try {
		await updateVehicleMarkers(routeId, mapProvider, routeType, highlightedTripId);
	} catch (error) {
		console.error('fetchAndUpdateVehicles: initial fetch failed', routeId, error);
	}

	return setInterval(async () => {
		try {
			await updateVehicleMarkers(routeId, mapProvider, routeType, highlightedTripId);
		} catch (error) {
			console.error('fetchAndUpdateVehicles: polling update failed', routeId, error);
		}
	}, 30000);
}

export function clearVehicleMarkersMap() {
	vehicleMarkersMap.clear();
	activeTripMap.clear();
}

export function buildVehiclePopupData(vehicle, activeTrip, stopsMap) {
	return {
		nextDestination: activeTrip.tripHeadsign,
		vehicleId: vehicle.vehicleId,
		lastUpdateTime: vehicle.lastUpdateTime,
		nextStopName: stopsMap.get(vehicle.nextStop)?.name,
		predicted: vehicle.predicted
	};
}
