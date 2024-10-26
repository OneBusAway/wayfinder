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
	return responseBody.data || {};
}

export async function updateVehicleMarkers(routeId, mapProvider) {
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

		if (activeTrip && activeTrip?.routeId === routeId && tripStatus.status !== 'CANCELED') {
			const vehicleStatus = tripStatus.status;

			activeTripIds.add(activeTripId);

			if (vehicleMarkersMap.has(activeTripId)) {
				const marker = vehicleMarkersMap.get(activeTripId);

				mapProvider.updateVehicleMarker(marker, vehicleStatus, activeTrip);
			} else {
				const marker = mapProvider.addVehicleMarker(vehicleStatus, activeTrip);
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

export async function fetchAndUpdateVehicles(routeId, mapProvider) {
	await updateVehicleMarkers(routeId, mapProvider);

	return setInterval(() => updateVehicleMarkers(routeId, mapProvider), 30000);
}

export function clearVehicleMarkersMap() {
	vehicleMarkersMap.clear();
	activeTripMap.clear();
}
