/* eslint-disable no-restricted-syntax */
import oba, { handleOBAResponse } from '$lib/obaSdk';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const stopID = params.stopID;

	const response = await oba.stop.retrieve(stopID);

	return handleOBAResponse(response, 'stop');
}
