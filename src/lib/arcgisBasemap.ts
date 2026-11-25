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

const ITEM_ID = '[0-9a-f]{32}';
const ITEM_PAGE = /^(.*)\/home\/item\.html$/i;
const ITEM_REST = new RegExp(`^(.*)/sharing/rest/content/items/(${ITEM_ID})/?$`, 'i');

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
	const pageId = parsed.searchParams.get('id');
	if (page && pageId && new RegExp(`^${ITEM_ID}$`, 'i').test(pageId)) {
		return { portalItem: { id: pageId, portal: { url: parsed.origin + page[1] } } };
	}

	const rest = ITEM_REST.exec(parsed.pathname);
	if (rest) {
		return { portalItem: { id: rest[2], portal: { url: parsed.origin + rest[1] } } };
	}

	return { url: trimmed };
}

/**
 * Resolve the custom basemap settings. A bare string is the light URL in
 * replace mode, which is what `PUBLIC_ARCGIS_CUSTOM_BASEMAP_URL` meant before
 * the dark URL and mode settings existed. Returns `null` when no light URL is
 * configured; the dark URL and mode have no effect on their own.
 */
export function resolveCustomBasemap(
	settings: string | CustomBasemapSettings | null | undefined
): CustomBasemap | null {
	const { url, darkUrl, mode } =
		typeof settings === 'string' ? ({ url: settings } as CustomBasemapSettings) : (settings ?? {});
	const light = vectorTileSource(url);
	if (!light) return null;
	return {
		light,
		dark: vectorTileSource(darkUrl),
		overlay: mode?.trim().toLowerCase() === 'overlay'
	};
}
