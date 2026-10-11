/**
 * GeoJSON Polygon/MultiPolygon helpers for drawing on-demand zones. Positions
 * are GeoJSON [lon, lat]. Providers disagree on hole winding (Google fills by
 * the nonzero rule, ArcGIS wants clockwise exteriors), so rings are oriented
 * explicitly rather than trusting the feed.
 */

const MIN_RING_POSITIONS = 4;

/**
 * @param {any} geometry
 * @returns {Array<Array<Array<[number, number]>>>} polygons → rings → positions
 */
export function polygonsOf(geometry) {
	if (!geometry || !Array.isArray(geometry.coordinates)) return [];
	const polygons =
		geometry.type === 'Polygon'
			? [geometry.coordinates]
			: geometry.type === 'MultiPolygon'
				? geometry.coordinates
				: [];
	return polygons.filter(hasDrawableExterior).map((rings) => rings.filter(isDrawableRing));
}

// Ring 0 is the exterior; without it the holes would be drawn as filled areas.
function hasDrawableExterior(rings) {
	return Array.isArray(rings) && isDrawableRing(rings[0]);
}

function isDrawableRing(ring) {
	return Array.isArray(ring) && ring.length >= MIN_RING_POSITIONS;
}

/**
 * Shoelace sign with x = lon, y = lat: negative area winds clockwise.
 * @param {Array<[number, number]>} ring
 */
export function isClockwise(ring) {
	let twiceArea = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const [x1, y1] = ring[i];
		const [x2, y2] = ring[i + 1];
		twiceArea += x1 * y2 - x2 * y1;
	}
	return twiceArea < 0;
}

/**
 * @param {Array<[number, number]>} ring
 * @param {boolean} clockwise
 */
export function orientRing(ring, clockwise) {
	return isClockwise(ring) === clockwise ? ring : [...ring].reverse();
}
