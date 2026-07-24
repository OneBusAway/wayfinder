import { describe, test, expect } from 'vitest';
import { activeRoutesFromArrivals } from '$lib/activeRoutes.js';

function makeResponse(arrivals, routes = []) {
	return {
		data: {
			entry: { stopId: 'stop_1', arrivalsAndDepartures: arrivals },
			references: { routes }
		}
	};
}

describe('activeRoutesFromArrivals', () => {
	test('returns one entry per distinct route, soonest first', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_22',
						tripId: 't_b',
						predicted: true,
						predictedArrivalTime: 2000,
						scheduledArrivalTime: 2000
					},
					{
						routeId: 'r_c',
						tripId: 't_a',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					}
				],
				[
					{ id: 'r_c', shortName: 'C Line', type: 3, color: 'b02a37' },
					{ id: 'r_22', shortName: '22', type: 3, color: 'e0a021' }
				]
			)
		);
		expect(result.map((r) => r.id)).toEqual(['r_c', 'r_22']);
		expect(result[0]).toEqual({
			id: 'r_c',
			shortName: 'C Line',
			type: 3,
			tripId: 't_a',
			gtfsColor: 'b02a37'
		});
	});

	test('keeps the soonest trip when a route has several arrivals', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_c',
						tripId: 't_late',
						predicted: true,
						predictedArrivalTime: 5000,
						scheduledArrivalTime: 5000
					},
					{
						routeId: 'r_c',
						tripId: 't_soon',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					}
				],
				[{ id: 'r_c', shortName: 'C Line', type: 3, color: 'b02a37' }]
			)
		);
		expect(result).toHaveLength(1);
		expect(result[0].tripId).toBe('t_soon');
	});

	// OBA sends predictedArrivalTime: 0 (not null) when there is no real-time
	// prediction. A naive `predictedArrivalTime ?? scheduledArrivalTime` reads
	// that as "arriving at epoch" and sorts it first. This test is the point.
	test('treats predictedArrivalTime 0 as absent rather than as time zero', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_c',
						tripId: 't_unpredicted',
						predicted: false,
						predictedArrivalTime: 0,
						scheduledArrivalTime: 9000
					},
					{
						routeId: 'r_22',
						tripId: 't_predicted',
						predicted: true,
						predictedArrivalTime: 3000,
						scheduledArrivalTime: 3200
					}
				],
				[
					{ id: 'r_c', shortName: 'C Line', type: 3, color: 'b02a37' },
					{ id: 'r_22', shortName: '22', type: 3, color: 'e0a021' }
				]
			)
		);
		expect(result.map((r) => r.id)).toEqual(['r_22', 'r_c']);
	});

	test('picks the soonest trip by scheduled time when nothing is predicted', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_c',
						tripId: 't_late',
						predicted: false,
						predictedArrivalTime: 0,
						scheduledArrivalTime: 9000
					},
					{
						routeId: 'r_c',
						tripId: 't_soon',
						predicted: false,
						predictedArrivalTime: 0,
						scheduledArrivalTime: 4000
					}
				],
				[{ id: 'r_c', shortName: 'C Line', type: 3, color: 'b02a37' }]
			)
		);
		expect(result[0].tripId).toBe('t_soon');
	});

	test('falls back to the arrival routeShortName when the route reference is missing', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_x',
						tripId: 't_x',
						routeShortName: '773',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					}
				],
				[]
			)
		);
		expect(result[0].shortName).toBe('773');
		expect(result[0].gtfsColor).toBeNull();
	});

	test.each([
		['null', null],
		['undefined', undefined],
		['an empty object', {}],
		['a response with no entry', { data: { references: { routes: [] } } }],
		['a response with no arrivals array', { data: { entry: {}, references: { routes: [] } } }]
	])('returns an empty array for %s', (_label, input) => {
		expect(activeRoutesFromArrivals(input)).toEqual([]);
	});

	test('skips arrivals with no routeId', () => {
		const result = activeRoutesFromArrivals(
			makeResponse([{ tripId: 't_a', predicted: true, predictedArrivalTime: 1000 }], [])
		);
		expect(result).toEqual([]);
	});
});
