/* eslint-disable no-restricted-syntax */
import { json } from '@sveltejs/kit';
import oba, { callOBA } from '$lib/obaSdk';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const stopID = params.stopID;
	const response = await callOBA(() => oba.stop.retrieve(stopID), 'stop');

	return json(response);
}
