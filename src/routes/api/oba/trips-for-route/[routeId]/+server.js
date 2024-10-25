import oba, { handleOBAResponse } from '$lib/obaSdk';

export async function GET({ params, url }) {
	const { routeId } = params;

	const includeStatus = url.searchParams.get('includeStatus') || 'true';
	const includeSchedule = url.searchParams.get('includeSchedule') || 'true';

	const queryParams = {
		includeStatus,
		includeSchedule
	};

	const response = await oba.tripsForRoute.list(routeId, queryParams);

	return handleOBAResponse(response, 'trips-for-route');
}
