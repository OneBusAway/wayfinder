/* eslint-disable no-restricted-syntax */
import oba, { callOBA, handleOBAResponse } from '$lib/obaSdk.js';

/**
 * Cold-load / share path for a stop opened on the map. Returns the stop entry in
 * the same shape a map marker provides, so MapExperience can treat marker-tap and
 * direct-link stops identically. Arrivals are still fetched client-side by StopPane.
 */
export async function load({ params }) {
	const response = await callOBA(() => oba.stop.retrieve(params.stopID), 'stop');
	const body = response?.data ? response : await handleOBAResponse(response, 'stop').json();
	return { stopData: body.data.entry };
}
