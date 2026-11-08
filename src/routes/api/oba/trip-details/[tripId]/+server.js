import oba, { handleOBAResponse } from '$lib/obaSdk.js';

export async function GET({ params, url }) {
	const { tripId } = params;

	const serviceDate = url.searchParams.get('serviceDate');
	const includeTrip = url.searchParams.get('includeTrip') || 'true';
	const includeSchedule = url.searchParams.get('includeSchedule') || 'true';
	const includeStatus = url.searchParams.get('includeStatus') || 'true';

	const queryParams = {
		includeTrip,
		includeSchedule,
		includeStatus
	};

	if (serviceDate != null) {
		queryParams.serviceDate = serviceDate;
	}
	const response = await oba.tripDetails.retrieve(tripId, queryParams);

	return handleOBAResponse(response, 'trip-details');
}
