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

/**
 * A leg endpoint in a trip plan itinerary. Coordinates may be missing from a
 * malformed planner response, so callers check them before use.
 *
 * @typedef {Object} ItineraryPlace
 * @property {number | null} [lat]
 * @property {number | null} [lon]
 * @property {string | null} [name]
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
 * @property {{ points?: string | null } | null} [legGeometry] - Encoded polyline of the leg's path
 * @property {string} mode - OTP mode, e.g. "WALK" or "BUS"
 * @property {string | null} [routeColor] - Hex color without the leading `#`
 * @property {string | null} [routeLongName]
 * @property {string | null} [routeShortName]
 * @property {string | null} [routeTextColor] - Hex color without the leading `#`
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

/**
 * OBA situation fields consumed by the alert UI. Metadata and content can be
 * absent, so minimal notices need no response envelope or creation timestamp.
 * Some feeds also supply advice and free-form reason codes beyond the SDK enum.
 *
 * @typedef {import('onebusaway-sdk/resources/shared').References.Situation} OBASituation
 * @typedef {import('onebusaway-sdk/resources/shared').References.Situation.AllAffect} OBAAlertAffect
 * @typedef {{ [Key in keyof OBAAlertAffect]?: OBAAlertAffect[Key] | null }} ServiceAlertAffect
 * @typedef {Partial<Pick<OBASituation,
 * 	'id' | 'summary' | 'description' | 'severity' | 'activeWindows' | 'consequences'>>
 * 	& { allAffects?: ServiceAlertAffect[], reason?: string, advice?: OBASituation['description'] }} ServiceAlert
 */

/**
 * Accordion payloads are opaque to the containers. Selection consumers must
 * resolve or narrow them before accessing fields; null represents no selection.
 * Item IDs are the UUID strings created by AccordionItem.
 *
 * @typedef {{ activeItem: string | null, activeData: unknown }} AccordionSelection
 * @typedef {Object} AccordionRegistration
 * @property {import('svelte/store').Readable<boolean>} isActive
 * @property {import('svelte/store').Readable<boolean>} skipAnimation
 * @property {(data: unknown) => void} activate
 *
 * @typedef {Object} AccordionContext
 * @property {(id: string) => AccordionRegistration} registerItem
 * @property {(animate?: boolean) => void} [openAll]
 * @property {(animate?: boolean) => void} [closeAll]
 */

export {};
