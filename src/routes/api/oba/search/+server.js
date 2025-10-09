import { OnebusawaySDK } from 'onebusaway-sdk';

import { bingGeocode, googleGeocode } from '$lib/geocoder';
import { getBoundsCache } from '$lib/serverCache.js';

import {
	PUBLIC_OBA_SERVER_URL as baseUrl,
	PUBLIC_OBA_REGION_CENTER_LAT as centerLat,
	PUBLIC_OBA_REGION_CENTER_LNG as centerLng
} from '$env/static/public';

import {
	PRIVATE_OBA_API_KEY as apiKey,
	PRIVATE_OBA_GEOCODER_PROVIDER as geocoderProvider
} from '$env/static/private';

import { env } from '$env/dynamic/private';

let geocoderApiKey = env.PRIVATE_OBA_GEOCODER_API_KEY;

const oba = new OnebusawaySDK({
	apiKey: apiKey,
	baseURL: baseUrl
});

async function routeSearch(query) {
	const params = {
		lat: centerLat,
		lon: centerLng,
		query
	};
	return oba.routesForLocation.list(params);
}

async function stopSearch(query) {
	const params = {
		lat: centerLat,
		lon: centerLng,
		query
	};
	return oba.stopsForLocation.list(params);
}

async function locationSearch(query, bounds) {
	if (geocoderProvider === 'google') {
		return googleGeocode({ apiKey: geocoderApiKey, query, bounds });
	} else if (geocoderProvider === 'bing') {
		return bingGeocode({ apiKey: geocoderApiKey, query, bounds });
	}
}

export async function GET({ url }) {
	const searchInput = url.searchParams.get('query')?.trim();

	const bounds = getBoundsCache();

	const [routeResponse, stopResponse, locationResponse] = await Promise.all([
		routeSearch(searchInput),
		stopSearch(searchInput),
		locationSearch(searchInput, bounds)
	]);

	return new Response(
		JSON.stringify({
			routes: routeResponse.data.list,
			stops: stopResponse.data.list,
			location: locationResponse,
			query: searchInput
		}),
		{ headers: { 'Content-Type': 'application/json' } }
	);
}
