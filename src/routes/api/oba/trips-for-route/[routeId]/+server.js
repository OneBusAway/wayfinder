/* eslint-disable no-restricted-syntax */
import { json } from '@sveltejs/kit';
import oba, { callOBA } from '$lib/obaSdk';

/** @type {import('./$types').RequestHandler} */
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

	return json(response);
}
