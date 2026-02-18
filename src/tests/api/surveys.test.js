import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PRIVATE_OBACO_API_BASE_URL: '',
	PRIVATE_REGION_ID: '1'
}));

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

vi.mock('$lib/urls.js', () => ({
	buildURL: vi.fn((...args) => `${args[0]}/${args[1]}`)
}));

import { GET } from '../../routes/api/oba/surveys/+server.js';

describe('GET /api/oba/surveys', () => {
	beforeEach(() => {
		mockEnv.PRIVATE_OBACO_API_BASE_URL = '';
		mockEnv.PRIVATE_REGION_ID = '1';
		vi.restoreAllMocks();
	});

	it('returns empty surveys when PRIVATE_OBACO_API_BASE_URL is not set', async () => {
		mockEnv.PRIVATE_OBACO_API_BASE_URL = '';

		const url = new URL('http://localhost/api/oba/surveys?userId=123');
		const response = await GET({ url });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ surveys: [] });
	});

	it('returns empty surveys when PRIVATE_OBACO_API_BASE_URL is undefined', async () => {
		mockEnv.PRIVATE_OBACO_API_BASE_URL = undefined;

		const url = new URL('http://localhost/api/oba/surveys?userId=123');
		const response = await GET({ url });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ surveys: [] });
	});
});
