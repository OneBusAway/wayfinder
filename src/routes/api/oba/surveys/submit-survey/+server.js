import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { buildURL } from '$lib/urls.js';

export async function POST({ request }) {
	if (!env.PRIVATE_OBACO_API_BASE_URL) {
		console.warn('[submit-survey] PRIVATE_OBACO_API_BASE_URL not configured');
		return json({ error: 'Survey service not configured' }, { status: 503 });
	}

	try {
		const body = await request.text();

		const url = buildURL(env.PRIVATE_OBACO_API_BASE_URL, '/survey_responses.json');

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body
		});

		if (!response.ok) {
			throw new Error('Failed to submit survey response');
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		console.error('Error submitting survey response:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
