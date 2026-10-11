import { json } from '@sveltejs/kit';
import oba, { handleOBAResponse } from '$lib/obaSdk';
import { getAgencyFilter, filterStops } from '$lib/agencyFilter.js';
import { finiteNumber } from '$lib/onDemand/params.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const lat = finiteNumber(url.searchParams.get('lat'));
	if (lat === null || lat < -90 || lat > 90) {
		return json({ error: 'lat must be a finite number between -90 and 90' }, { status: 400 });
	}

	const lng = finiteNumber(url.searchParams.get('lng'));
	if (lng === null || lng < -180 || lng > 180) {
		return json({ error: 'lng must be a finite number between -180 and 180' }, { status: 400 });
	}

	const queryParams = { lat, lon: lng };
	for (const [field, sdkField] of [
		['latSpan', 'latSpan'],
		['lngSpan', 'lonSpan'],
		['radius', 'radius']
	]) {
		const raw = url.searchParams.get(field);
		if (raw === null) continue;

		const value = finiteNumber(raw);
		if (value === null || value <= 0) {
			return json({ error: `${field} must be a finite positive number` }, { status: 400 });
		}
		queryParams[sdkField] = value;
	}

	const response = await oba.stopsForLocation.list(queryParams);

	if (response.data?.list) {
		response.data.list = filterStops(response.data.list, getAgencyFilter());
	}

	return handleOBAResponse(response, 'stops-for-location');
}
