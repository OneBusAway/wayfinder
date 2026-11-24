/* eslint-disable no-restricted-syntax */
import { json } from '@sveltejs/kit';
import oba, { callOBA } from '$lib/obaSdk';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const { tripId } = params;
	const response = await callOBA(() => oba.trip.retrieve(tripId), 'trip');

	return json(response);
}
