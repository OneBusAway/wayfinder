import { error, json } from '@sveltejs/kit';

export async function GET({ url }) {
	const fromPlace = url.searchParams.get('fromPlace');
	const toPlace = url.searchParams.get('toPlace');

	if (!fromPlace || !toPlace) {
		throw error(400, 'Missing required parameters: fromPlace and toPlace');
	}

	try {
		const response = await fetch(
			`https://otp.prod.sound.obaweb.org/otp/routers/default/plan?fromPlace=${encodeURIComponent(fromPlace)}&toPlace=${encodeURIComponent(toPlace)}`,
			{
				headers: {
					Accept: 'application/json'
				}
			}
		);

		if (!response.ok) {
			throw error(response.status, `OpenTripPlanner API returned status ${response.status}`);
		}

		const data = await response.json();
		return json(data);
	} catch (err) {
		if (err.status) throw err;

		throw error(500, {
			message: 'Failed to fetch trip planning data',
			error: err.message
		});
	}
}
