import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getOtpApiType at the module level — controls which path +server.js takes
let mockApiType = 'graphql';

vi.mock('$lib/otpServerCache.js', () => ({
	getOtpApiType: () => mockApiType,
	preloadOtpVersion: vi.fn(),
	clearOtpCache: vi.fn()
}));

// Realistic GraphQL response fixture: walk -> bus -> walk (3 legs)
function makeGraphQLResponse(edges = undefined) {
	if (edges === undefined) {
		edges = [
			{
				node: {
					start: '2026-02-19T17:15:00-08:00',
					end: '2026-02-19T17:48:00-08:00',
					legs: [
						{
							mode: 'WALK',
							duration: { total: 270 },
							distance: 360.2,
							headsign: null,
							from: {
								name: 'Origin',
								lat: 47.6205,
								lon: -122.3212,
								departure: {
									scheduledTime: '2026-02-19T17:15:00-08:00',
									estimated: null
								}
							},
							to: {
								name: 'Pine St & Broadway',
								lat: 47.6139,
								lon: -122.321,
								arrival: {
									scheduledTime: '2026-02-19T17:19:30-08:00',
									estimated: null
								}
							},
							route: null,
							legGeometry: { points: 'walk_polyline_here' },
							steps: [
								{
									relativeDirection: 'LEFT',
									streetName: 'Pine St',
									distance: 150.5,
									absoluteDirection: 'WEST'
								}
							]
						},
						{
							mode: 'BUS',
							duration: { total: 1440 },
							distance: 4200.8,
							headsign: 'Capitol Hill',
							from: {
								name: 'Pine St & Broadway',
								lat: 47.6139,
								lon: -122.321,
								departure: {
									scheduledTime: '2026-02-19T17:19:30-08:00',
									estimated: { time: '2026-02-19T17:21:00-08:00' }
								}
							},
							to: {
								name: '15th Ave NE & NE 40th St',
								lat: 47.6556,
								lon: -122.3119,
								arrival: {
									scheduledTime: '2026-02-19T17:43:30-08:00',
									estimated: { time: '2026-02-19T17:44:00-08:00' }
								}
							},
							route: { shortName: '10', longName: 'Capitol Hill - University District' },
							legGeometry: { points: 'bus_polyline_here' },
							steps: []
						},
						{
							mode: 'WALK',
							duration: { total: 270 },
							distance: 360.3,
							headsign: null,
							from: {
								name: '15th Ave NE & NE 40th St',
								lat: 47.6556,
								lon: -122.3119,
								departure: {
									scheduledTime: '2026-02-19T17:43:30-08:00',
									estimated: null
								}
							},
							to: {
								name: 'Destination',
								lat: 47.6587,
								lon: -122.3128,
								arrival: {
									scheduledTime: '2026-02-19T17:48:00-08:00',
									estimated: null
								}
							},
							route: null,
							legGeometry: { points: 'walk_polyline_2' },
							steps: [
								{
									relativeDirection: 'CONTINUE',
									streetName: '15th Ave NE',
									distance: 180.1,
									absoluteDirection: 'NORTH'
								}
							]
						}
					]
				}
			}
		];
	}
	return {
		data: {
			planConnection: {
				edges
			}
		}
	};
}

function makeRESTResponse() {
	const baseTime = Date.now();
	return {
		plan: {
			date: baseTime,
			itineraries: [
				{
					duration: 1980,
					startTime: baseTime + 300000,
					endTime: baseTime + 2280000,
					legs: [
						{
							startTime: baseTime + 300000,
							endTime: baseTime + 570000,
							mode: 'WALK',
							distance: 360.2,
							duration: 270,
							from: { name: 'Origin', lat: 47.6205, lon: -122.3212 },
							to: { name: 'Pine St & Broadway', lat: 47.6139, lon: -122.321 },
							legGeometry: { points: 'walk_polyline' },
							steps: []
						}
					]
				}
			]
		}
	};
}

const BASE_PARAMS =
	'fromPlace=47.6205%2C-122.3212&toPlace=47.6587%2C-122.3128&date=02-19-2026&time=5%3A08+PM';

function makeURL(extra = '') {
	return new URL(`http://localhost/api/otp/plan?${BASE_PARAMS}${extra ? '&' + extra : ''}`);
}

describe('GET /api/otp/plan', () => {
	let GET;
	let mockFetch;

	beforeEach(async () => {
		vi.resetModules();
		mockFetch = vi.fn();
		global.fetch = mockFetch;
		mockApiType = 'graphql';

		vi.doMock('$env/static/public', () => ({
			PUBLIC_OTP_SERVER_URL: 'https://otp.test.example.com'
		}));

		const mod = await import('../../routes/api/otp/plan/+server.js');
		GET = mod.GET;
	});

	// -- Validation tests --

	it('returns 400 when fromPlace is missing', async () => {
		const url = new URL('http://localhost/api/otp/plan?toPlace=47.6587,-122.3128');
		try {
			await GET({ url });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(400);
		}
	});

	it('returns 400 when toPlace is missing', async () => {
		const url = new URL('http://localhost/api/otp/plan?fromPlace=47.6205,-122.3212');
		try {
			await GET({ url });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(400);
		}
	});

	it('returns 503 when PUBLIC_OTP_SERVER_URL is not configured', async () => {
		vi.resetModules();
		vi.doMock('$env/static/public', () => ({
			PUBLIC_OTP_SERVER_URL: ''
		}));
		const mod = await import('../../routes/api/otp/plan/+server.js');

		try {
			await mod.GET({ url: makeURL() });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(503);
		}
	});

	// -- GraphQL path tests (apiType = 'graphql') --

	it('uses GraphQL when apiType is graphql', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [graphqlUrl, options] = mockFetch.mock.calls[0];
		expect(graphqlUrl).toBe('https://otp.test.example.com/otp/gtfs/v1');
		expect(options.method).toBe('POST');

		expect(data.plan.itineraries).toHaveLength(1);
		expect(data.plan.itineraries[0].legs).toHaveLength(3);
	});

	// -- REST path tests (apiType = 'rest') --

	it('uses REST when apiType is rest', async () => {
		mockApiType = 'rest';

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeRESTResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [restUrl] = mockFetch.mock.calls[0];
		expect(restUrl).toContain('/routers/default/plan?');
		expect(data.plan.itineraries).toHaveLength(1);
	});

	// -- Null apiType defaults to REST --

	it('defaults to REST when apiType is null', async () => {
		mockApiType = null;

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeRESTResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [restUrl] = mockFetch.mock.calls[0];
		expect(restUrl).toContain('/routers/default/plan?');
		expect(data.plan.itineraries).toHaveLength(1);
	});

	// -- GraphQL response mapping tests --

	it('maps planConnection.edges[].node to plan.itineraries[]', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(data.plan).toBeDefined();
		expect(data.plan.itineraries).toBeInstanceOf(Array);
		expect(data.plan.itineraries).toHaveLength(1);
	});

	it('converts ISO datetime strings to unix milliseconds for startTime/endTime', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();
		const itin = data.plan.itineraries[0];

		expect(typeof itin.startTime).toBe('number');
		expect(typeof itin.endTime).toBe('number');
		expect(itin.startTime).toBe(new Date('2026-02-19T17:15:00-08:00').getTime());
		expect(itin.endTime).toBe(new Date('2026-02-19T17:48:00-08:00').getTime());
	});

	it('calculates duration in seconds from start/end', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();
		const itin = data.plan.itineraries[0];

		const expectedDuration =
			(new Date('2026-02-19T17:48:00-08:00').getTime() -
				new Date('2026-02-19T17:15:00-08:00').getTime()) /
			1000;
		expect(itin.duration).toBe(expectedDuration);
	});

	it('maps leg fields: mode, duration, distance, headsign, routeShortName, from/to, legGeometry, steps', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();
		const legs = data.plan.itineraries[0].legs;

		// Walk leg
		const walkLeg = legs[0];
		expect(walkLeg.mode).toBe('WALK');
		expect(walkLeg.duration).toBe(270);
		expect(walkLeg.distance).toBe(360.2);
		expect(walkLeg.from.name).toBe('Origin');
		expect(walkLeg.to.name).toBe('Pine St & Broadway');
		expect(walkLeg.legGeometry.points).toBe('walk_polyline_here');
		expect(walkLeg.steps).toHaveLength(1);
		expect(walkLeg.steps[0].relativeDirection).toBe('LEFT');

		// Bus leg
		const busLeg = legs[1];
		expect(busLeg.mode).toBe('BUS');
		expect(busLeg.headsign).toBe('Capitol Hill');
		expect(busLeg.routeShortName).toBe('10');
		expect(busLeg.routeLongName).toBe('Capitol Hill - University District');
		expect(busLeg.distance).toBe(4200.8);
	});

	it('prefers estimated.time over scheduledTime for leg start/end times', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();
		const busLeg = data.plan.itineraries[0].legs[1];

		// Bus leg has estimated times
		expect(busLeg.startTime).toBe(new Date('2026-02-19T17:21:00-08:00').getTime());
		expect(busLeg.endTime).toBe(new Date('2026-02-19T17:44:00-08:00').getTime());
	});

	it('uses scheduledTime when estimated is null', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();
		const walkLeg = data.plan.itineraries[0].legs[0];

		// Walk leg has no estimated times
		expect(walkLeg.startTime).toBe(new Date('2026-02-19T17:15:00-08:00').getTime());
		expect(walkLeg.endTime).toBe(new Date('2026-02-19T17:19:30-08:00').getTime());
	});

	it('maps GraphQL errors to { error: { id, msg } } format', async () => {
		const errorResponse = {
			errors: [{ message: 'No trip found for the input' }],
			data: null
		};
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => errorResponse
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(data.error).toBeDefined();
		expect(data.error.id).toBeDefined();
		expect(data.error.msg).toBe('No trip found for the input');
	});

	it('returns empty itineraries array when edges is empty', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse([])
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(data.plan.itineraries).toEqual([]);
	});

	it('handles duration as plain number (not object)', async () => {
		const gqlResponse = makeGraphQLResponse();
		// Change duration from {total: 270} to plain 270
		gqlResponse.data.planConnection.edges[0].node.legs[0].duration = 270;

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => gqlResponse
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();
		expect(data.plan.itineraries[0].legs[0].duration).toBe(270);
	});

	// -- Parameter conversion tests --

	it('converts date/time to ISO 8601 for GraphQL request', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		await GET({ url: makeURL() });

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		const vars = body.variables;

		// date "02-19-2026" + time "5:08 PM" → "2026-02-19T17:08:00"
		expect(vars.dateTime.earliestDeparture).toBe('2026-02-19T17:08:00');
	});

	it('uses latestArrival when arriveBy=true', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		await GET({ url: makeURL('arriveBy=true') });

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		const vars = body.variables;

		expect(vars.dateTime.latestArrival).toBe('2026-02-19T17:08:00');
		expect(vars.dateTime.earliestDeparture).toBeUndefined();
	});

	it('uses earliestDeparture when arriveBy=false', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		await GET({ url: makeURL('arriveBy=false') });

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		const vars = body.variables;

		expect(vars.dateTime.earliestDeparture).toBe('2026-02-19T17:08:00');
		expect(vars.dateTime.latestArrival).toBeUndefined();
	});

	it('converts TRANSIT,WALK mode string to GraphQL modes input', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		await GET({ url: makeURL('mode=TRANSIT%2CWALK') });

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		const vars = body.variables;

		expect(vars.modes.direct).toContain('WALK');
		expect(vars.modes.transit).toBeDefined();
		expect(vars.modes.transit.transit).toBeInstanceOf(Array);
		expect(vars.modes.transit.transit.length).toBeGreaterThan(0);
		expect(vars.modes.transit.transit.some((m) => m.mode === 'BUS')).toBe(true);
	});

	it('passes wheelchair=true as GraphQL preference', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		await GET({ url: makeURL('wheelchair=true') });

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		const vars = body.variables;

		expect(vars.wheelchair).toBe(true);
	});

	it('passes origin and destination coordinates', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		await GET({ url: makeURL() });

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		const vars = body.variables;

		expect(vars.origin.location.coordinate.latitude).toBe(47.6205);
		expect(vars.origin.location.coordinate.longitude).toBe(-122.3212);
		expect(vars.destination.location.coordinate.latitude).toBe(47.6587);
		expect(vars.destination.location.coordinate.longitude).toBe(-122.3128);
	});

	// -- REST behavior (regression) tests --

	it('includes _otpUrl in REST response', async () => {
		mockApiType = 'rest';

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeRESTResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(data._otpUrl).toContain('routers/default/plan');
		expect(data._otpUrl).toContain('fromPlace=');
	});

	it('includes _otpUrl in GraphQL response', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(data._otpUrl).toContain('otp/gtfs/v1');
	});

	// -- Error handling tests --

	it('throws HTTP error when GraphQL returns non-2xx', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 502,
			json: async () => ({})
		});

		try {
			await GET({ url: makeURL() });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(502);
		}
	});

	it('throws HTTP error when REST returns non-2xx', async () => {
		mockApiType = 'rest';

		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 502,
			json: async () => ({})
		});

		try {
			await GET({ url: makeURL() });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(502);
		}
	});

	it('wraps raw network errors as 500', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

		try {
			await GET({ url: makeURL() });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(500);
			expect(e.body.message).toBe('Failed to fetch trip planning data');
		}
	});

	// -- Additional mode conversion tests --

	it('converts specific transit modes (BUS,WALK) to individual GraphQL entries', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		await GET({ url: makeURL('mode=BUS%2CWALK') });

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		const vars = body.variables;

		expect(vars.modes.direct).toContain('WALK');
		expect(vars.modes.transit.transit).toEqual([{ mode: 'BUS' }]);
	});

	it('converts BICYCLE mode to GraphQL direct mode', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		await GET({ url: makeURL('mode=BICYCLE') });

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		const vars = body.variables;

		expect(vars.modes.direct).toContain('BICYCLE');
		expect(vars.modes.transit).toBeUndefined();
	});

	// -- Input validation tests --

	it('returns 400 when time format is invalid for GraphQL', async () => {
		const url = new URL(
			'http://localhost/api/otp/plan?fromPlace=47.6205,-122.3212&toPlace=47.6587,-122.3128&date=02-19-2026&time=17:08'
		);
		try {
			await GET({ url });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(400);
			expect(e.body.message).toContain('Invalid date/time format');
		}
	});

	it('returns 400 when fromPlace coordinate format is invalid', async () => {
		const url = new URL(
			'http://localhost/api/otp/plan?fromPlace=invalid&toPlace=47.6587,-122.3128&date=02-19-2026&time=5%3A08+PM'
		);
		try {
			await GET({ url });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(400);
			expect(e.body.message).toContain('Invalid fromPlace coordinate format');
		}
	});

	it('returns 400 when toPlace coordinate format is invalid', async () => {
		const url = new URL(
			'http://localhost/api/otp/plan?fromPlace=47.6205,-122.3212&toPlace=not,numbers&date=02-19-2026&time=5%3A08+PM'
		);
		try {
			await GET({ url });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(400);
			expect(e.body.message).toContain('Invalid toPlace coordinate format');
		}
	});

	// -- Response edge case tests --

	it('treats GraphQL response with both errors and data as success', async () => {
		const partialResponse = {
			errors: [{ message: 'Some field failed' }],
			data: {
				planConnection: {
					edges: makeGraphQLResponse().data.planConnection.edges
				}
			}
		};
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => partialResponse
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(data.plan.itineraries).toHaveLength(1);
		expect(data.error).toBeUndefined();
	});

	it('returns error when planConnection is missing from response', async () => {
		const weirdResponse = {
			data: { somethingElse: true }
		};
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => weirdResponse
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(data.error).toBeDefined();
		expect(data.error.msg).toBe('Unexpected response structure from trip planning server');
	});

	it('uses fallback message when GraphQL errors array has no message', async () => {
		const errorResponse = {
			errors: [{}],
			data: null
		};
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => errorResponse
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();

		expect(data.error.msg).toBe('Unknown GraphQL error');
	});

	it('defaults legGeometry and steps when missing from GraphQL response', async () => {
		const gqlResponse = makeGraphQLResponse();
		const leg = gqlResponse.data.planConnection.edges[0].node.legs[0];
		delete leg.legGeometry;
		delete leg.steps;

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => gqlResponse
		});

		const response = await GET({ url: makeURL() });
		const data = await response.json();
		const mappedLeg = data.plan.itineraries[0].legs[0];

		expect(mappedLeg.legGeometry).toEqual({ points: '' });
		expect(mappedLeg.steps).toEqual([]);
	});

	it('uses current time/date defaults when time and date params are omitted', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => makeGraphQLResponse()
		});

		const url = new URL(
			'http://localhost/api/otp/plan?fromPlace=47.6205,-122.3212&toPlace=47.6587,-122.3128'
		);
		const response = await GET({ url });
		const data = await response.json();

		expect(data.plan.itineraries).toHaveLength(1);

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		expect(body.variables.dateTime.earliestDeparture).toBeTruthy();
	});

	// -- Error propagation tests --

	it('propagates HttpError from GraphQL validation instead of swallowing it', async () => {
		const url = new URL(
			'http://localhost/api/otp/plan?fromPlace=47.6205,-122.3212&toPlace=47.6587,-122.3128&date=02-19-2026&time=invalid'
		);
		try {
			await GET({ url });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e.status).toBe(400);
			expect(e.body.message).toContain('Invalid date/time format');
		}

		// Should NOT have made any fetch call (validation error before fetch)
		expect(mockFetch).toHaveBeenCalledTimes(0);
	});
});
