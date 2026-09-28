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
