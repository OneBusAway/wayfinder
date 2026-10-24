import { json } from '@sveltejs/kit';
import oba, { handleOBAResponse } from '$lib/obaSdk';
import { getAgencyFilter, filterStops } from '$lib/agencyFilter.js';
import { parseLocationQuery } from '$lib/onDemand/params.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const parsed = parseLocationQuery(url.searchParams, {
		lonParam: 'lng',
		lonSpanParam: 'lngSpan',
		supportsGeometryDetail: false
	});
	if ('error' in parsed) {
		return json({ error: parsed.error }, { status: 400 });
	}

	const response = await oba.stopsForLocation.list(parsed.params);

	if (response.data?.list) {
		response.data.list = filterStops(response.data.list, getAgencyFilter());
	}

	return handleOBAResponse(response, 'stops-for-location');
}
