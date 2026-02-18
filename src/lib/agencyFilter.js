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
 * OBA route IDs follow the convention: agencyId_routeNumber
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
 * @param {Array | null} routes
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
 * @param {Array | null} stops
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
 * Filters arrivals by routeId prefix.
 * @param {Array | null} arrivals
 * @param {Set<string> | null} agencyIds
 * @returns {Array}
 */
export function filterArrivals(arrivals, agencyIds) {
	if (!arrivals) return [];
	if (!agencyIds) return arrivals;
	return arrivals.filter((arrival) => routeBelongsToAgency(arrival.routeId, agencyIds));
}

/**
 * Filters stop route schedules by routeId prefix.
 * @param {Array | null} schedules
 * @param {Set<string> | null} agencyIds
 * @returns {Array}
 */
export function filterScheduleRoutes(schedules, agencyIds) {
	if (!schedules) return [];
	if (!agencyIds) return schedules;
	return schedules.filter((schedule) => routeBelongsToAgency(schedule.routeId, agencyIds));
}

/**
 * Checks if a GTFS-RT alert belongs to one of the target agencies.
 * Matches on informedEntity agencyId or routeId prefix.
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
