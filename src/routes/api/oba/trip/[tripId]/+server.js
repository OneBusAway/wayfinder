/* eslint-disable no-restricted-syntax */
import oba, { callOBA, handleOBAResponse } from '$lib/obaSdk';

export async function GET({ params }) {
	const { tripId } = params;
	const response = await callOBA(() => oba.trip.retrieve(tripId), 'trip');
	return handleOBAResponse(response, 'trip');
}
