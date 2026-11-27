/* eslint-disable no-restricted-syntax */
import { error, json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	const response = await fetch('https://regions.onebusaway.org/regions-v3.json');

	if (!response.ok) {
		error(500, 'Unable to fetch regions.');
		return;
	}

	const data = await response.json();
	return json(data);
}
