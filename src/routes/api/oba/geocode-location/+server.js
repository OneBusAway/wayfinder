import { bingGeocode, googleGeocode } from '$lib/geocoder';
import { getBoundsCache } from '$lib/serverCache.js';

import { PRIVATE_OBA_GEOCODER_PROVIDER as geocoderProvider } from '$env/static/private';
import { error } from '@sveltejs/kit';

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

	if (!searchInput) {
		throw error(400, {
			message: 'Query parameter is required',
			code: 'MISSING_QUERY'
		});
	}

	const bounds = getBoundsCache();
	if (!bounds) {
		throw error(503, {
			message: 'Service initializing, please try again',
			code: 'SERVICE_UNAVAILABLE'
		});
	}

	try {
		const locationResponse = await locationSearch(searchInput, bounds);
		if (!locationResponse) {
			throw error(500, {
				message: 'Failed to process geocoding request',
				code: 'GEOCODING_ERROR',
				details: 'No results returned from geocoder'
			});
		}

		return new Response(JSON.stringify({ location: locationResponse }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		if (err.status) throw err;

		throw error(500, {
			message: 'Failed to process geocoding request',
			code: 'GEOCODING_ERROR',
			details: err.message
		});
	}
}
