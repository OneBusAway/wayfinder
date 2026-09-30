export const ZONE_BRAND_COLOR = '#78aa36';
export const ZONE_FALLBACK_PALETTE = [
	'#3b82f6',
	'#d97706',
	'#7c3aed',
	'#db2777',
	'#0891b2',
	'#65a30d'
];

/**
 * @param {string | null | undefined} value - GTFS route colour, with or without '#'
 * @returns {string | null} lower-case '#rrggbb'
 */
export function normalizeHexColor(value) {
	if (!value) return null;
	const hex = String(value).trim().replace(/^#/, '');
	return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}

/**
 * One colour per service: its route colour, else the brand green. A colour
 * already taken in this set yields the next unused palette colour, assigned in
 * service-id order so the result is stable across redraws.
 * @param {Array<{ id: string, route?: { color?: string } | null }>} services
 * @returns {Map<string, string>}
 */
export function assignZoneColors(services) {
	const colors = new Map();
	const used = new Set();
	const ordered = [...services].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	for (const service of ordered) {
		const base = normalizeHexColor(service.route?.color) ?? ZONE_BRAND_COLOR;
		const color = used.has(base) ? (ZONE_FALLBACK_PALETTE.find((c) => !used.has(c)) ?? base) : base;
		used.add(color);
		colors.set(service.id, color);
	}
	return colors;
}
