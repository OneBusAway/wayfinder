/**
 * @type {Map<activeTripId, trip>}
 * for faster lookup
 */

const activeTripMap = new Map();

/**
 * @type {Map<vehicleId, marker>}
 * Keyed by the physical vehicle id. The trips-for-route response can report the
 * same activeTripId for two different vehicles (e.g. the vehicle actually serving
 * the trip plus a second one still parked at the base), so keying by trip id
 * collapsed both into one marker that flipped between their positions on every
 * refresh. Falls back to activeTripId only when a status has no vehicleId.
 * see (https://developer.onebusaway.org/api/where/elements/trip-status)
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
	highlightedTripId = null,
	routeColor = undefined
) {
	const data = await fetchVehicles(routeId);

	const activeKeys = new Set();

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

			// Key by the physical vehicle so two vehicles sharing an activeTripId
			// don't collide into one marker that jumps between their positions.
			const markerKey = vehicleStatus.vehicleId || activeTripId;

			activeKeys.add(markerKey);

			if (vehicleMarkersMap.has(markerKey)) {
				const marker = vehicleMarkersMap.get(markerKey);

				mapProvider.updateVehicleMarker(
					marker,
					vehicleStatus,
					activeTrip,
					routeType,
					isHighlighted,
					routeColor
				);
			} else {
				const marker = mapProvider.addVehicleMarker(
					vehicleStatus,
					activeTrip,
					routeType,
					isHighlighted,
					routeColor
				);
				vehicleMarkersMap.set(markerKey, marker);
			}
		}
	}

	removeInactiveMarkers(activeKeys, mapProvider);
}

export function removeInactiveMarkers(activeKeys, mapProvider) {
	for (const [markerKey, marker] of vehicleMarkersMap) {
		if (!activeKeys.has(markerKey)) {
			mapProvider.removeVehicleMarker(marker);
			vehicleMarkersMap.delete(markerKey);
		}
	}
}

export async function fetchAndUpdateVehicles(
	routeId,
	mapProvider,
	routeType,
	highlightedTripId = null,
	routeColor = undefined
) {
	try {
		await updateVehicleMarkers(routeId, mapProvider, routeType, highlightedTripId, routeColor);
	} catch (error) {
		console.error('fetchAndUpdateVehicles: initial fetch failed', routeId, error);
	}

	return setInterval(async () => {
		try {
			await updateVehicleMarkers(routeId, mapProvider, routeType, highlightedTripId, routeColor);
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
