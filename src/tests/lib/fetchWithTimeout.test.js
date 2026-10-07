import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '$lib/fetchWithTimeout.js';

describe('fetchWithTimeout', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('returns the successful fetch response and clears the timer', async () => {
		vi.useFakeTimers();
		const response = new Response('ok');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

		await expect(fetchWithTimeout('https://example.com', {}, 1000)).resolves.toBe(response);

		expect(global.fetch).toHaveBeenCalledWith(
			'https://example.com',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
		expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('aborts the underlying fetch when the timeout expires', async () => {
		vi.useFakeTimers();
		let fetchSignal;
		vi.stubGlobal(
			'fetch',
			vi.fn(
				(_url, { signal }) =>
					new Promise((_, reject) => {
						fetchSignal = signal;
						signal.addEventListener('abort', () => {
							reject(new DOMException('signal aborted', 'AbortError'));
						});
					})
			)
		);

		const result = fetchWithTimeout('https://example.com', {}, 1000);
		const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
		await vi.advanceTimersByTimeAsync(1000);

		await rejection;
		expect(fetchSignal.aborted).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('aborts the underlying fetch when the caller signal aborts', async () => {
		const callerController = new AbortController();
		let fetchSignal;
		vi.stubGlobal(
			'fetch',
			vi.fn(
				(_url, { signal }) =>
					new Promise((_, reject) => {
						fetchSignal = signal;
						signal.addEventListener('abort', () => {
							reject(new DOMException('signal aborted', 'AbortError'));
						});
					})
			)
		);

		const result = fetchWithTimeout(
			'https://example.com',
			{ signal: callerController.signal },
			1000
		);
		const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
		callerController.abort();

		await rejection;
		expect(fetchSignal.aborted).toBe(true);
	});
});
