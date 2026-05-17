import { describe, it, expect } from 'vitest';
import { NoopAdapter } from '$lib/Analytics/adapters/NoopAdapter.js';

describe('NoopAdapter', () => {
	it('reports as disabled', () => {
		const adapter = new NoopAdapter();
		expect(adapter.isEnabled()).toBe(false);
	});

	it('forwardEvent returns analytics disabled status', async () => {
		const adapter = new NoopAdapter();
		const result = await adapter.forwardEvent(
			{ name: 'pageview', url: '/' },
			{ userAgent: 'X', clientIp: '' }
		);
		expect(result).toEqual({ status: 'analytics disabled' });
	});
});
