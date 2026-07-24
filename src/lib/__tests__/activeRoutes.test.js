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
		expect(result[0].type).toBe(3);
	});

	test('uses type 3 default when route reference is missing, but uses the reference type when present', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_no_ref',
						tripId: 't_a',
						routeShortName: 'NoRef',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					},
					{
						routeId: 'r_with_ref',
						tripId: 't_b',
						routeShortName: 'WithRef',
						predicted: true,
						predictedArrivalTime: 2000,
						scheduledArrivalTime: 2000
					}
				],
				[{ id: 'r_with_ref', shortName: 'WithRef', type: 2, color: 'abc123' }]
			)
		);
		const noRefRoute = result.find((r) => r.id === 'r_no_ref');
		const withRefRoute = result.find((r) => r.id === 'r_with_ref');
		expect(noRefRoute.type).toBe(3);
		expect(withRefRoute.type).toBe(2);
	});

	test('maintains input order when routes have identical effective arrival times', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					{
						routeId: 'r_first',
						tripId: 't_first',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					},
					{
						routeId: 'r_second',
						tripId: 't_second',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					},
					{
						routeId: 'r_third',
						tripId: 't_third',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					}
				],
				[
					{ id: 'r_first', shortName: 'First', type: 3, color: 'aaa' },
					{ id: 'r_second', shortName: 'Second', type: 3, color: 'bbb' },
					{ id: 'r_third', shortName: 'Third', type: 3, color: 'ccc' }
				]
			)
		);
		expect(result.map((r) => r.id)).toEqual(['r_first', 'r_second', 'r_third']);
	});

	test('handles null entries in arrivalsAndDepartures array', () => {
		const result = activeRoutesFromArrivals(
			makeResponse(
				[
					null,
					{
						routeId: 'r_valid',
						tripId: 't_valid',
						predicted: true,
						predictedArrivalTime: 1000,
						scheduledArrivalTime: 1000
					},
					null
				],
				[{ id: 'r_valid', shortName: 'Valid', type: 3, color: 'ddd' }]
			)
		);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('r_valid');
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

import { assignRouteColors } from '$lib/activeRoutes.js';
import { ROUTE_FALLBACK_PALETTE } from '$lib/colors.js';

const route = (id, gtfsColor) => ({ id, shortName: id, type: 3, tripId: `t_${id}`, gtfsColor });

function contrast(hexA, hexB) {
	const lum = (hex) => {
		const channels = [1, 3, 5]
			.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
			.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	};
	const [hi, lo] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
	return (hi + 0.05) / (lo + 0.05);
}

describe('assignRouteColors', () => {
	test('keeps a unique GTFS color, contrast-adjusted for the basemap', () => {
		const colors = assignRouteColors([route('r_c', 'b02a37')], { dark: false });
		expect(colors.get('r_c').line).toBe('#b02a37');
		expect(colors.get('r_c').badgeBg).toBe('b02a37');
	});

	test('badgeBg is always the line color without the hash', () => {
		const colors = assignRouteColors([route('r_c', 'b02a37'), route('r_22', 'e0a021')], {
			dark: true
		});
		for (const value of colors.values()) {
			expect(value.badgeBg).toBe(value.line.slice(1));
		}
	});

	test('gives colliding routes distinct colors', () => {
		const colors = assignRouteColors([route('r_22', '4a4a4a'), route('r_128', '4a4a4a')], {
			dark: false
		});
		expect(colors.get('r_22').line).not.toBe(colors.get('r_128').line);
	});

	test('assigns a palette color when the GTFS color is missing or invalid', () => {
		const palette = ROUTE_FALLBACK_PALETTE.map((entry) => entry.light);
		const colors = assignRouteColors([route('r_a', null), route('r_b', 'nonsense')], {
			dark: false
		});
		expect(palette).toContain(colors.get('r_a').line);
		expect(palette).toContain(colors.get('r_b').line);
		expect(colors.get('r_a').line).not.toBe(colors.get('r_b').line);
	});

	test('is stable when the input order changes', () => {
		const routes = [route('r_a', null), route('r_b', null), route('r_c', null)];
		const forward = assignRouteColors(routes, { dark: false });
		const reversed = assignRouteColors([...routes].reverse(), { dark: false });
		for (const { id } of routes) {
			expect(reversed.get(id).line).toBe(forward.get(id).line);
		}
	});

	test('uses the dark palette variant in dark mode', () => {
		const light = assignRouteColors([route('r_a', null)], { dark: false });
		const dark = assignRouteColors([route('r_a', null)], { dark: true });
		expect(dark.get('r_a').line).not.toBe(light.get('r_a').line);
		expect(ROUTE_FALLBACK_PALETTE.map((e) => e.dark)).toContain(dark.get('r_a').line);
	});

	test('picks a readable badge foreground for light backgrounds', () => {
		// #DCE775 (the Olive dark variant) is far too light for white text.
		const colors = assignRouteColors([route('r_a', 'DCE775')], { dark: true });
		const { badgeBg, badgeFg } = colors.get('r_a');
		expect(contrast(`#${badgeBg}`, `#${badgeFg}`)).toBeGreaterThanOrEqual(4.5);
	});

	test('returns an empty map for an empty route list', () => {
		expect(assignRouteColors([], { dark: false }).size).toBe(0);
	});
});

describe('ROUTE_FALLBACK_PALETTE', () => {
	// These guarantees are asserted in the design spec; enforce them here so a
	// future palette edit can't quietly break legibility.
	test('every entry clears 3:1 against its basemap and 4.5:1 against its text', () => {
		for (const { light, dark } of ROUTE_FALLBACK_PALETTE) {
			expect(contrast(light, '#F2F2F0')).toBeGreaterThanOrEqual(3);
			expect(contrast(dark, '#1B1B1B')).toBeGreaterThanOrEqual(3);
			expect(
				Math.max(contrast(light, '#FFFFFF'), contrast(light, '#000000'))
			).toBeGreaterThanOrEqual(4.5);
			expect(Math.max(contrast(dark, '#FFFFFF'), contrast(dark, '#000000'))).toBeGreaterThanOrEqual(
				4.5
			);
		}
	});

	test('entries stay visually distinct within each mode', () => {
		const distance = (a, b) => {
			const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
			const [x, y] = [parse(a), parse(b)];
			return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
		};
		for (const key of ['light', 'dark']) {
			const values = ROUTE_FALLBACK_PALETTE.map((entry) => entry[key]);
			for (let i = 0; i < values.length; i++) {
				for (let j = i + 1; j < values.length; j++) {
					expect(distance(values[i], values[j])).toBeGreaterThan(60);
				}
			}
		}
	});
});
