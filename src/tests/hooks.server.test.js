import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRecordHttpRequest = vi.fn();
const mockStartMetricsServer = vi.fn();
let mockBuilding = false;

vi.mock('$app/environment', () => ({
	get building() {
		return mockBuilding;
	}
}));
vi.mock('$env/dynamic/private', () => ({ env: { METRICS_PORT: '9200' } }));
vi.mock('$lib/serverCache.js', () => ({
	preloadRoutesData: vi.fn().mockResolvedValue(undefined),
	getRoutesCache: vi.fn(),
	getAgenciesCache: vi.fn(),
	getBoundsCache: vi.fn()
}));
vi.mock('$lib/otpServerCache.js', () => ({
	preloadOtpVersion: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/metrics/registry.js', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		recordHttpRequest: mockRecordHttpRequest
	};
});
vi.mock('$lib/metrics/server.js', () => ({
	startMetricsServer: mockStartMetricsServer
}));

function makeEvent({ method = 'GET', routeId = '/stops/[stopID]' } = {}) {
	return {
		request: new Request('http://localhost/stops/1_100', { method }),
		route: { id: routeId }
	};
}

describe('hooks.server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('starts the metrics server on the configured port', async () => {
		vi.resetModules();
		mockBuilding = false;
		await import('../hooks.server.js');
		expect(mockStartMetricsServer).toHaveBeenCalledWith(9200);
	});

	it('does not start the metrics server during the build', async () => {
		vi.resetModules();
		mockBuilding = true;
		await import('../hooks.server.js');
		expect(mockStartMetricsServer).not.toHaveBeenCalled();
	});

	it('records method, route template, status, and duration for each request', async () => {
		const { handle } = await import('../hooks.server.js');
		const response = new Response('ok', { status: 200 });
		const resolve = vi.fn().mockResolvedValue(response);

		const result = await handle({ event: makeEvent(), resolve });

		expect(result).toBe(response);
		expect(mockRecordHttpRequest).toHaveBeenCalledWith({
			method: 'GET',
			route: '/stops/[stopID]',
			status: 200,
			durationSeconds: expect.any(Number)
		});
	});

	it('labels unmatched routes as (unmatched)', async () => {
		const { handle } = await import('../hooks.server.js');
		const resolve = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));

		await handle({ event: makeEvent({ routeId: null }), resolve });

		expect(mockRecordHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({ route: '(unmatched)', status: 404 })
		);
	});

	it('records a 500 and rethrows when resolve fails', async () => {
		const { handle } = await import('../hooks.server.js');
		const boom = new Error('boom');
		const resolve = vi.fn().mockRejectedValue(boom);

		await expect(handle({ event: makeEvent(), resolve })).rejects.toThrow(boom);
		expect(mockRecordHttpRequest).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
	});
});
