import { json } from '@sveltejs/kit';
import { buildURL } from '$lib/urls.js';
import { getSidecarBaseURL, warnSidecarNotConfigured } from '$lib/sidecarConfig.js';

export async function POST({ request, params }) {
	// No region path here: the survey_responses endpoints are not region-scoped.
	const baseURL = getSidecarBaseURL();
	if (!baseURL) {
		warnSidecarNotConfigured('update-survey', ['PRIVATE_SIDECAR_API_BASE_URL']);
		return json({ error: 'Survey service not configured' }, { status: 503 });
	}

	try {
		const { id } = params;
		const body = await request.text();

		const url = buildURL(baseURL, `/survey_responses/${id}`);

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body
		});

		if (!response.ok) {
			throw new Error('Failed to update survey response');
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		console.error('Error updating survey response:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
