/**
 * Shared JSDoc type definitions used across components.
 *
 * This module intentionally contains no runtime code. It centralizes type
 * definitions so components can reference them via `import('$lib/types').Name`.
 */

/**
 * A map provider instance, as created in MapContainer.svelte. Implementations
 * expose standard `{lat,lng}` coordinates, WGS84 bounds or `null`, synchronous
 * marker/polyline handles, and an idempotent `destroy()` lifecycle method.
 *
 * @typedef {import('./Provider/OpenStreetMapProvider.svelte.js').default
 * 	| import('./Provider/GoogleMapProvider.svelte.js').default
 * 	| import('./Provider/ArcGISMapProvider.svelte.js').default} MapProvider
 */

/**
 * A transit stop from the OneBusAway "stops-for-location" endpoint, augmented
 * at runtime with resolved `routes`. The SDK list item only carries `routeIds`;
 * MapView.svelte joins those ids against the response's route references and
 * attaches the resulting `routes` array before passing the stop to markers and
 * panes. Route references may also carry a non-SDK `code` field.
 *
 * @typedef {import('onebusaway-sdk/resources/stops-for-location').StopsForLocationListResponse.Data.List
 * 	& { routes?: (import('onebusaway-sdk/resources/shared').References.Route & { code?: string })[] }} Stop
 */

/**
 * A provider result shown by the trip planner's place autocomplete. Bing does
 * not return a stable place identifier, so selection must also work by name.
 *
 * @typedef {Object} PlaceSuggestion
 * @property {string} name - Query passed to the selected geocoder.
 * @property {string} displayText - Human-readable suggestion label.
 * @property {string} [placeId] - Provider identifier, when available.
 */

/** @typedef {{ north: number, south: number, east: number, west: number }} GeoBounds */

/**
 * @typedef {Object} PlaceSuggestionsResponse
 * @property {PlaceSuggestion[]} suggestions
 */

export {};
