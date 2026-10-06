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

	it('throws when buildRequest is not implemented', () => {
		const adapter = new BaseAdapter(
			{ PUBLIC_ANALYTICS_API_HOST: 'https://stub.example.com' },
			{ name: 'BaseAdapter', requiredEnvKeys: ['PUBLIC_ANALYTICS_API_HOST'], timeoutMs: 5000 }
		);

		expect(() => adapter.buildRequest()).toThrow('not implemented');
	});
});
