import { env } from '$env/dynamic/private';

/**
 * Returns a Set of agency IDs from the PRIVATE_OBA_AGENCY_FILTER env var,
 * or null if the filter is not configured.
 * @returns {Set<string> | null}
 */
export function getAgencyFilter() {
	const raw = env.PRIVATE_OBA_AGENCY_FILTER;
	if (!raw) return null;
	const ids = raw
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
	return ids.length > 0 ? new Set(ids) : null;
}

/**
 * Checks if a route ID belongs to one of the target agencies.
 * OBA route IDs follow the convention: agencyId_routeNumber.
 * If the route ID contains no underscore, the entire ID is treated as the agency prefix.
 * @param {string | null} routeId
 * @param {Set<string> | null} agencyIds
 * @returns {boolean}
 */
export function routeBelongsToAgency(routeId, agencyIds) {
	if (!routeId || !agencyIds) return false;
	const prefix = routeId.split('_')[0];
	return agencyIds.has(prefix);
}

/**
 * Filters routes by agencyId field.
 * @param {Array<{agencyId: string}> | null} routes
 * @param {Set<string> | null} agencyIds
 * @returns {Array}
 */
export function filterRoutes(routes, agencyIds) {
	if (!routes) return [];
	if (!agencyIds) return routes;
	return routes.filter((route) => agencyIds.has(route.agencyId));
}

/**
 * Filters stops to only those serving routes from target agencies.
 * @param {Array<{routeIds?: string[]}> | null} stops
 * @param {Set<string> | null} agencyIds
 * @returns {Array}
 */
export function filterStops(stops, agencyIds) {
	if (!stops) return [];
	if (!agencyIds) return stops;
	return stops.filter((stop) => {
		const routeIds = stop.routeIds;
		if (!routeIds || routeIds.length === 0) return false;
		return routeIds.some((routeId) => routeBelongsToAgency(routeId, agencyIds));
	});
}

/**
 * Filters items (arrivals or schedule routes) by routeId prefix.
 * @param {Array<{routeId: string}> | null} items
 * @param {Set<string> | null} agencyIds
 * @returns {Array}
 */
export function filterByRouteId(items, agencyIds) {
	if (!items) return [];
	if (!agencyIds) return items;
	return items.filter((item) => routeBelongsToAgency(item.routeId, agencyIds));
}

/**
 * Checks if a GTFS-RT alert belongs to one of the target agencies.
 * Matches on informedEntity agencyId or routeId prefix.
 * Returns true (passthrough) when agencyIds is null, meaning all alerts
 * are shown when no filter is configured.
 * @param {{ informedEntity?: Array<{ agencyId?: string, routeId?: string }> }} alert
 * @param {Set<string> | null} agencyIds
 * @returns {boolean}
 */
export function alertBelongsToAgency(alert, agencyIds) {
	if (!agencyIds) return true;
	return (
		alert.informedEntity?.some((entity) => {
			if (entity.agencyId && agencyIds.has(entity.agencyId)) return true;
			if (entity.routeId && routeBelongsToAgency(entity.routeId, agencyIds)) return true;
			return false;
		}) ?? false
	);
}
