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
	const responseBody = await response.json();
	if (!response.ok) {
		console.warn('fetchVehicles: request failed', routeId, response.status);
		return { references: { trips: [] }, list: [] };
	}
	const data = responseBody.data;
	if (!data?.references?.trips || !Array.isArray(data.list)) {
		return { references: { trips: [] }, list: [] };
	}
	return data;
}

export async function updateVehicleMarkers(routeId, mapProvider, routeType) {
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
		if (activeTrip && activeTrip?.routeId === routeId && tripStatus.status?.status !== 'CANCELED') {
			const vehicleStatus = tripStatus.status;

			activeTripIds.add(activeTripId);

			if (vehicleMarkersMap.has(activeTripId)) {
				const marker = vehicleMarkersMap.get(activeTripId);

				mapProvider.updateVehicleMarker(marker, vehicleStatus, activeTrip, routeType);
			} else {
				const marker = mapProvider.addVehicleMarker(vehicleStatus, activeTrip, routeType);
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

export async function fetchAndUpdateVehicles(routeId, mapProvider, routeType) {
	await updateVehicleMarkers(routeId, mapProvider, routeType);

	return setInterval(() => updateVehicleMarkers(routeId, mapProvider, routeType), 30000);
}

export function clearVehicleMarkersMap() {
	vehicleMarkersMap.clear();
	activeTripMap.clear();
}
