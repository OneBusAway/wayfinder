import oba, { handleOBAResponse } from '$lib/obaSdk';

export async function GET({ params }) {
	const routeId = params.routeId;
	const response = await oba.stopsForRoute.list(routeId);
	return handleOBAResponse(response, 'stops-for-route');
}
