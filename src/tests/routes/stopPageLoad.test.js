import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PRIVATE_OBA_AGENCY_FILTER: ''
}));

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

const retrieveMock = vi.fn();
const listMock = vi.fn();

vi.mock('$lib/obaSdk.js', () => ({
	default: {
		stop: { retrieve: (...args) => retrieveMock(...args) },
		arrivalAndDeparture: { list: (...args) => listMock(...args) }
	},
	handleOBAResponse: (res) => res
}));

import { load } from '../../routes/stops/[stopID]/+page.server.js';

describe('/stops/[stopID] +page.server load', () => {
	beforeEach(() => {
		mockEnv.PRIVATE_OBA_AGENCY_FILTER = '';
		retrieveMock.mockReset();
		listMock.mockReset();
	});

	test('leaves routes and routeIds untouched when agency filter is unset', async () => {
		const stopEntry = {
			id: '1_75403',
			name: 'Pine St & 3rd Ave',
			routeIds: ['1_10', '40_550']
		};
		const routes = [
			{ id: '1_10', agencyId: '1', shortName: '10' },
			{ id: '40_550', agencyId: '40', shortName: '550' }
		];
		const arrivals = [{ routeId: '1_10' }, { routeId: '40_550' }];

		retrieveMock.mockResolvedValue({
			json: async () => ({
				data: {
					entry: stopEntry,
					references: { routes }
				}
			})
		});
		listMock.mockResolvedValue({
			json: async () => ({
				data: {
					entry: { arrivalsAndDepartures: arrivals }
				}
			})
		});

		const result = await load({ params: { stopID: '1_75403' } });

		expect(result.stopData.entry.routeIds).toEqual(['1_10', '40_550']);
		expect(result.stopData.references.routes).toEqual(routes);
		expect(result.arrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures).toEqual(arrivals);
	});

	test('filters references.routes, entry.routeIds, and arrivals when agency filter is configured', async () => {
		mockEnv.PRIVATE_OBA_AGENCY_FILTER = '1';

		const stopEntry = {
			id: '1_75403',
			name: 'Pine St & 3rd Ave',
			routeIds: ['1_10', '40_550']
		};
		const routes = [
			{ id: '1_10', agencyId: '1', shortName: '10' },
			{ id: '40_550', agencyId: '40', shortName: '550' }
		];
		const arrivals = [{ routeId: '1_10' }, { routeId: '40_550' }];

		retrieveMock.mockResolvedValue({
			json: async () => ({
				data: {
					entry: stopEntry,
					references: { routes }
				}
			})
		});
		listMock.mockResolvedValue({
			json: async () => ({
				data: {
					entry: { arrivalsAndDepartures: arrivals }
				}
			})
		});

		const result = await load({ params: { stopID: '1_75403' } });

		// Only agency 1 items survive; agency 40 is filtered out
		expect(result.stopData.entry.routeIds).toEqual(['1_10']);
		expect(result.stopData.references.routes).toEqual([
			{ id: '1_10', agencyId: '1', shortName: '10' }
		]);
		expect(result.arrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures).toEqual([
			{ routeId: '1_10' }
		]);
	});
});
