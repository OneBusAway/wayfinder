import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({}));

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

/**
 * The module warns at most once per deprecated variable, so each test needs a
 * fresh copy to observe the warning rather than a suppressed repeat.
 */
async function loadSidecarConfig() {
	vi.resetModules();
	return import('$lib/sidecarConfig.js');
}

describe('sidecarConfig', () => {
	let warn;

	beforeEach(() => {
		for (const key of Object.keys(mockEnv)) {
			delete mockEnv[key];
		}
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('getSidecarBaseURL', () => {
		it('reads PRIVATE_SIDECAR_API_BASE_URL without warning', async () => {
			mockEnv.PRIVATE_SIDECAR_API_BASE_URL = 'https://sidecar.onebusaway.org/api/v1';

			const { getSidecarBaseURL } = await loadSidecarConfig();

			expect(getSidecarBaseURL()).toBe('https://sidecar.onebusaway.org/api/v1');
			expect(warn).not.toHaveBeenCalled();
		});

		it('falls back to PRIVATE_OBACO_API_BASE_URL and warns once', async () => {
			mockEnv.PRIVATE_OBACO_API_BASE_URL = 'https://onebusaway.co/api/v1';

			const { getSidecarBaseURL } = await loadSidecarConfig();

			expect(getSidecarBaseURL()).toBe('https://onebusaway.co/api/v1');
			expect(getSidecarBaseURL()).toBe('https://onebusaway.co/api/v1');
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toContain('PRIVATE_OBACO_API_BASE_URL');
			expect(warn.mock.calls[0][0]).toContain('PRIVATE_SIDECAR_API_BASE_URL');
		});

		it('prefers the new name, and says the deprecated one is being ignored', async () => {
			mockEnv.PRIVATE_SIDECAR_API_BASE_URL = 'https://sidecar.onebusaway.org/api/v1';
			mockEnv.PRIVATE_OBACO_API_BASE_URL = 'https://onebusaway.co/api/v1';

			const { getSidecarBaseURL } = await loadSidecarConfig();

			expect(getSidecarBaseURL()).toBe('https://sidecar.onebusaway.org/api/v1');
			expect(getSidecarBaseURL()).toBe('https://sidecar.onebusaway.org/api/v1');
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toContain('is set but ignored');
		});

		it('does not warn when only the new name is set', async () => {
			mockEnv.PRIVATE_SIDECAR_API_BASE_URL = 'https://sidecar.onebusaway.org/api/v1';

			const { getSidecarBaseURL } = await loadSidecarConfig();

			expect(getSidecarBaseURL()).toBe('https://sidecar.onebusaway.org/api/v1');
			expect(warn).not.toHaveBeenCalled();
		});

		it('lets a deprecated name win when the new name is set but empty', async () => {
			mockEnv.PRIVATE_SIDECAR_API_BASE_URL = '';
			mockEnv.PRIVATE_OBACO_API_BASE_URL = 'https://onebusaway.co/api/v1';

			const { getSidecarBaseURL } = await loadSidecarConfig();

			expect(getSidecarBaseURL()).toBe('https://onebusaway.co/api/v1');
		});

		it('returns undefined when neither name is set', async () => {
			const { getSidecarBaseURL } = await loadSidecarConfig();

			expect(getSidecarBaseURL()).toBeUndefined();
			expect(warn).not.toHaveBeenCalled();
		});

		it('treats an empty deprecated value as unset', async () => {
			mockEnv.PRIVATE_OBACO_API_BASE_URL = '';

			const { getSidecarBaseURL } = await loadSidecarConfig();

			expect(getSidecarBaseURL()).toBeUndefined();
			expect(warn).not.toHaveBeenCalled();
		});
	});

	describe('getSidecarRegionPath', () => {
		it('builds the region path from PRIVATE_SIDECAR_REGION_ID', async () => {
			mockEnv.PRIVATE_SIDECAR_REGION_ID = '1';

			const { getSidecarRegionPath } = await loadSidecarConfig();

			expect(getSidecarRegionPath()).toBe('regions/1/');
			expect(warn).not.toHaveBeenCalled();
		});

		it('falls back to PRIVATE_REGION_ID and warns', async () => {
			mockEnv.PRIVATE_REGION_ID = '42';

			const { getSidecarRegionPath } = await loadSidecarConfig();

			expect(getSidecarRegionPath()).toBe('regions/42/');
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toContain('PRIVATE_SIDECAR_REGION_ID');
		});

		it('is undefined when no region ID is configured', async () => {
			mockEnv.PRIVATE_SIDECAR_API_BASE_URL = 'https://sidecar.onebusaway.org/api/v1';

			const { getSidecarRegionPath } = await loadSidecarConfig();

			expect(getSidecarRegionPath()).toBeUndefined();
		});

		it('reflects a region ID that changes after the module is loaded', async () => {
			mockEnv.PRIVATE_SIDECAR_REGION_ID = '1';

			const { getSidecarRegionPath } = await loadSidecarConfig();
			expect(getSidecarRegionPath()).toBe('regions/1/');

			mockEnv.PRIVATE_SIDECAR_REGION_ID = '2';
			expect(getSidecarRegionPath()).toBe('regions/2/');
		});
	});

	describe('sidecarShowsTestAlerts', () => {
		it('is true only for the string "true"', async () => {
			mockEnv.PRIVATE_SIDECAR_SHOW_TEST_ALERTS = 'true';

			const { sidecarShowsTestAlerts } = await loadSidecarConfig();

			expect(sidecarShowsTestAlerts()).toBe(true);
		});

		it('is false when unset', async () => {
			const { sidecarShowsTestAlerts } = await loadSidecarConfig();

			expect(sidecarShowsTestAlerts()).toBe(false);
			expect(warn).not.toHaveBeenCalled();
		});

		it('falls back to PRIVATE_OBACO_SHOW_TEST_ALERTS and warns', async () => {
			mockEnv.PRIVATE_OBACO_SHOW_TEST_ALERTS = 'true';

			const { sidecarShowsTestAlerts } = await loadSidecarConfig();

			expect(sidecarShowsTestAlerts()).toBe(true);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toContain('PRIVATE_SIDECAR_SHOW_TEST_ALERTS');
		});
	});
});

describe('warnSidecarNotConfigured', () => {
	let warn;

	beforeEach(() => {
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('names only the variables that are missing', async () => {
		const { warnSidecarNotConfigured } = await loadSidecarConfig();

		warnSidecarNotConfigured('alerts', ['PRIVATE_SIDECAR_REGION_ID']);

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('PRIVATE_SIDECAR_REGION_ID');
		expect(warn.mock.calls[0][0]).not.toContain('PRIVATE_SIDECAR_API_BASE_URL');
	});

	it('warns once per route and missing-variable set, not once per request', async () => {
		const { warnSidecarNotConfigured } = await loadSidecarConfig();

		warnSidecarNotConfigured('alerts', ['PRIVATE_SIDECAR_REGION_ID']);
		warnSidecarNotConfigured('alerts', ['PRIVATE_SIDECAR_REGION_ID']);
		warnSidecarNotConfigured('alerts', ['PRIVATE_SIDECAR_REGION_ID']);

		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('still reports a different route or a different missing set', async () => {
		const { warnSidecarNotConfigured } = await loadSidecarConfig();

		warnSidecarNotConfigured('alerts', ['PRIVATE_SIDECAR_REGION_ID']);
		warnSidecarNotConfigured('surveys', ['PRIVATE_SIDECAR_REGION_ID']);
		warnSidecarNotConfigured('alerts', ['PRIVATE_SIDECAR_API_BASE_URL']);

		expect(warn).toHaveBeenCalledTimes(3);
	});
});

describe('DEPRECATED_ALIASES agrees with env-schema.json', () => {
	it('lists the same old-name/new-name pairs as the schema', async () => {
		const [{ DEPRECATED_ALIASES }, schema] = await Promise.all([
			import('$lib/sidecarConfig.js'),
			import('../../../env-schema.json').then((m) => m.default)
		]);

		// Compare pairs rather than an object keyed by the new name: a schema entry
		// listing two aliases must fail here, not silently keep only the last.
		const fromSchema = Object.entries(schema)
			.filter(([, rule]) => rule.deprecatedNames)
			.flatMap(([name, rule]) => rule.deprecatedNames.map((alias) => `${name}=${alias}`));
		const fromRuntime = Object.entries(DEPRECATED_ALIASES).map(
			([name, alias]) => `${name}=${alias}`
		);

		expect(fromSchema.sort()).toEqual(fromRuntime.sort());
	});
});
