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

/** @typedef {{ id: string | number, msg: string }} TripPlanError */

/**
 * @typedef {Object} PlaceSuggestionsResponse
 * @property {PlaceSuggestion[]} suggestions
 */

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
 * @property {ItineraryPlace} [from]
 * @property {ItineraryPlace} [to]
 * @property {{ points?: string|null }|null} [legGeometry]
 * @property {ItineraryStep[]} [steps]
 * @property {boolean} [interlineWithPreviousLeg]
 * @property {string|null} [routeShortName]
 * @property {string|null} [routeLongName]
 * @property {string|null} [routeColor]
 * @property {string|null} [routeTextColor]
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
