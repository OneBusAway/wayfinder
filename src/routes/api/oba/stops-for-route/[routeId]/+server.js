/* eslint-disable no-restricted-syntax */
import { json } from '@sveltejs/kit';
import oba, { callOBA } from '$lib/obaSdk.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const routeId = params.routeId;
	const response = await callOBA(() => oba.stopsForRoute.list(routeId), 'stops-for-route');

	return json(response);
}
