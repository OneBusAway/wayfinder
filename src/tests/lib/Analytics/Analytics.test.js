import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PUBLIC_ANALYTICS_PROVIDER: 'plausible'
}));

vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockEnv;
	}
}));

import { Analytics } from '$lib/Analytics/Analytics.js';

describe('Analytics (constructor + isEnabled)', () => {
	beforeEach(() => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'plausible';
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('falls back to dynamic env when none provided', () => {
		mockEnv.PUBLIC_ANALYTICS_PROVIDER = 'umami';
		expect(new Analytics().isEnabled()).toBe(true);
	});

	it('accepts an env arg', () => {
		const instance = new Analytics({ PUBLIC_ANALYTICS_PROVIDER: 'plausible' });
		expect(instance.isEnabled()).toBe(true);
	});

	it('isEnabled() returns false when provider is "none"', () => {
		expect(new Analytics({ PUBLIC_ANALYTICS_PROVIDER: 'none' }).isEnabled()).toBe(false);
	});

	it('isEnabled() returns false when provider is empty string', () => {
		expect(new Analytics({ PUBLIC_ANALYTICS_PROVIDER: '' }).isEnabled()).toBe(false);
	});

	it('isEnabled() returns false when provider is undefined', () => {
		expect(new Analytics({}).isEnabled()).toBe(false);
	});

	it('initialises defaultProperties to empty object', () => {
		expect(new Analytics({}).defaultProperties).toEqual({});
	});
});
