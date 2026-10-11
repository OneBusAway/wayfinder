import { json } from '@sveltejs/kit';
import { parseGeometryDetail } from '$lib/onDemand/params.js';
import { loadServiceEntry, onDemandResponse } from '$lib/onDemand/upstream.server.js';

export async function GET({ params, url }) {
	const detail = parseGeometryDetail(url.searchParams.get('geometryDetail'));
	if ('error' in detail) return json({ error: detail.error }, { status: 400 });
	return onDemandResponse(await loadServiceEntry(params.id, detail.value));
}
