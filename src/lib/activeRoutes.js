/**
 * Derives the set of routes a rider can actually board from a stop, from that
 * stop's arrivals-and-departures response.
 *
 * This is deliberately narrower than "routes the stop is signed for": a stop
 * signed "128, 22, 773, C Line" whose 773 has no arrival in the current window
 * yields three routes, not four. A line on the map then means "a bus you can
 * catch from here is running this route now."
 */

/**
 * @typedef {Object} ActiveRoute
 * @property {string} id
 * @property {string} shortName
 * @property {number} type
 * @property {string} tripId
 * @property {string|null} gtfsColor
 */

/**
 * Effective arrival time for ordering.
 *
 * OBA sends `predictedArrivalTime: 0` — not null — when there is no real-time
 * prediction, so `predictedArrivalTime ?? scheduledArrivalTime` would read every
 * unpredicted arrival as "arriving at the epoch" and sort it to the front. This
 * mirrors the guard ArrivalDeparture.svelte already uses to pick its display time.
 * @param {Object} arrival
 * @returns {number}
 */
function effectiveArrivalTime(arrival) {
	return arrival.predicted && arrival.predictedArrivalTime > 0
		? arrival.predictedArrivalTime
		: arrival.scheduledArrivalTime;
}

/**
 * @param {Object} response - an /arrivals-and-departures-for-stop response
 * @returns {ActiveRoute[]} distinct routes, soonest arrival first
 */
export function activeRoutesFromArrivals(response) {
	const arrivals = response?.data?.entry?.arrivalsAndDepartures;
	if (!Array.isArray(arrivals)) return [];

	const routeRefs = new Map(
		(response?.data?.references?.routes ?? []).map((route) => [route.id, route])
	);

	/** @type {Map<string, {arrival: Object, time: number}>} */
	const soonestByRoute = new Map();

	for (const arrival of arrivals) {
		const routeId = arrival?.routeId;
		if (!routeId) continue;

		const time = effectiveArrivalTime(arrival);
		const existing = soonestByRoute.get(routeId);
		if (!existing || time < existing.time) {
			soonestByRoute.set(routeId, { arrival, time });
		}
	}

	return [...soonestByRoute.entries()]
		.sort((a, b) => a[1].time - b[1].time)
		.map(([routeId, { arrival }]) => {
			const ref = routeRefs.get(routeId);
			return {
				id: routeId,
				shortName: ref?.shortName ?? arrival.routeShortName ?? '',
				type: ref?.type ?? 3,
				tripId: arrival.tripId,
				gtfsColor: ref?.color || null
			};
		});
}

import { mapContrastColor, getBrightness, hexToRgb } from '$lib/colorUtils.js';
import { ROUTE_FALLBACK_PALETTE } from '$lib/colors.js';

/**
 * @typedef {Object} RouteColors
 * @property {string} line    - '#rrggbb', for polylines and vehicle markers
 * @property {string} badgeBg - 'rrggbb' (no '#'), for RouteBadge `color`
 * @property {string} badgeFg - 'rrggbb' (no '#'), for RouteBadge `textColor`
 */

// Stable index into the fallback palette. Keyed on the route id rather than the
// route's position in the list so a 30s refresh that reorders arrivals doesn't
// change any route's color.
function paletteIndexFor(routeId) {
	let hash = 0;
	for (let i = 0; i < routeId.length; i++) {
		hash = (hash * 31 + routeId.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % ROUTE_FALLBACK_PALETTE.length;
}

// Badge text: the background is no longer the agency's own color, so the
// agency's textColor (chosen for that original hex) may be unreadable against
// it. Pick from the resolved background instead. 140 is the midpoint of
// colorUtils' own brightness scale.
function badgeForeground(hex) {
	return getBrightness(hexToRgb(hex)) > 140 ? '000000' : 'ffffff';
}

/**
 * Resolves one color per route, used identically by the polyline, the vehicle
 * markers, the legend, and the arrival badge.
 *
 * @param {ActiveRoute[]} routes - in draw order (soonest arrival first)
 * @param {{ dark?: boolean }} options
 * @returns {Map<string, RouteColors>}
 */
export function assignRouteColors(routes, { dark = false } = {}) {
	/** @type {Map<string, RouteColors>} */
	const colors = new Map();
	const taken = new Set();

	const finish = (routeId, line) => {
		taken.add(line.toLowerCase());
		const badgeBg = line.slice(1);
		colors.set(routeId, { line, badgeBg, badgeFg: badgeForeground(line) });
	};

	// Two passes so palette assignment is order-independent: every route that can
	// keep its own GTFS color claims it first, and only then do the leftovers pick
	// from the palette. A single pass would let an early colorless route grab a
	// palette slot that a later route's GTFS color also maps to.
	const needsFallback = [];
	for (const route of routes) {
		const resolved = mapContrastColor(route.gtfsColor, { dark });
		if (resolved && !taken.has(resolved.toLowerCase())) {
			finish(route.id, resolved);
		} else {
			needsFallback.push(route);
		}
	}

	for (const route of needsFallback) {
		const start = paletteIndexFor(route.id);
		let line = null;
		// Linear-probe from the hashed slot to the next unused palette entry.
		for (let offset = 0; offset < ROUTE_FALLBACK_PALETTE.length; offset++) {
			const entry = ROUTE_FALLBACK_PALETTE[(start + offset) % ROUTE_FALLBACK_PALETTE.length];
			const candidate = dark ? entry.dark : entry.light;
			if (!taken.has(candidate.toLowerCase())) {
				line = candidate;
				break;
			}
		}
		// More routes than palette entries: accept a repeat rather than no color.
		if (!line) {
			const entry = ROUTE_FALLBACK_PALETTE[start];
			line = dark ? entry.dark : entry.light;
		}
		finish(route.id, line);
	}

	return colors;
}
