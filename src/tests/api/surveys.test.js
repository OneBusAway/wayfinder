import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PRIVATE_SIDECAR_API_BASE_URL: '',
	PRIVATE_SIDECAR_REGION_ID: '1'
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
import { buildURL } from '$lib/urls.js';

describe('GET /api/oba/surveys', () => {
	beforeEach(() => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = '';
		mockEnv.PRIVATE_SIDECAR_REGION_ID = '1';
		mockEnv.PRIVATE_OBACO_API_BASE_URL = '';
		mockEnv.PRIVATE_REGION_ID = '';
		vi.restoreAllMocks();
	});

	it('returns empty surveys when PRIVATE_SIDECAR_API_BASE_URL is not set', async () => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = '';

		const url = new URL('http://localhost/api/oba/surveys?userId=123');
		const response = await GET({ url });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ surveys: [] });
	});

	it('returns empty surveys when PRIVATE_SIDECAR_API_BASE_URL is undefined', async () => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = undefined;

		const url = new URL('http://localhost/api/oba/surveys?userId=123');
		const response = await GET({ url });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ surveys: [] });
	});

	it('returns an empty list without fetching when no region ID is configured', async () => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = 'https://sidecar.onebusaway.org/api/v1';
		mockEnv.PRIVATE_SIDECAR_REGION_ID = '';
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		const url = new URL('http://localhost/api/oba/surveys?userId=123');
		const response = await GET({ url });

		expect(await response.json()).toEqual({ surveys: [] });
		// Never request regions/undefined/surveys.json
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('honors the deprecated PRIVATE_OBACO_* names', async () => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = '';
		mockEnv.PRIVATE_SIDECAR_REGION_ID = '';
		mockEnv.PRIVATE_OBACO_API_BASE_URL = 'https://onebusaway.co/api/v1';
		mockEnv.PRIVATE_REGION_ID = '7';
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ surveys: [] }), { status: 200 }));

		const url = new URL('http://localhost/api/oba/surveys?userId=123');
		const response = await GET({ url });

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalled();
		expect(buildURL).toHaveBeenCalledWith(
			'https://onebusaway.co/api/v1',
			'regions/7/surveys.json',
			{ user_id: '123' }
		);
	});
});
