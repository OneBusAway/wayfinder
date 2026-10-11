import { redirect } from '@sveltejs/kit';
import { loadServiceEntry } from '$lib/onDemand/upstream.server.js';

/**
 * Cold-load / share path for an on-demand service opened on the map. The sheet
 * itself is rendered by MapExperience from page state; this load supplies the
 * entry so the first paint needs no client fetch.
 */
export async function load({ params }) {
	const result = await loadServiceEntry(params.serviceId, 'simplified');
	if (result.kind === 'unsupported') redirect(307, '/');
	return {
		onDemandServiceId: params.serviceId,
		onDemandEntry: result.kind === 'ok' ? result.body : null
	};
}
