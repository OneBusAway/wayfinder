/* eslint-disable no-restricted-syntax */
import oba, { callOBA, handleOBAResponse } from '$lib/obaSdk.js';

export async function GET({ params }) {
	const { shapeId } = params;
	const response = await callOBA(() => oba.shape.retrieve(shapeId), 'shape');
	return handleOBAResponse(response, 'shape');
}
