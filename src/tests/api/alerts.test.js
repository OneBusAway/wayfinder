import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PRIVATE_SIDECAR_API_BASE_URL: '',
	PRIVATE_SIDECAR_REGION_ID: '1',
	PRIVATE_SIDECAR_SHOW_TEST_ALERTS: 'false'
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
import { buildURL } from '$lib/urls.js';
import { isStartDateWithin24Hours, isHighSeverity } from '$lib/alerts.js';

describe('GET /api/oba/alerts', () => {
	beforeEach(() => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = '';
		mockEnv.PRIVATE_SIDECAR_REGION_ID = '1';
		mockEnv.PRIVATE_SIDECAR_SHOW_TEST_ALERTS = 'false';
		mockEnv.PRIVATE_OBACO_API_BASE_URL = '';
		mockEnv.PRIVATE_REGION_ID = '';
		mockEnv.PRIVATE_OBACO_SHOW_TEST_ALERTS = '';
		vi.restoreAllMocks();
	});

	it('returns 204 without fetching when the base URL is set but no region ID is', async () => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = 'https://sidecar.onebusaway.org/api/v1';
		mockEnv.PRIVATE_SIDECAR_REGION_ID = '';
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		const response = await GET();

		expect(response.status).toBe(204);
		// Never request regions/undefined/alerts.pb
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('requests the region-scoped alerts path', async () => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = 'https://sidecar.onebusaway.org/api/v1';
		mockEnv.PRIVATE_SIDECAR_REGION_ID = '7';
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ArrayBuffer(0)));

		await GET();

		expect(buildURL).toHaveBeenCalledWith(
			'https://sidecar.onebusaway.org/api/v1',
			'regions/7/alerts.pb',
			{}
		);
	});

	it('asks Sidecar for test alerts when the test flag is on', async () => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = 'https://sidecar.onebusaway.org/api/v1';
		mockEnv.PRIVATE_SIDECAR_REGION_ID = '7';
		mockEnv.PRIVATE_SIDECAR_SHOW_TEST_ALERTS = 'true';
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ArrayBuffer(0)));

		await GET();

		expect(buildURL).toHaveBeenCalledWith(
			'https://sidecar.onebusaway.org/api/v1',
			'regions/7/alerts.pb',
			{ test: 1 }
		);
	});

	it('returns 204 when PRIVATE_SIDECAR_API_BASE_URL is not set', async () => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = '';

		const response = await GET();

		expect(response.status).toBe(204);
		expect(response.headers.get('Content-Type')).toBe('application/json');
	});

	it('returns 204 when PRIVATE_SIDECAR_API_BASE_URL is undefined', async () => {
		mockEnv.PRIVATE_SIDECAR_API_BASE_URL = undefined;

		const response = await GET();

		expect(response.status).toBe(204);
	});
});

describe('isStartDateWithin24Hours', () => {
	it('returns false when alert is null', () => {
		expect(isStartDateWithin24Hours(null)).toBe(false);
	});

	it('returns false when alert is undefined', () => {
		expect(isStartDateWithin24Hours(undefined)).toBe(false);
	});

	it('returns false when activePeriod is an empty array', () => {
		expect(isStartDateWithin24Hours({ activePeriod: [] })).toBe(false);
	});

	it('returns false when activePeriod is undefined', () => {
		expect(isStartDateWithin24Hours({ activePeriod: undefined })).toBe(false);
	});

	it('returns false when activePeriod is null', () => {
		expect(isStartDateWithin24Hours({ activePeriod: null })).toBe(false);
	});

	it('returns false when activePeriod[0].start is undefined', () => {
		expect(isStartDateWithin24Hours({ activePeriod: [{}] })).toBe(false);
	});

	it('returns true when start is within the last 24 hours', () => {
		const nowSeconds = Math.floor(Date.now() / 1000);
		const oneHourAgo = nowSeconds - 60 * 60;
		expect(isStartDateWithin24Hours({ activePeriod: [{ start: oneHourAgo }] })).toBe(true);
	});

	it('returns false when start is in the future', () => {
		const nowSeconds = Math.floor(Date.now() / 1000);
		const oneHourFromNow = nowSeconds + 60 * 60;
		expect(isStartDateWithin24Hours({ activePeriod: [{ start: oneHourFromNow }] })).toBe(false);
	});

	it('returns false when start is more than 24 hours ago', () => {
		const nowSeconds = Math.floor(Date.now() / 1000);
		const twentyFiveHoursAgo = nowSeconds - 25 * 60 * 60;
		expect(isStartDateWithin24Hours({ activePeriod: [{ start: twentyFiveHoursAgo }] })).toBe(false);
	});

	it('returns true when start is exactly now', () => {
		const nowSeconds = Math.floor(Date.now() / 1000);
		expect(isStartDateWithin24Hours({ activePeriod: [{ start: nowSeconds }] })).toBe(true);
	});
});

describe('isHighSeverity', () => {
	it('returns false for null alert', () => {
		expect(isHighSeverity(null)).toBe(false);
	});

	it('returns false for undefined alert', () => {
		expect(isHighSeverity(undefined)).toBe(false);
	});

	it('returns true for SEVERE severity', () => {
		expect(isHighSeverity({ severityLevel: 3 })).toBe(true);
	});

	it('returns true for WARNING severity', () => {
		expect(isHighSeverity({ severityLevel: 2 })).toBe(true);
	});

	it('returns false for other severity levels', () => {
		expect(isHighSeverity({ severityLevel: 1 })).toBe(false);
		expect(isHighSeverity({ severityLevel: 0 })).toBe(false);
	});
});
