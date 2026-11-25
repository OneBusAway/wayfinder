/* eslint-disable no-restricted-syntax */
import { json } from '@sveltejs/kit';
import oba, { callOBA } from '$lib/obaSdk.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, url }) {
	const { tripId } = params;

	const serviceDate = url.searchParams.get('serviceDate');
	const includeTrip = url.searchParams.get('includeTrip') || 'true';
	const includeSchedule = url.searchParams.get('includeSchedule') || 'true';
	const includeStatus = url.searchParams.get('includeStatus') || 'true';
	const time = url.searchParams.get('time');

	const queryParams = {
		includeTrip,
		includeSchedule,
		includeStatus
	};

	if (time) {
		queryParams.time = time;
	}

	if (serviceDate) {
		queryParams.serviceDate = serviceDate;
	}

	const response = await callOBA(
		() => oba.tripDetails.retrieve(tripId, queryParams),
		'trip-details'
	);

	return json(response);
}
