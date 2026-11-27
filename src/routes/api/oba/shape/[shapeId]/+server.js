/* eslint-disable no-restricted-syntax */
import { json } from '@sveltejs/kit';
import oba, { callOBA } from '$lib/obaSdk.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const shapeId = params.shapeId;
	const response = await callOBA(() => oba.shape.retrieve(shapeId), 'shape');

	return json(response);
}
