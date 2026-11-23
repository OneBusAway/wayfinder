/* eslint-disable no-restricted-syntax */
import oba, { callOBA, handleOBAResponse } from '$lib/obaSdk';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const stopID = params.stopID;
	const response = await callOBA(() => oba.stop.retrieve(stopID), 'stop');
	return handleOBAResponse(response, 'stop');
}
