/* eslint-disable no-restricted-syntax */
import oba, { callOBA, handleOBAResponse } from '$lib/obaSdk';

export async function GET({ params, url }) {
	const { routeId } = params;

	const includeStatus = url.searchParams.get('includeStatus') || 'true';
	const includeSchedule = url.searchParams.get('includeSchedule') || 'true';

	const queryParams = {
		includeStatus,
		includeSchedule
	};

	const response = await callOBA(
		() => oba.tripsForRoute.list(routeId, queryParams),
		'trips-for-route'
	);

	return handleOBAResponse(response, 'trips-for-route');
}
