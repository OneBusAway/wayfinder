export const COLORS = {
	POLYLINE: '#359ff7',
	POLYLINE_ARROW_STROKE: '#21649b',
	VEHICLE_REAL_TIME_OFF: '#808080'
};

/**
 * Fallback colors for routes whose GTFS color is missing, invalid, or collides
 * with another route drawn at the same time (real agencies routinely give
 * several routes one generic color, which makes two lines in a shared corridor
 * indistinguishable).
 *
 * Each entry is a light/dark pair because no single hex can clear both a light
 * and a dark basemap — the same reason mapContrastColor adjusts GTFS colors per
 * theme. These values were chosen by computation, not by eye; every one clears
 * 3:1 against its basemap and 4.5:1 against its computed text color, and the
 * closest pair within a mode is 65 units apart in RGB. See the palette tests in
 * src/lib/__tests__/activeRoutes.test.js, which enforce all of that.
 */
export const ROUTE_FALLBACK_PALETTE = [
	{ light: '#C2185B', dark: '#F06292' }, // crimson
	{ light: '#1565C0', dark: '#64B5F6' }, // blue
	{ light: '#2E7D32', dark: '#81C784' }, // green
	{ light: '#E65100', dark: '#FFB74D' }, // orange
	{ light: '#6A1B9A', dark: '#BA68C8' }, // purple
	{ light: '#00695C', dark: '#4DB6AC' }, // teal
	{ light: '#5D4037', dark: '#BCAAA4' }, // brown
	{ light: '#827717', dark: '#DCE775' } // olive
];
