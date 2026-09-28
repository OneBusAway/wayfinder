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
 * `resetPadding` is only implemented by providers that maintain custom map
 * padding, so consumers must treat it as optional.
 *
 * @typedef {(import('./Provider/OpenStreetMapProvider.svelte.js').default
 * 	| import('./Provider/GoogleMapProvider.svelte.js').default
 * 	| import('./Provider/ArcGISMapProvider.svelte.js').default)
 * 	& { resetPadding?: () => void }} MapProvider
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

/** @typedef {{ id: string, msg: string }} TripPlanError */

/**
 * @typedef {{ plan: { itineraries: Itinerary[] }, error?: undefined }
 * 	| { error: TripPlanError, plan?: undefined }} TripPlanResponse
 */

/**
 * @typedef {Object} Itinerary
 * @property {number} startTime - Unix milliseconds, normalized from either OTP API.
 * @property {number} endTime - Unix milliseconds, normalized from either OTP API.
 * @property {number} duration - Seconds.
 * @property {ItineraryLeg[]} legs
 */

/**
 * @typedef {Object} ItineraryPlace
 * @property {string|null} [name]
 * @property {number|null} [lat]
 * @property {number|null} [lon]
 */

/**
 * OTP walking directions always include distance; direction and street labels
 * may be omitted when a step has no corresponding value.
 *
 * @typedef {Object} ItineraryStep
 * @property {string|null} [relativeDirection]
 * @property {string|null} [streetName]
 * @property {number} distance
 * @property {string|null} [absoluteDirection]
 */

/**
 * Route fields are absent for walking legs. Leg timestamps and geometry are
 * also optional in REST responses, so consumers must tolerate either missing.
 * Duration is seconds and distance is meters.
 *
 * @typedef {Object} ItineraryLeg
 * @property {string} mode
 * @property {number} duration
 * @property {number} distance
 * @property {string|null} [headsign]
 * @property {number} [startTime] - Unix milliseconds.
 * @property {number} [endTime] - Unix milliseconds.
 * @property {ItineraryPlace} from
 * @property {ItineraryPlace} to
 * @property {{ points?: string|null }|null} [legGeometry]
 * @property {ItineraryStep[]} [steps]
 * @property {boolean} [interlineWithPreviousLeg]
 * @property {string|null} [routeShortName]
 * @property {string|null} [routeLongName]
 * @property {string|null} [routeColor]
 * @property {string|null} [routeTextColor]
 */

export {};
