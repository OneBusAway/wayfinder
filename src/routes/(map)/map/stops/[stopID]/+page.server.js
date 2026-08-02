import oba, { handleOBAResponse } from '$lib/obaSdk.js';

/**
 * Cold-load / share path for a stop opened on the map. Returns the stop entry in
 * the same shape a map marker provides, so MapExperience can treat marker-tap and
 * direct-link stops identically. Arrivals are still fetched client-side by StopPane.
 */
export async function load({ params }) {
	const response = await oba.stop.retrieve(params.stopID);
	const body = await handleOBAResponse(response, 'stop').json();
	return { stopData: body.data.entry };
}
