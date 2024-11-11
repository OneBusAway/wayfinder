import { googlePlacesAutocomplete } from '$lib/geocoder';

import {
	PRIVATE_OBA_GEOCODER_API_KEY as geocoderApiKey,
	PRIVATE_OBA_GEOCODER_PROVIDER as geocoderProvider
} from '$env/static/private';

async function autoCompletePlacesSearch(input) {
	if (geocoderProvider === 'google') {
		return googlePlacesAutocomplete({ apiKey: geocoderApiKey, input });
	} else {
		return [];
	}
}

export async function GET({ url }) {
	const searchInput = url.searchParams.get('query')?.trim();

	const suggestions = await autoCompletePlacesSearch(searchInput);
	return new Response(
		JSON.stringify({
			suggestions
		}),
		{
			headers: {
				'Content-Type': 'application/json'
			}
		}
	);
}
