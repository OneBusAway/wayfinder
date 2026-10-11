import { json } from '@sveltejs/kit';
import { parseLocationQuery } from '$lib/onDemand/params.js';
import { loadServicesForLocation, onDemandResponse } from '$lib/onDemand/upstream.server.js';

export async function GET({ url }) {
	const parsed = parseLocationQuery(url.searchParams);
	if ('error' in parsed) return json({ error: parsed.error }, { status: 400 });
	return onDemandResponse(await loadServicesForLocation(parsed.params));
}
