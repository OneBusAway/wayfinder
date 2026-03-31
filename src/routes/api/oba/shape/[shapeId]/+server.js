import oba, { handleOBAResponse } from '$lib/obaSdk';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const shapeId = params.shapeId;
	const response = await oba.shape.retrieve(shapeId);

	return handleOBAResponse(response, 'shape');
}
