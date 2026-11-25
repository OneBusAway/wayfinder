/**
 * Parsing for the ArcGIS custom basemap settings
 * (`PUBLIC_ARCGIS_CUSTOM_BASEMAP_URL`, `..._DARK_URL`, `..._MODE`).
 */

/** Constructor properties for an ArcGIS `VectorTileLayer`. */
export type VectorTileSource =
	| { url: string }
	| { portalItem: { id: string; portal: { url: string } } };

export interface CustomBasemapSettings {
	url?: string | null;
	darkUrl?: string | null;
	mode?: string | null;
}

export interface CustomBasemap {
	light: VectorTileSource;
	/** Style shown in dark mode; `null` keeps the light style in both themes. */
	dark: VectorTileSource | null;
	/** Draw the custom layer above the standard Esri basemap instead of replacing it. */
	overlay: boolean;
}

const ITEM_ID = /^[0-9a-f]{32}$/i;
const ITEM_PAGE = /^(.*)\/home\/item\.html$/i;
const ITEM_REST = /^(.*)\/sharing\/rest\/content\/items\/([^/]+)\/?$/i;

/**
 * Turn a configured URL into `VectorTileLayer` properties.
 *
 * A portal item link (the item's page, or its `sharing/rest/content/items/<id>`
 * endpoint) is loaded as a portal item, which is how a styled vector tile item
 * on ArcGIS Online or an ArcGIS Enterprise portal carries its style. Anything
 * else — a `VectorTileServer` endpoint or a style JSON URL — is passed through.
 */
export function vectorTileSource(value: string | null | undefined): VectorTileSource | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { url: trimmed };
	}

	const page = ITEM_PAGE.exec(parsed.pathname);
	const rest = ITEM_REST.exec(parsed.pathname);
	const portalPath = page?.[1] ?? rest?.[1];
	const id = page ? parsed.searchParams.get('id') : rest?.[2];
	if (portalPath !== undefined && id && ITEM_ID.test(id)) {
		return { portalItem: { id, portal: { url: parsed.origin + portalPath } } };
	}
	if (portalPath !== undefined) {
		// A portal item link without a usable item ID cannot load as a portal
		// item, and its URL is not a tile service either.
		console.warn(`ArcGIS custom basemap: no valid portal item ID in "${trimmed}"`);
	}

	return { url: trimmed };
}

/**
 * Resolve the custom basemap settings. Returns `null` when no light URL is
 * configured; the dark URL and mode have no effect on their own.
 */
export function resolveCustomBasemap(
	settings: CustomBasemapSettings | null | undefined
): CustomBasemap | null {
	const { url, darkUrl, mode } = settings ?? {};
	const light = vectorTileSource(url);
	if (!light) return null;
	return {
		light,
		dark: vectorTileSource(darkUrl),
		overlay: mode?.trim().toLowerCase() === 'overlay'
	};
}
