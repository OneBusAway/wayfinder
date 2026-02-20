import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockOtpServerUrl = 'https://otp.test.example.com';

vi.mock('$env/static/public', () => ({
	get PUBLIC_OTP_SERVER_URL() {
		return mockOtpServerUrl;
	}
}));

describe('otpServerCache', () => {
	let mockFetch;

	beforeEach(async () => {
		vi.resetModules();
		mockFetch = vi.fn();
		global.fetch = mockFetch;
		mockOtpServerUrl = 'https://otp.test.example.com';

		const { clearOtpCache } = await import('$lib/otpServerCache.js');
		clearOtpCache();
	});

	it('detects OTP 2.x as graphql from JSON response with version.major = 2', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ version: { major: 2, minor: 7, patch: 0 } })
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();

		expect(getOtpApiType()).toBe('graphql');
		expect(mockFetch).toHaveBeenCalledWith('https://otp.test.example.com');
	});

	it('detects OTP 1.x as rest from JSON response with version.major = 1', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ version: { major: 1, minor: 5, patch: 0 } })
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();

		expect(getOtpApiType()).toBe('rest');
	});

	it('detects XML/non-JSON response as rest (OTP 1.x)', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/xml' }),
			json: async () => {
				throw new Error('not json');
			}
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();

		expect(getOtpApiType()).toBe('rest');
	});

	it('leaves otpApiType as null on network error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();

		expect(getOtpApiType()).toBeNull();
		console.error.mockRestore();
	});

	it('leaves otpApiType as null on HTTP error response', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 502,
			headers: new Headers({ 'content-type': 'text/html' })
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();

		expect(getOtpApiType()).toBeNull();
		console.error.mockRestore();
	});

	it('skips detection when PUBLIC_OTP_SERVER_URL is empty', async () => {
		mockOtpServerUrl = '';

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();

		expect(getOtpApiType()).toBeNull();
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('does not refetch when cache is valid', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ version: { major: 2 } })
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();
		await preloadOtpVersion();
		await preloadOtpVersion();

		expect(getOtpApiType()).toBe('graphql');
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('re-detects after TTL expires', async () => {
		vi.useFakeTimers();

		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ version: { major: 2 } })
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();
		expect(getOtpApiType()).toBe('graphql');

		// Advance past TTL (1 hour + 1ms)
		vi.advanceTimersByTime(3600001);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/xml' })
		});

		await preloadOtpVersion();
		expect(getOtpApiType()).toBe('rest');
		expect(mockFetch).toHaveBeenCalledTimes(2);

		vi.useRealTimers();
	});

	it('concurrent calls share the same promise (no duplicate fetches)', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ version: { major: 2 } })
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await Promise.all([preloadOtpVersion(), preloadOtpVersion(), preloadOtpVersion()]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(getOtpApiType()).toBe('graphql');
	});

	it('force refresh bypasses cache', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ version: { major: 2 } })
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();
		expect(getOtpApiType()).toBe('graphql');

		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ version: { major: 1 } })
		});

		await preloadOtpVersion(true);
		expect(getOtpApiType()).toBe('rest');
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('clearOtpCache resets all state', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ version: { major: 2 } })
		});

		const { preloadOtpVersion, getOtpApiType, clearOtpCache } = await import(
			'$lib/otpServerCache.js'
		);
		await preloadOtpVersion();
		expect(getOtpApiType()).toBe('graphql');

		clearOtpCache();
		expect(getOtpApiType()).toBeNull();
	});

	it('treats missing content-type header as non-JSON (rest)', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers()
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();

		expect(getOtpApiType()).toBe('rest');
	});

	it('treats JSON response without version field as rest', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ serverInfo: { name: 'OTP' } })
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();

		expect(getOtpApiType()).toBe('rest');
	});

	it('retries detection after HTTP error on next call (no stale cache)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});

		// First call: server returns 503
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 503,
			headers: new Headers()
		});

		const { preloadOtpVersion, getOtpApiType } = await import('$lib/otpServerCache.js');
		await preloadOtpVersion();
		expect(getOtpApiType()).toBeNull();

		// Second call: server is back, returns OTP 2.x
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ version: { major: 2 } })
		});

		await preloadOtpVersion();
		expect(getOtpApiType()).toBe('graphql');
		expect(mockFetch).toHaveBeenCalledTimes(2);

		console.error.mockRestore();
	});
});
