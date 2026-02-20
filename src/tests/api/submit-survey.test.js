import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PRIVATE_OBACO_API_BASE_URL: ''
}));

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

vi.mock('$lib/urls.js', () => ({
	buildURL: vi.fn((...args) => `${args[0]}/${args[1]}`)
}));

import { POST } from '../../routes/api/oba/surveys/submit-survey/+server.js';

describe('POST /api/oba/surveys/submit-survey', () => {
	beforeEach(() => {
		mockEnv.PRIVATE_OBACO_API_BASE_URL = '';
		vi.restoreAllMocks();
	});

	it('returns 503 when PRIVATE_OBACO_API_BASE_URL is not set', async () => {
		mockEnv.PRIVATE_OBACO_API_BASE_URL = '';

		const request = new Request('http://localhost/api/oba/surveys/submit-survey', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ surveyId: 1, answers: [] })
		});

		const response = await POST({ request });
		const data = await response.json();

		expect(response.status).toBe(503);
		expect(data).toEqual({ error: 'Survey service not configured' });
	});

	it('returns 503 when PRIVATE_OBACO_API_BASE_URL is undefined', async () => {
		mockEnv.PRIVATE_OBACO_API_BASE_URL = undefined;

		const request = new Request('http://localhost/api/oba/surveys/submit-survey', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ surveyId: 1, answers: [] })
		});

		const response = await POST({ request });
		const data = await response.json();

		expect(response.status).toBe(503);
		expect(data).toEqual({ error: 'Survey service not configured' });
	});
});
