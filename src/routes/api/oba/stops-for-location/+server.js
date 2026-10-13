import { json } from '@sveltejs/kit';
import oba, { handleOBAResponse } from '$lib/obaSdk';
import { getAgencyFilter, filterStops } from '$lib/agencyFilter.js';
import { parseLocationQuery } from '$lib/onDemand/params.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const searchParams = new URLSearchParams(url.searchParams);
	searchParams.set('lon', url.searchParams.get('lng') ?? '');
	searchParams.set('lonSpan', url.searchParams.get('lngSpan') ?? '');
	searchParams.delete('geometryDetail');
	const parsed = parseLocationQuery(searchParams);
	if ('error' in parsed) {
		const error = parsed.error.replace(/^lon\b/, 'lng').replace(/\blonSpan\b/g, 'lngSpan');
		return json({ error }, { status: 400 });
	}

	const response = await oba.stopsForLocation.list(parsed.params);

	if (response.data?.list) {
		response.data.list = filterStops(response.data.list, getAgencyFilter());
	}

	return handleOBAResponse(response, 'stops-for-location');
}
