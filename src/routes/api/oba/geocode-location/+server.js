import { bingGeocode, googleGeocode } from '$lib/geocoder';
import { getBoundsCache } from '$lib/serverCache.js';

import { PRIVATE_OBA_GEOCODER_PROVIDER as geocoderProvider } from '$env/static/private';

import { env } from '$env/dynamic/private';

let geocoderApiKey = env.PRIVATE_OBA_GEOCODER_API_KEY;

async function locationSearch(query, bounds) {
	if (geocoderProvider === 'google') {
		return googleGeocode({ apiKey: geocoderApiKey, query, bounds });
	} else {
		return bingGeocode({ apiKey: geocoderApiKey, query, bounds });
	}
}

export async function GET({ url }) {
	const searchInput = url.searchParams.get('query')?.trim();

	const bounds = getBoundsCache();

	const locationResponse = await locationSearch(searchInput, bounds);

	return new Response(
		JSON.stringify({
			location: locationResponse
		}),
		{
			headers: {
				'Content-Type': 'application/json'
			}
		}
	);
}
