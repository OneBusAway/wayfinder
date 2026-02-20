import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { buildURL } from '$lib/urls.js';

const REGION_PATH = `regions/${env.PRIVATE_REGION_ID}/`;

export async function GET({ url }) {
	if (!env.PRIVATE_OBACO_API_BASE_URL) {
		console.warn('[surveys] PRIVATE_OBACO_API_BASE_URL not configured, skipping surveys');
		return json({ surveys: [] });
	}

	const userId = url.searchParams.get('userId');

	try {
		const url = buildURL(env.PRIVATE_OBACO_API_BASE_URL, `${REGION_PATH}surveys.json`, {
			user_id: userId
		});

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error('Failed to fetch surveys');
		}

		const data = await response.json();

		return json(data);
	} catch (error) {
		console.error('Error loading surveys:', error);
		return json({ error: 'Failed to load surveys' }, { status: 500 });
	}
}
