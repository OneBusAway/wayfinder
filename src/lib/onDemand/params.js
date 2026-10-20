export const GEOMETRY_DETAILS = ['none', 'simplified', 'full'];
export const MAX_RADIUS_METERS = 20000;

/**
 * @param {string | null} value
 * @returns {{ value: string | null } | { error: string }}
 */
export function parseGeometryDetail(value) {
	if (value == null || value === '') return { value: null };
	if (GEOMETRY_DETAILS.includes(value)) return { value };
	return { error: `geometryDetail must be one of ${GEOMETRY_DETAILS.join(', ')}` };
}

/**
 * Validates a location query: lat and lon (or renamed equivalents) required;
 * either a radius or both spans; optional geometryDetail.
 * @param {URLSearchParams} searchParams
 * @param {{
 *   lonParam?: string,
 *   lonSpanParam?: string,
 *   spansAdvisoryWhenRadius?: boolean
 * }} [options]
 * @returns {{ params: Record<string, number | string> } | { error: string }}
 */
export function parseLocationQuery(searchParams, options = {}) {
	const lonParam = options.lonParam ?? 'lon';
	const lonSpanParam = options.lonSpanParam ?? 'lonSpan';
	const spansAdvisoryWhenRadius = options.spansAdvisoryWhenRadius ?? false;

	const lat = finiteNumber(searchParams.get('lat'));
	const lon = finiteNumber(searchParams.get(lonParam));
	if (lat == null || lat < -90 || lat > 90) return { error: 'lat must be between -90 and 90' };
	if (lon == null || lon < -180 || lon > 180) {
		return { error: `${lonParam} must be between -180 and 180` };
	}
	const params = { lat, lon };

	const radiusError = addRadius(params, searchParams.get('radius'));
	if (radiusError) return { error: radiusError };
	const spanError = addSpans(
		params,
		searchParams.get('latSpan'),
		searchParams.get(lonSpanParam),
		lonSpanParam
	);
	if (spanError && !(spansAdvisoryWhenRadius && 'radius' in params)) {
		return { error: spanError };
	}

	const detail = parseGeometryDetail(searchParams.get('geometryDetail'));
	if ('error' in detail) return { error: detail.error };
	if (detail.value) params.geometryDetail = detail.value;
	return { params };
}

function addRadius(params, raw) {
	if (raw == null || raw === '') return null;
	const radius = finiteNumber(raw);
	if (radius == null || radius <= 0 || radius > MAX_RADIUS_METERS) {
		return `radius must be greater than 0 and at most ${MAX_RADIUS_METERS}`;
	}
	params.radius = radius;
	return null;
}

function addSpans(params, rawLatSpan, rawLonSpan, lonSpanParam) {
	const hasLatSpan = rawLatSpan != null && rawLatSpan !== '';
	const hasLonSpan = rawLonSpan != null && rawLonSpan !== '';
	if (!hasLatSpan && !hasLonSpan) return null;
	const latSpan = finiteNumber(rawLatSpan);
	const lonSpan = finiteNumber(rawLonSpan);
	if (latSpan == null || lonSpan == null || latSpan <= 0 || lonSpan <= 0) {
		return `latSpan and ${lonSpanParam} must both be positive numbers`;
	}
	params.latSpan = latSpan;
	params.lonSpan = lonSpan;
	return null;
}

export function finiteNumber(raw) {
	if (raw == null) return null;
	const valueString = String(raw).trim();
	if (valueString === '') return null;
	const value = Number(valueString);
	return Number.isFinite(value) ? value : null;
}
