import { describe, test, expect, vi, beforeEach } from 'vitest';

const retrieve = vi.fn();
vi.mock('$lib/obaSdk.js', () => ({
	default: { stop: { retrieve: (...a) => retrieve(...a) } },
	handleOBAResponse: (res) => res // pass-through; res already has .json()
}));

import { load } from '../../routes/(map)/map/stops/[stopID]/+page.server.js';

describe('/(map)/map/stops/[stopID] load', () => {
	beforeEach(() => retrieve.mockReset());

	test('returns the stop entry for the requested id', async () => {
		const entry = { id: '1_75403', lat: 47.6, lon: -122.3, name: 'Pine St & 3rd Ave' };
		retrieve.mockResolvedValue({ json: async () => ({ data: { entry } }) });

		const result = await load({ params: { stopID: '1_75403' } });

		expect(retrieve).toHaveBeenCalledWith('1_75403');
		expect(result).toEqual({ stopData: entry });
	});
});
