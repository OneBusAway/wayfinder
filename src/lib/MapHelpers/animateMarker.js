/**
 * Default duration (ms) used to glide a vehicle marker between two real-time
 * position updates.
 */
export const VEHICLE_ANIMATION_DURATION = 1200;

/**
 * If the start or end fix is farther than this (in metres) from the route shape
 * chosen for this move (the shape minimizing the combined endpoint distance),
 * the vehicle is treated as off-route and moved in a straight line rather than
 * being snapped to the shape.
 */
const OFF_ROUTE_THRESHOLD_M = 150;

const METRES_PER_DEG_LAT = 111320;

/**
 * Metres per degree of longitude at a given latitude. Used so projections and
 * distances are roughly isotropic over the short spans between vehicle updates.
 */
function lngMetresPerDeg(lat) {
	return METRES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/**
 * Projects a point onto a segment, returning the clamped parameter `t` along the
 * segment (0..1) and the perpendicular distance in metres.
 */
function projectOnSegment(p, a, b, lngScale) {
	const ax = a.lng * lngScale;
	const ay = a.lat * METRES_PER_DEG_LAT;
	const bx = b.lng * lngScale;
	const by = b.lat * METRES_PER_DEG_LAT;
	const px = p.lng * lngScale;
	const py = p.lat * METRES_PER_DEG_LAT;

	const dx = bx - ax;
	const dy = by - ay;
	const lenSq = dx * dx + dy * dy;
	let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));

	const dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
	return { t, dist };
}

/** Finds the closest segment of a path to a point. */
function projectOnPath(points, p) {
	const lngScale = lngMetresPerDeg(p.lat);
	let best = { dist: Infinity, seg: 0, t: 0 };
	for (let i = 0; i < points.length - 1; i++) {
		const r = projectOnSegment(p, points[i], points[i + 1], lngScale);
		if (r.dist < best.dist) best = { dist: r.dist, seg: i, t: r.t };
	}
	return best;
}

/**
 * Builds the list of coordinates the vehicle should travel through to get from
 * `from` to `to` while following the route shape. Returns `null` when no usable
 * shape is available or either endpoint is too far from the route, so callers
 * can fall back to a straight line.
 *
 * @param {Array<Array<{lat:number,lng:number}>>} routePaths - decoded route shapes.
 * @param {{lat:number,lng:number}} from
 * @param {{lat:number,lng:number}} to
 * @returns {Array<{lat:number,lng:number}>|null}
 */
export function buildRoutePath(routePaths, from, to) {
	let chosen = null;
	let fromProj = null;
	let toProj = null;

	for (const points of routePaths) {
		if (!points || points.length < 2) continue;
		const fp = projectOnPath(points, from);
		const tp = projectOnPath(points, to);
		const score = fp.dist + tp.dist;
		if (!chosen || score < chosen.score) {
			chosen = { points, score };
			fromProj = fp;
			toProj = tp;
		}
	}

	if (!chosen) return null;
	if (fromProj.dist > OFF_ROUTE_THRESHOLD_M || toProj.dist > OFF_ROUTE_THRESHOLD_M) return null;

	const points = chosen.points;
	const path = [from];

	// Walk the shape vertices that lie strictly between the two projections,
	// in whichever direction the vehicle is travelling along the shape.
	if (toProj.seg + toProj.t >= fromProj.seg + fromProj.t) {
		for (let i = fromProj.seg + 1; i <= toProj.seg; i++) path.push(points[i]);
	} else {
		for (let i = fromProj.seg; i >= toProj.seg + 1; i--) path.push(points[i]);
	}

	path.push(to);
	return path;
}

/** Precomputes cumulative segment lengths (metres) for a path. */
function measurePath(path) {
	const cumulative = [0];
	let total = 0;
	for (let i = 1; i < path.length; i++) {
		const lngScale = lngMetresPerDeg(path[i].lat);
		const dx = (path[i].lng - path[i - 1].lng) * lngScale;
		const dy = (path[i].lat - path[i - 1].lat) * METRES_PER_DEG_LAT;
		total += Math.hypot(dx, dy);
		cumulative.push(total);
	}
	return { cumulative, total };
}

/** Returns the coordinate at a given distance (metres) along a measured path. */
function positionAlong(path, cumulative, distance) {
	let i = 1;
	while (i < cumulative.length && cumulative[i] < distance) i++;
	if (i >= cumulative.length) return path[path.length - 1];

	const segStart = cumulative[i - 1];
	const segEnd = cumulative[i];
	const t = segEnd === segStart ? 0 : (distance - segStart) / (segEnd - segStart);
	return {
		lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
		lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t
	};
}

/**
 * Cancels an in-flight marker movement animation, if any.
 * @param {object} marker - a map marker that may hold an `_animationFrameId`.
 */
export function cancelMarkerAnimation(marker) {
	if (marker && marker._animationFrameId) {
		cancelAnimationFrame(marker._animationFrameId);
		marker._animationFrameId = null;
	}
}

/**
 * Drives a per-frame animation, applying eased progress to `interpolate(p)` and
 * passing the resulting coordinate to `setPosition`.
 */
function runAnimation(marker, duration, interpolate, setPosition) {
	const start = performance.now();
	const step = (now) => {
		const t = Math.min((now - start) / duration, 1);
		// ease-out cubic for a natural deceleration as the vehicle reaches its fix
		const eased = 1 - Math.pow(1 - t, 3);
		const pos = interpolate(eased);
		setPosition(pos.lat, pos.lng);

		if (t < 1) {
			marker._animationFrameId = requestAnimationFrame(step);
		} else {
			marker._animationFrameId = null;
		}
	};
	marker._animationFrameId = requestAnimationFrame(step);
}

/**
 * Smoothly moves a marker from its current position to a target position so
 * real-time vehicle updates glide instead of teleporting. When `routePaths` are
 * supplied, the marker follows the route shape (turning corners) instead of
 * cutting across in a straight diagonal line.
 *
 * Any animation already running on the marker is cancelled first, so frequent
 * updates always animate from the marker's current on-screen position.
 *
 * @param {object} marker - the map marker (uses an `_animationFrameId` field to track/cancel animations).
 * @param {{ lat: number, lng: number }} from - starting coordinates.
 * @param {{ lat: number, lng: number }} to - target coordinates.
 * @param {(lat: number, lng: number) => void} setPosition - applies a position to the marker.
 * @param {{ duration?: number, routePaths?: Array<Array<{lat:number,lng:number}>> }} [options]
 */
export function animateMarkerTo(marker, from, to, setPosition, options = {}) {
	const { duration = VEHICLE_ANIMATION_DURATION, routePaths = null } = options;

	cancelMarkerAnimation(marker);

	// Fall back to an instant move when animation isn't available (e.g. SSR,
	// test environments) or when the marker hasn't actually moved.
	if (typeof requestAnimationFrame !== 'function' || (from.lat === to.lat && from.lng === to.lng)) {
		setPosition(to.lat, to.lng);
		return;
	}

	const path = routePaths && routePaths.length ? buildRoutePath(routePaths, from, to) : null;

	if (path && path.length >= 2) {
		const { cumulative, total } = measurePath(path);
		if (total > 0) {
			runAnimation(
				marker,
				duration,
				(p) => positionAlong(path, cumulative, p * total),
				setPosition
			);
			return;
		}
	}

	// Straight-line interpolation (no usable route shape, or vehicle off-route).
	runAnimation(
		marker,
		duration,
		(p) => ({ lat: from.lat + (to.lat - from.lat) * p, lng: from.lng + (to.lng - from.lng) * p }),
		setPosition
	);
}
