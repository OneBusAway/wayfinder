/* eslint-disable no-restricted-syntax */
import oba, { callOBA, handleOBAResponse } from '$lib/obaSdk.js';

export async function GET({ params }) {
	const routeId = params.routeId;
	const response = await callOBA(() => oba.stopsForRoute.list(routeId), 'stops-for-route');
	return handleOBAResponse(response, 'stops-for-route');
}
