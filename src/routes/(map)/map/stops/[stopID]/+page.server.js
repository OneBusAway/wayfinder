/* eslint-disable no-restricted-syntax */
import oba, { callOBA } from '$lib/obaSdk.js';

/**
 * Cold-load / share path for a stop opened on the map. Returns the stop entry in
 * the same shape a map marker provides, so MapExperience can treat marker-tap and
 * direct-link stops identically. Arrivals are still fetched client-side by StopPane.
 */
export async function load({ params }) {
	const response = await callOBA(() => oba.stop.retrieve(params.stopID), 'stop');
	return { stopData: response.data.entry };
}
