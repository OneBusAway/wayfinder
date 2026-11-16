/* eslint-disable no-restricted-syntax */
import oba, { handleOBAResponse } from '$lib/obaSdk.js';

export async function GET({ params }) {
	const routeId = params.routeId;
	const response = await oba.stopsForRoute.list(routeId);
	return handleOBAResponse(response, 'stops-for-route');
}
