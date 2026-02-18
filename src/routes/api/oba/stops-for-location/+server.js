import oba, { handleOBAResponse } from '$lib/obaSdk';
import { getAgencyFilter, filterStops } from '$lib/agencyFilter.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const lat = +url.searchParams.get('lat');
	const lng = +url.searchParams.get('lng');
	const latSpan = +url.searchParams.get('latSpan');
	const lngSpan = +url.searchParams.get('lngSpan');
	const radius = +url.searchParams.get('radius');

	const queryParams = {
		lat: lat,
		lon: lng,
		latSpan: latSpan,
		lngSpan: lngSpan,
		radius: radius
	};

	const response = await oba.stopsForLocation.list(queryParams);

	const agencyFilter = getAgencyFilter();
	if (agencyFilter) {
		response.data.list = filterStops(response.data.list, agencyFilter);
	}

	return handleOBAResponse(response, 'stops-for-location');
}
