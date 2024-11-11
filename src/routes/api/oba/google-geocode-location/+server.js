import { googleGeocode, googleGeocodeByPlaceId } from '$lib/geocoder';

import {
	PRIVATE_OBA_GEOCODER_API_KEY as geocoderApiKey,
	PRIVATE_OBA_GEOCODER_PROVIDER as geocoderProvider
} from '$env/static/private';

async function locationSearch(query) {
	if (geocoderProvider === 'google') {
		return googleGeocode({ apiKey: geocoderApiKey, query });
	} else {
		return [];
	}
}

export async function GET({ url }) {
	const searchInput = url.searchParams.get('query')?.trim();

	const locationResponse = await locationSearch(searchInput);

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
