import { describe, test, expect, vi, beforeEach } from 'vitest';

const loadServiceEntry = vi.hoisted(() => vi.fn());
vi.mock('$lib/onDemand/upstream.server.js', () => ({ loadServiceEntry }));

import { load } from '../../routes/(map)/map/ondemand/[serviceId]/+page.server.js';

describe('/(map)/map/ondemand/[serviceId] load', () => {
	beforeEach(() => loadServiceEntry.mockReset());

	test('returns the envelope for a known service', async () => {
		loadServiceEntry.mockResolvedValue({ kind: 'ok', body: { code: 200 } });
		expect(await load({ params: { serviceId: '5088_77652' } })).toEqual({
			onDemandServiceId: '5088_77652',
			onDemandEntry: { code: 200 }
		});
		expect(loadServiceEntry).toHaveBeenCalledWith('5088_77652', 'simplified');
	});

	test('returns a null entry when not found, letting the sheet say so', async () => {
		loadServiceEntry.mockResolvedValue({ kind: 'notFound' });
		expect((await load({ params: { serviceId: 'x' } })).onDemandEntry).toBeNull();
	});

	test('redirects home when the server has no on-demand support', async () => {
		loadServiceEntry.mockResolvedValue({ kind: 'unsupported' });
		await expect(load({ params: { serviceId: 'x' } })).rejects.toMatchObject({
			status: 307,
			location: '/'
		});
	});
});
