/* eslint-disable no-restricted-syntax */
import { json } from '@sveltejs/kit';
import { buildURL } from '$lib/urls';
import {
	getSidecarBaseURL,
	getSidecarRegionPath,
	warnSidecarNotConfigured
} from '$lib/sidecarConfig.js';

export async function GET({ url }) {
	const baseURL = getSidecarBaseURL();
	const regionPath = getSidecarRegionPath();
	const missing = [];
	if (!baseURL) missing.push('PRIVATE_SIDECAR_API_BASE_URL');
	if (!regionPath) missing.push('PRIVATE_SIDECAR_REGION_ID');
	if (missing.length > 0) {
		warnSidecarNotConfigured('surveys', missing);
		return json({ surveys: [] });
	}

	const userId = url.searchParams.get('userId')?.trim();

	try {
		const targetURL = buildURL(
			baseURL,
			`${regionPath}surveys.json`,
			userId ? { user_id: userId } : {}
		);

		const response = await fetch(targetURL);

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
