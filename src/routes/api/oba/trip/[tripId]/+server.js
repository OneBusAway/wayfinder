import oba, { handleOBAResponse } from '$lib/obaSdk';

export async function GET({ params }) {
	const { tripId } = params;

	const response = await oba.trip.retrieve(tripId);

	return handleOBAResponse(response, 'trip');
}
