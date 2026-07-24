/**
 * Stacking layers for the stop-selection route overlay.
 *
 * The OSM provider maps these to Leaflet panes (whose z-index it assigns
 * explicitly — createPane does not). The Google provider maps them to Polyline
 * zIndex values. Callers pick a layer by name and stay provider-agnostic.
 *
 * Every casing must render below every colored stroke, or one route's casing
 * paints over its neighbor's line. The promoted layer carries the route whose
 * arrival the rider has expanded.
 */
export const ROUTE_PANE = {
	CASING: 'obaRouteCasing',
	LINE: 'obaRoute',
	PROMOTED: 'obaRoutePromoted'
};

/** Leaflet pane z-indexes. Below markerPane (600) so markers stay on top. */
export const ROUTE_PANE_Z_INDEX = {
	[ROUTE_PANE.CASING]: 402,
	[ROUTE_PANE.LINE]: 403,
	[ROUTE_PANE.PROMOTED]: 404
};
