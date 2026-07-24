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

import { mapContrastColor, contrastRatio } from '$lib/colorUtils.js';
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
// it. Pick from the resolved background instead.
//
// Picking whichever of white/black has the higher *true* WCAG contrast
// (contrastRatio, not the NTSC-weighted getBrightness) is a structural
// guarantee, not an empirical one: the worst case is the background luminance
// L where white and black tie, i.e. (L+0.05)/0.05 == 1.05/(L+0.05), which
// solves to L ≈ 0.1791 and a ratio of ≈4.58. Since 4.58 > the 4.5:1 WCAG AA
// text minimum, "better of white/black" clears AA for *any* background hex —
// no palette-specific tuning required.
function badgeForeground(hex) {
	const whiteContrast = contrastRatio(hex, '#ffffff');
	const blackContrast = contrastRatio(hex, '#000000');
	return blackContrast >= whiteContrast ? '000000' : 'ffffff';
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
	//
	// Routes are grouped by their *resolved* GTFS color before anyone claims one,
	// rather than letting whichever route is processed first win. Routes arrive in
	// draw order (soonest arrival first), which reorders on every 30s poll — if the
	// winner were "first in the array", two same-colored routes with close arrival
	// times would flip colors on every poll with no underlying data change, and the
	// loser's fallback color would flip with it. Picking the keeper by lowest
	// routeId is a stable, data-only rule: the same two routes always resolve the
	// same way regardless of what order they're passed in.
	const needsFallback = [];
	const byResolvedColor = new Map();
	for (const route of routes) {
		const resolved = mapContrastColor(route.gtfsColor, { dark });
		if (!resolved) {
			needsFallback.push(route);
			continue;
		}
		const key = resolved.toLowerCase();
		if (!byResolvedColor.has(key)) byResolvedColor.set(key, []);
		byResolvedColor.get(key).push({ route, resolved });
	}

	for (const group of byResolvedColor.values()) {
		group.sort((a, b) => (a.route.id < b.route.id ? -1 : a.route.id > b.route.id ? 1 : 0));
		const [keeper, ...rest] = group;
		finish(keeper.route.id, keeper.resolved);
		needsFallback.push(...rest.map((entry) => entry.route));
	}

	// Sorted by id before probing so palette allocation is order-independent too:
	// two ids that hash to the same slot (e.g. `r_a` and `r_i` both land on slot
	// 4) would otherwise let whichever arrives first claim it and force the other
	// to probe forward, so reversing the arrivals order would swap their colors.
	// activeRoutes reshuffles soonest-arrival-first on every 30s poll, so an
	// input-order-dependent rule would flip both colors with no data change.
	needsFallback.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

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
