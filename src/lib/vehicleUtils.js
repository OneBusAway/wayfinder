/**
 * @type {Map<activeTripId, trip>}
 * for faster lookup
 */

const activeTripMap = new Map();

/**
 * @type {Map<vehicleId, {marker, routeId}>}
 * Keyed by the physical vehicle id. The trips-for-route response can report the
 * same activeTripId for two different vehicles (e.g. the vehicle actually serving
 * the trip plus a second one still parked at the base), so keying by trip id
 * collapsed both into one marker that flipped between their positions on every
 * refresh. Falls back to activeTripId only when a status has no vehicleId.
 * see (https://developer.onebusaway.org/api/where/elements/trip-status)
 *
 * `routeId` records which route owns each marker, so a sweep across several
 * concurrently-polled routes only removes markers belonging to routes it
 * actually fetched.
 */
const vehicleMarkersMap = new Map();

/**
 * @returns {Promise<Object|null>} the trips-for-route payload, or `null` when
 * the request failed or came back malformed.
 *
 * Failure and emptiness must be distinguishable: a caller sweeping stale markers
 * across several routes would otherwise read a 500 as "this route has no
 * vehicles" and delete every marker the route owns.
 */
export async function fetchVehicles(routeId) {
	const response = await fetch(`/api/oba/trips-for-route/${routeId}`);
	if (!response.ok) {
		console.warn('fetchVehicles: request failed', routeId, response.status);
		return null;
	}
	const responseBody = await response.json();
	const data = responseBody.data;
	if (!data?.references?.trips || !Array.isArray(data.list)) {
		console.warn('fetchVehicles: unexpected response structure for route', routeId);
		return null;
	}
	return data;
}

/**
 * Draws/updates the vehicles for one route from an already-fetched payload, and
 * returns the marker keys this route currently owns.
 */
function applyRouteVehicles(data, routeId, mapProvider, routeType, highlightedTripId, routeColor) {
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

			const existing = vehicleMarkersMap.get(markerKey);
			if (existing) {
				mapProvider.updateVehicleMarker(
					existing.marker,
					vehicleStatus,
					activeTrip,
					routeType,
					isHighlighted,
					routeColor
				);
				// A physical vehicle can move between routes across a shift; re-stamp
				// ownership so the sweep attributes it to the route reporting it now.
				existing.routeId = routeId;
			} else {
				const marker = mapProvider.addVehicleMarker(
					vehicleStatus,
					activeTrip,
					routeType,
					isHighlighted,
					routeColor
				);
				vehicleMarkersMap.set(markerKey, { marker, routeId });
			}
		}
	}

	return activeKeys;
}

/**
 * Removes markers that are no longer active — but only among routes we actually
 * polled successfully. A route whose fetch failed keeps its markers.
 *
 * @param {Set<string>} activeKeys
 * @param {Object} mapProvider
 * @param {Set<string>|null} [polledRouteIds] - when omitted, every marker is in
 * scope (single-route callers didn't fetch a subset).
 */
export function removeInactiveMarkers(activeKeys, mapProvider, polledRouteIds = null) {
	for (const [markerKey, entry] of vehicleMarkersMap) {
		if (polledRouteIds && !polledRouteIds.has(entry.routeId)) continue;
		if (!activeKeys.has(markerKey)) {
			mapProvider.removeVehicleMarker(entry.marker);
			vehicleMarkersMap.delete(markerKey);
		}
	}
}

const VEHICLE_POLL_INTERVAL_MS = 30000;

/**
 * Polls several routes' vehicles on one interval.
 *
 * @param {Array<{id: string, type?: number}>} routes
 * @param {Object} mapProvider
 * @param {{highlightedTripId?: string|null|(() => string|null), colorsByRouteId?: Map<string,{line:string}>, onCounts?: Function}} [options]
 * `highlightedTripId` may be a plain value (captured once, for callers that
 * genuinely never change it) or a getter function, resolved fresh on every
 * tick — the trip-expansion glow needs the latter: the poll is started once
 * per route-set redraw, but the highlighted trip changes independently of
 * that redraw (see StopRoutesLayer's second effect), so a value captured at
 * start time would go stale until the next redraw.
 * @returns {Promise<{intervalId: number, tick: () => Promise<void>}>} the
 * poll's interval id, plus `tick` so a caller can force an immediate refresh
 * (e.g. to move the highlight glow right away) instead of waiting up to
 * VEHICLE_POLL_INTERVAL_MS for the next scheduled one.
 */
export async function fetchAndUpdateVehiclesForRoutes(
	routes,
	mapProvider,
	{ highlightedTripId = null, colorsByRouteId = new Map(), onCounts = null } = {}
) {
	const resolveHighlightedTripId = () =>
		typeof highlightedTripId === 'function' ? highlightedTripId() : highlightedTripId;

	const tick = async () => {
		const results = await Promise.all(
			routes.map((route) =>
				fetchVehicles(route.id).catch((error) => {
					console.error('fetchAndUpdateVehiclesForRoutes: fetch failed', route.id, error);
					return null;
				})
			)
		);

		const activeKeys = new Set();
		const polledRouteIds = new Set();
		const counts = new Map();

		routes.forEach((route, index) => {
			const data = results[index];
			// null means the fetch failed, which is NOT the same as "no vehicles".
			// Leave this route out of the sweep scope so its markers survive.
			if (!data) return;

			// A synchronous throw here (e.g. a map-provider bug) must not abort the
			// routes ordered after this one in the forEach, nor skip the sweep below.
			// Treat it the same as a failed fetch: leave the route's markers alone.
			try {
				const routeKeys = applyRouteVehicles(
					data,
					route.id,
					mapProvider,
					route.type,
					resolveHighlightedTripId(),
					colorsByRouteId.get(route.id)?.line
				);
				polledRouteIds.add(route.id);
				routeKeys.forEach((key) => activeKeys.add(key));
				counts.set(route.id, routeKeys.size);
			} catch (error) {
				console.error(
					'fetchAndUpdateVehiclesForRoutes: applying route vehicles failed',
					route.id,
					error
				);
			}
		});

		removeInactiveMarkers(activeKeys, mapProvider, polledRouteIds);
		if (onCounts) onCounts(counts);
	};

	try {
		await tick();
	} catch (error) {
		console.error('fetchAndUpdateVehiclesForRoutes: initial tick failed', error);
	}

	const intervalId = setInterval(() => {
		tick().catch((error) => {
			console.error('fetchAndUpdateVehiclesForRoutes: polling tick failed', error);
		});
	}, VEHICLE_POLL_INTERVAL_MS);

	return { intervalId, tick };
}

/**
 * Single-route wrapper, kept so SearchPane and RouteMap run through the same
 * code path. Signature and behavior are unchanged: unlike
 * `fetchAndUpdateVehiclesForRoutes`, this still resolves to a bare interval
 * id — SearchPane.svelte and RouteMap.svelte both do
 * `currentIntervalId = await fetchAndUpdateVehicles(...)` and later
 * `clearInterval(currentIntervalId)`, so returning `{ intervalId, tick }`
 * here instead would silently break both.
 */
export async function fetchAndUpdateVehicles(
	routeId,
	mapProvider,
	routeType,
	highlightedTripId = null,
	routeColor = undefined
) {
	const { intervalId } = await fetchAndUpdateVehiclesForRoutes(
		[{ id: routeId, type: routeType }],
		mapProvider,
		{
			highlightedTripId,
			colorsByRouteId: routeColor ? new Map([[routeId, { line: routeColor }]]) : new Map()
		}
	);
	return intervalId;
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
