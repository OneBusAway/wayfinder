export const ZONE_STREET_MAX_KM = 4;
export const ZONE_REGION_MAX_KM = 65;
const KM_PER_DEGREE_LATITUDE = 111.32;
const DIMMED_OPACITY = 0.6;

/**
 * @param {{ north: number, south: number }} bounds
 * @returns {'street' | 'region' | 'hidden'}
 */
export function zoneLevel(bounds) {
	const visibleHeightKm = (bounds.north - bounds.south) * KM_PER_DEGREE_LATITUDE;
	if (visibleHeightKm <= ZONE_STREET_MAX_KM) return 'street';
	if (visibleHeightKm <= ZONE_REGION_MAX_KM) return 'region';
	return 'hidden';
}

/**
 * Region zones are filled and clickable; street zones are a stroke with a halo
 * and never capture clicks meant for stops or the map.
 * @param {{ level: 'street' | 'region', color: string, highlight: 'none' | 'selected' | 'dimmed' }} options
 */
export function zoneStyle({ level, color, highlight }) {
	const base =
		level === 'street'
			? {
					color,
					fillOpacity: 0,
					weight: 4,
					opacity: 1,
					halo: { weight: 10, opacity: 0.25 },
					interactive: false
				}
			: { color, fillOpacity: 0.2, weight: 2, opacity: 1, halo: null, interactive: true };
	if (highlight === 'selected') return { ...base, weight: base.weight + 2 };
	if (highlight !== 'dimmed') return base;
	return {
		...base,
		opacity: DIMMED_OPACITY,
		fillOpacity: base.fillOpacity * DIMMED_OPACITY,
		halo: base.halo && { ...base.halo, opacity: base.halo.opacity * DIMMED_OPACITY }
	};
}
