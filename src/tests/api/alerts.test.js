import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PRIVATE_OBACO_API_BASE_URL: '',
	PRIVATE_REGION_ID: '1',
	PRIVATE_OBACO_SHOW_TEST_ALERTS: 'false'
}));

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

vi.mock('$lib/urls.js', () => ({
	buildURL: vi.fn((...args) => `${args[0]}/${args[1]}`)
}));

vi.mock('$lib/agencyFilter.js', () => ({
	getAgencyFilter: vi.fn(() => null),
	alertBelongsToAgency: vi.fn(() => true)
}));

vi.mock('gtfs-realtime-bindings', () => ({
	default: {
		transit_realtime: {
			FeedMessage: {
				decode: vi.fn(() => ({ entity: [] }))
			},
			Alert: {
				SeverityLevel: {
					SEVERE: 3,
					WARNING: 2
				}
			}
		}
	}
}));

import { GET } from '../../routes/api/oba/alerts/+server.js';

describe('GET /api/oba/alerts', () => {
	beforeEach(() => {
		mockEnv.PRIVATE_OBACO_API_BASE_URL = '';
		mockEnv.PRIVATE_REGION_ID = '1';
		mockEnv.PRIVATE_OBACO_SHOW_TEST_ALERTS = 'false';
		vi.restoreAllMocks();
	});

	it('returns 204 when PRIVATE_OBACO_API_BASE_URL is not set', async () => {
		mockEnv.PRIVATE_OBACO_API_BASE_URL = '';

		const response = await GET();

		expect(response.status).toBe(204);
		expect(response.headers.get('Content-Type')).toBe('application/json');
	});

	it('returns 204 when PRIVATE_OBACO_API_BASE_URL is undefined', async () => {
		mockEnv.PRIVATE_OBACO_API_BASE_URL = undefined;

		const response = await GET();

		expect(response.status).toBe(204);
	});
});
