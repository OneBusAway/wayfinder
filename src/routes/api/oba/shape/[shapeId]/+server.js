/* eslint-disable no-restricted-syntax */
import oba, { handleOBAResponse } from '$lib/obaSdk.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const shapeId = params.shapeId;
	const response = await oba.shape.retrieve(shapeId);

	return handleOBAResponse(response, 'shape');
}
