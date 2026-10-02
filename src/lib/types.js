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
 * A leg endpoint in a trip plan itinerary. Coordinates may be missing from a
 * malformed planner response, so callers check them before use.
 *
 * @typedef {Object} ItineraryPlace
 * @property {number} [lat]
 * @property {number} [lon]
 * @property {string} [name]
 */

/**
 * One turn-by-turn instruction in a walking leg. OpenTripPlanner leaves the
 * directions and street name null for steps that have none, such as an
 * elevator or an unnamed path.
 *
 * @typedef {Object} ItineraryStep
 * @property {string | null} [absoluteDirection]
 * @property {number} distance - Meters
 * @property {string | null} [relativeDirection]
 * @property {string | null} [streetName]
 */

/**
 * One leg of a trip plan itinerary, in the OpenTripPlanner 1.x REST shape that
 * `mapGraphQLResponse` in `$lib/otp/graphql.js` also produces for OTP 2.x.
 *
 * @typedef {Object} ItineraryLeg
 * @property {number} distance - Meters
 * @property {number} duration - Seconds
 * @property {number} [endTime] - Epoch milliseconds
 * @property {ItineraryPlace} [from]
 * @property {string | null} [headsign]
 * @property {boolean} [interlineWithPreviousLeg]
 * @property {{ points?: string }} [legGeometry] - Encoded polyline of the leg's path
 * @property {string} mode - OTP mode, e.g. "WALK" or "BUS"
 * @property {string} [routeColor] - Hex color without the leading `#`
 * @property {string} [routeLongName]
 * @property {string} [routeShortName]
 * @property {string} [routeTextColor] - Hex color without the leading `#`
 * @property {number} [startTime] - Epoch milliseconds
 * @property {ItineraryStep[]} [steps] - Turn-by-turn walking directions
 * @property {ItineraryPlace} [to]
 */

/**
 * A single trip plan option returned by OpenTripPlanner.
 *
 * @typedef {Object} Itinerary
 * @property {number} duration - Seconds
 * @property {number} endTime - Epoch milliseconds
 * @property {ItineraryLeg[]} legs
 * @property {number} startTime - Epoch milliseconds
 */

/**
 * A trip planning failure, either from OpenTripPlanner (OTP 1.x uses numeric
 * ids) or built client-side when the request itself fails.
 *
 * @typedef {Object} TripPlanError
 * @property {string | number} id
 * @property {string} msg - Human-readable message shown to the rider
 */

/**
 * A trip planning result: OpenTripPlanner's plan, or an error.
 *
 * @typedef {Object} TripPlanResponse
 * @property {TripPlanError} [error]
 * @property {{ itineraries: Itinerary[] }} [plan]
 */

export {};
