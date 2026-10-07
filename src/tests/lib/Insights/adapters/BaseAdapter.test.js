import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseAdapter } from '$lib/Insights/adapters/BaseAdapter.js';

afterEach(() => {
	vi.unstubAllGlobals();
});

class StubAdapter extends BaseAdapter {
	constructor(env) {
		super(env, {
			name: 'StubAdapter',
			requiredEnvKeys: ['PUBLIC_ANALYTICS_API_HOST'],
			timeoutMs: 5000
		});
	}

	buildRequest(envelope, requestContext) {
		return {
			url: `${this.env.PUBLIC_ANALYTICS_API_HOST}/custom`,
			body: { event: envelope.name, path: envelope.url, visitor: requestContext.visitorId },
			headers: { 'Content-Type': 'application/json' }
		};
	}
}

describe('BaseAdapter', () => {
	it('supports a provider-specific payload through a small buildRequest implementation', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				text: async () => '{"received":true}'
			})
		);
		const adapter = new StubAdapter({ PUBLIC_ANALYTICS_API_HOST: 'https://stub.example.com' });

		await expect(
			adapter.forwardEvent({ name: 'signup', url: '/welcome' }, { visitorId: 'visitor-1' })
		).resolves.toEqual({ received: true });

		expect(global.fetch).toHaveBeenCalledWith(
			'https://stub.example.com/custom',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ event: 'signup', path: '/welcome', visitor: 'visitor-1' })
			})
		);
	});

	it('times out while reading a stalled response body', async () => {
		vi.useFakeTimers();
		let signal;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_url, options) => {
				signal = options.signal;
				return Promise.resolve({
					ok: true,
					text: () =>
						new Promise((_, reject) => {
							signal.addEventListener('abort', () =>
								reject(new DOMException('signal aborted', 'AbortError'))
							);
						})
				});
			})
		);
		const adapter = new StubAdapter({ PUBLIC_ANALYTICS_API_HOST: 'https://stub.example.com' });

		const result = adapter.forwardEvent({ name: 'signup', url: '/welcome' }, { visitorId: 'v1' });
		const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
		await vi.advanceTimersByTimeAsync(5000);

		await rejection;
		expect(signal.aborted).toBe(true);
		vi.useRealTimers();
	});

	it('throws when buildRequest is not implemented', () => {
		const adapter = new BaseAdapter(
			{ PUBLIC_ANALYTICS_API_HOST: 'https://stub.example.com' },
			{ name: 'BaseAdapter', requiredEnvKeys: ['PUBLIC_ANALYTICS_API_HOST'], timeoutMs: 5000 }
		);

		expect(() => adapter.buildRequest()).toThrow('not implemented');
	});
});
