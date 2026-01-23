import { error, json } from '@sveltejs/kit';
import { transformEsriStyle, extractBaseUrl } from '$lib/Provider/esriStyleTransformer';
import { env } from '$env/dynamic/public';

/**
 * Server-side proxy for ESRI map styles.
 * This bypasses CORS restrictions when fetching styles from enterprise GIS servers.
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
	// Get style URL from query param or environment variable
	const styleUrl = url.searchParams.get('url') || env.PUBLIC_MAP_STYLE_URL;
	const styleType = url.searchParams.get('type') || env.PUBLIC_MAP_STYLE_TYPE || 'standard';

	if (!styleUrl) {
		error(400, 'Missing style URL. Provide ?url= parameter or set PUBLIC_MAP_STYLE_URL env var.');
	}

	try {
		const response = await fetch(styleUrl);

		if (!response.ok) {
			error(response.status, `Failed to fetch style: ${response.statusText}`);
		}

		const style = await response.json();

		// If it's an ESRI style, transform relative URLs to absolute
		if (styleType === 'esri') {
			const baseUrl = extractBaseUrl(styleUrl);
			const transformedStyle = transformEsriStyle(style, baseUrl);
			return json(transformedStyle);
		}

		// For standard styles, return as-is
		return json(style);
	} catch (err) {
		console.error('Error fetching map style:', err);
		error(500, `Failed to fetch map style: ${err.message}`);
	}
}
