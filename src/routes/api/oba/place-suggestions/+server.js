/* eslint-disable no-restricted-syntax */
// @ts-check
import { json } from '@sveltejs/kit';
import { fetchAutocompleteResults } from '$lib/geocoder';
import { getBoundsCache } from '$lib/serverCache.js';

import { PRIVATE_OBA_GEOCODER_PROVIDER as geocoderProvider } from '$env/static/private';

import { env } from '$env/dynamic/private';

let geocoderApiKey = env.PRIVATE_OBA_GEOCODER_API_KEY;

/** @param {import('@sveltejs/kit').RequestEvent} event */
export async function GET({ url }) {
	const searchInput = url.searchParams.get('query')?.trim() ?? '';
	if (!searchInput) {
		/** @type {import('$lib/types').PlaceSuggestionsResponse} */
		const emptyBody = { suggestions: [] };
		return json(emptyBody);
	}

	const bounds = getBoundsCache();

	try {
		const suggestions = await fetchAutocompleteResults(
			geocoderProvider,
			searchInput,
			geocoderApiKey,
			bounds
		);

		/** @type {import('$lib/types').PlaceSuggestionsResponse} */
		const body = { suggestions };
		return json(body);
	} catch (err) {
		console.error('Place suggestions endpoint failure:', err);
		return json({ error: 'Failed to fetch place suggestions' }, { status: 500 });
	}
}
