import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAdapter } from '$lib/Analytics/createAdapter.js';
import { NoopAdapter } from '$lib/Analytics/adapters/NoopAdapter.js';
import { PlausibleAdapter } from '$lib/Analytics/adapters/PlausibleAdapter.js';
import { UmamiAdapter } from '$lib/Analytics/adapters/UmamiAdapter.js';

describe('createAdapter', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns NoopAdapter when PUBLIC_ANALYTICS_PROVIDER is "none"', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: 'none' })).toBeInstanceOf(NoopAdapter);
	});

	it('returns NoopAdapter when provider is unset', () => {
		expect(createAdapter({})).toBeInstanceOf(NoopAdapter);
	});

	it('returns NoopAdapter when provider is empty string', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: '' })).toBeInstanceOf(NoopAdapter);
	});

	it('returns NoopAdapter for unknown provider values', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: 'bogus' })).toBeInstanceOf(NoopAdapter);
	});

	it('returns PlausibleAdapter when provider is "plausible"', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: 'plausible' })).toBeInstanceOf(
			PlausibleAdapter
		);
	});

	it('returns UmamiAdapter when provider is "umami"', () => {
		expect(createAdapter({ PUBLIC_ANALYTICS_PROVIDER: 'umami' })).toBeInstanceOf(UmamiAdapter);
	});

	it('passes env through to the adapter', () => {
		const env = {
			PUBLIC_ANALYTICS_PROVIDER: 'plausible',
			PUBLIC_ANALYTICS_DOMAIN: 'example.com',
			PUBLIC_ANALYTICS_API_HOST: 'https://p.example.com'
		};
		expect(createAdapter(env).isEnabled()).toBe(true);
	});
});
