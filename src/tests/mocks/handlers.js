import { http, HttpResponse } from 'msw';

export const handlers = [
	// OneBusAway API mocks
	http.get('/api/oba/search', ({ request }) => {
		const url = new URL(request.url);
		const query = url.searchParams.get('query');

		return HttpResponse.json({
			results: [
				{
					id: 'stop-123',
					name: `Test Stop for ${query}`,
					type: 'stop',
					coordinates: [47.6062, -122.3321],
					lat: 47.6062,
					lon: -122.3321
				},
				{
					id: 'route-456',
					name: `Test Route for ${query}`,
					type: 'route',
					shortName: '44',
					longName: `${query} Express`
				}
			]
		});
	}),

	http.get('/api/oba/arrivals-and-departures-for-stop/:id', ({ params }) => {
		const { id } = params;

		// Return empty arrivals for specific test case
		if (id === 'empty_stop') {
			return HttpResponse.json({
				data: {
					entry: {
						stopId: id,
						arrivalsAndDepartures: []
					},
					references: {
						routes: [],
						situations: []
					}
				}
			});
		}

		// Return error for specific test case
		if (id === 'error_stop') {
			return new HttpResponse(null, { status: 500 });
		}

		return HttpResponse.json({
			data: {
				entry: {
					stopId: id,
					arrivalsAndDepartures: [
						{
							routeId: '1_100479',
							routeShortName: '10',
							routeLongName: 'Capitol Hill - Downtown Seattle',
							tripId: '1_604138058',
							tripHeadsign: 'Capitol Hill',
							serviceDate: Date.now(),
							predicted: true,
							scheduleDeviation: 120,
							distanceFromStop: 0.5,
							numberOfStopsAway: 3,
							tripStatus: {
								activeTripId: '1_604138058',
								vehicleId: '1_4001',
								position: { lat: 47.6089, lon: -122.335 },
								orientation: 180.0,
								status: 'IN_TRANSIT_TO'
							},
							frequency: null,
							predictedArrivalTime: Date.now() + 300000,
							scheduledArrivalTime: Date.now() + 240000,
							predictedDepartureTime: Date.now() + 300000,
							scheduledDepartureTime: Date.now() + 240000,
							status: 'default',
							lastUpdateTime: Date.now() - 30000,
							blockTripSequence: 1,
							vehicleId: '1_4001'
						},
						{
							routeId: '1_100044',
							routeShortName: '11',
							routeLongName: 'Madison Park - Downtown Seattle',
							tripId: '1_604138059',
							tripHeadsign: 'Madison Park',
							serviceDate: Date.now(),
							predicted: false,
							scheduleDeviation: 0,
							distanceFromStop: 1.2,
							numberOfStopsAway: 7,
							tripStatus: null,
							frequency: null,
							predictedArrivalTime: null,
							scheduledArrivalTime: Date.now() + 840000,
							predictedDepartureTime: null,
							scheduledDepartureTime: Date.now() + 840000,
							status: 'default',
							lastUpdateTime: Date.now() - 60000,
							blockTripSequence: 1,
							vehicleId: null
						}
					]
				},
				references: {
					routes: [
						{
							id: '1_100479',
							nullSafeShortName: '10',
							shortName: '10',
							longName: 'Capitol Hill - Downtown Seattle',
							description: 'Connects Capitol Hill neighborhood with downtown Seattle',
							type: 3,
							url: '',
							color: '0066CC',
							textColor: 'FFFFFF'
						},
						{
							id: '1_100044',
							nullSafeShortName: '11',
							shortName: '11',
							longName: 'Madison Park - Downtown Seattle',
							description: 'Connects Madison Park with downtown Seattle',
							type: 3,
							url: '',
							color: '008080',
							textColor: 'FFFFFF'
						}
					],
					situations: [
						{
							id: 'alert_1',
							summary: 'Route 10 Detour',
							description: 'Route 10 is experiencing a detour due to construction on Pine Street.',
							severity: 'warning',
							reason: 'CONSTRUCTION',
							effect: 'DETOUR',
							cause: 'CONSTRUCTION',
							url: 'https://metro.kingcounty.gov/alerts/route-10-detour',
							activeWindows: [
								{
									from: Date.now() - 86400000,
									to: Date.now() + 604800000
								}
							],
							informedEntities: [
								{
									agencyId: '1',
									routeId: '1_100479',
									stopId: null,
									tripId: null
								}
							]
						}
					]
				}
			}
		});
	}),

	http.get('/api/oba/stop/:stopID', ({ params }) => {
		const { stopID } = params;

		// Return different data based on stop ID for testing
		if (stopID === '1_75404') {
			return HttpResponse.json({
				data: {
					entry: {
						id: stopID,
						name: 'Test Stop Without Routes',
						code: '75404',
						direction: 'S',
						lat: 47.61053848,
						lon: -122.33631134,
						routeIds: [],
						routes: []
					}
				}
			});
		}

		return HttpResponse.json({
			data: {
				entry: {
					id: stopID,
					name: 'Pine St & 3rd Ave',
					code: '75403',
					direction: 'N',
					lat: 47.61053848,
					lon: -122.33631134,
					routeIds: ['1_100479', '1_100044'],
					routes: [
						{
							id: '1_100479',
							shortName: '10',
							longName: 'Capitol Hill - Downtown Seattle'
						},
						{
							id: '1_100044',
							shortName: '11',
							longName: 'Madison Park - Downtown Seattle'
						}
					]
				}
			}
		});
	}),

	http.get('/api/oba/routes', () => {
		return HttpResponse.json({
			routes: [
				{
					id: 'route_44',
					shortName: '44',
					longName: 'Ballard - University District',
					description: 'Frequent service between Ballard and University District',
					type: 3,
					color: '0066CC',
					textColor: 'FFFFFF',
					agencyInfo: {
						id: '1',
						name: 'King County Metro'
					}
				},
				{
					id: 'route_8',
					shortName: '8',
					longName: 'Capitol Hill - South Lake Union',
					description: 'Connects Capitol Hill with South Lake Union',
					type: 3,
					color: '008080',
					textColor: 'FFFFFF',
					agencyInfo: {
						id: '1',
						name: 'King County Metro'
					}
				},
				{
					id: 'route_1_line',
					shortName: '1 Line',
					longName: 'Seattle - University of Washington',
					description: 'Light rail service from downtown Seattle to UW',
					type: 0,
					color: '0077C0',
					textColor: 'FFFFFF',
					agencyInfo: {
						id: '40',
						name: 'Sound Transit'
					}
				},
				{
					id: 'route_ferry_fauntleroy',
					shortName: '',
					longName: 'Fauntleroy - Vashon Island',
					description: 'Ferry service between Fauntleroy and Vashon Island',
					type: 4,
					color: '018571',
					textColor: 'FFFFFF',
					agencyInfo: {
						id: '95',
						name: 'Washington State Ferries'
					}
				}
			]
		});
	}),

	// Add route-specific endpoints
	http.get('/api/oba/stops-for-route/:routeId', ({ params }) => {
		const { routeId } = params;
		return HttpResponse.json({
			data: {
				entry: {
					routeId: routeId,
					stops: [
						{
							id: '1_75403',
							name: 'Pine St & 3rd Ave',
							code: '75403',
							direction: 'N',
							lat: 47.61053848,
							lon: -122.33631134
						},
						{
							id: '1_75392',
							name: 'Pine St & 4th Ave',
							code: '75392',
							direction: 'N',
							lat: 47.6109,
							lon: -122.3357
						},
						{
							id: '1_30521',
							name: '15th Ave NE & NE 40th St',
							code: '30521',
							direction: 'N',
							lat: 47.6556,
							lon: -122.3119
						}
					]
				}
			}
		});
	}),

	// Add error handling for routes API
	http.get('/api/oba/routes-error', () => {
		return HttpResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
	}),

	http.get('/api/oba/schedule-for-stop/:stopId', ({ params }) => {
		const { stopId } = params;
		return HttpResponse.json({
			data: {
				entry: {
					stopId: stopId,
					stopTimes: [
						{
							arrivalTime: '08:15',
							departureTime: '08:15',
							routeShortName: '44',
							tripHeadsign: 'University District'
						},
						{
							arrivalTime: '08:30',
							departureTime: '08:30',
							routeShortName: '44',
							tripHeadsign: 'University District'
						}
					]
				}
			}
		});
	}),

	http.get('/api/oba/trip-details/:tripId', ({ params }) => {
		const { tripId } = params;
		return HttpResponse.json({
			data: {
				entry: {
					tripId: tripId,
					routeId: 'route_44',
					routeShortName: '44',
					tripHeadsign: 'University District',
					schedule: {
						stopTimes: [
							{
								stopId: 'stop_1',
								stopName: 'Pine St & 3rd Ave',
								arrivalTime: '08:15',
								departureTime: '08:15'
							},
							{
								stopId: 'stop_2',
								stopName: 'Pine St & 5th Ave',
								arrivalTime: '08:17',
								departureTime: '08:17'
							}
						]
					}
				}
			}
		});
	}),

	http.get('/api/oba/surveys', () => {
		return HttpResponse.json({
			surveys: [
				{
					id: 'survey_1',
					title: 'Service Quality Survey',
					description: 'Help us improve your transit experience',
					questions: [
						{
							id: 'q1',
							text: 'How satisfied are you with the service?',
							type: 'rating',
							options: ['1', '2', '3', '4', '5']
						}
					]
				}
			]
		});
	}),

	http.post('/api/oba/surveys/submit-survey', () => {
		return HttpResponse.json({
			success: true,
			message: 'Survey submitted successfully'
		});
	}),

	http.get('/api/oba/alerts', () => {
		return HttpResponse.json({
			data: {
				list: [
					{
						id: 'alert_1',
						summary: 'Service Alert',
						description: 'Route 44 experiencing delays due to traffic',
						severity: 'warning',
						activeWindows: [
							{
								from: Date.now() - 3600000, // 1 hour ago
								to: Date.now() + 3600000 // 1 hour from now
							}
						]
					}
				]
			}
		});
	}),

	// OpenTripPlanner API mocks
	http.get('/api/otp/plan', ({ request }) => {
		const url = new URL(request.url);
		const from = url.searchParams.get('fromPlace');
		const to = url.searchParams.get('toPlace');

		// Mock error case for invalid locations
		if (from === '0,0' || to === '0,0') {
			return HttpResponse.json(
				{
					error: {
						code: 'NO_TRANSIT_CONNECTION',
						message: 'No transit connection found between the specified locations',
						details: 'Please check your start and end locations and try again'
					}
				},
				{ status: 400 }
			);
		}

		// Mock empty results for specific test case
		if (from?.includes('NoResults') || to?.includes('NoResults')) {
			return HttpResponse.json({
				plan: {
					date: Date.now(),
					itineraries: []
				}
			});
		}

		// Default successful response with realistic itineraries
		const baseTime = Date.now();
		return HttpResponse.json({
			plan: {
				date: baseTime,
				itineraries: [
					{
						duration: 1980, // 33 minutes
						startTime: baseTime + 300000, // 5 minutes from now
						endTime: baseTime + 2280000, // 38 minutes from now
						walkTime: 540, // 9 minutes
						transitTime: 1440, // 24 minutes
						waitingTime: 0,
						walkDistance: 720.5, // meters
						elevationLost: 0.0,
						elevationGained: 12.3,
						transfers: 0,
						fare: {
							fare: {
								regular: {
									cents: 275,
									currency: { symbol: '$', currency: 'USD', defaultFractionDigits: 2 }
								}
							}
						},
						legs: [
							{
								startTime: baseTime + 300000,
								endTime: baseTime + 570000, // 4.5 minutes
								mode: 'WALK',
								distance: 360.2,
								duration: 270, // 4.5 minutes in seconds
								from: {
									name: from?.split(',')[0] || 'Origin',
									lat: parseFloat(from?.split(',')[0]) || 47.6205,
									lon: parseFloat(from?.split(',')[1]) || -122.3212
								},
								to: {
									name: 'Pine St & Broadway',
									lat: 47.6139,
									lon: -122.321,
									stopId: '1_11050'
								},
								legGeometry: {
									points: 'encoded_polyline_points_here',
									length: 15
								},
								steps: [
									{
										distance: 150.5,
										relativeDirection: 'LEFT',
										streetName: 'Pine St',
										absoluteDirection: 'WEST'
									},
									{
										distance: 209.7,
										relativeDirection: 'RIGHT',
										streetName: 'Broadway',
										absoluteDirection: 'NORTH'
									}
								]
							},
							{
								startTime: baseTime + 570000,
								endTime: baseTime + 2010000, // 24 minutes
								mode: 'BUS',
								route: '10',
								routeShortName: '10',
								routeLongName: 'Capitol Hill - University District',
								agencyName: 'King County Metro',
								distance: 4200.8,
								duration: 1440, // 24 minutes in seconds
								from: {
									name: 'Pine St & Broadway',
									lat: 47.6139,
									lon: -122.321,
									stopId: '1_11050'
								},
								to: {
									name: '15th Ave NE & NE 40th St',
									lat: 47.6556,
									lon: -122.3119,
									stopId: '1_30521'
								},
								legGeometry: {
									points: 'encoded_polyline_points_here',
									length: 42
								},
								routeColor: '0066CC',
								routeTextColor: 'FFFFFF'
							},
							{
								startTime: baseTime + 2010000,
								endTime: baseTime + 2280000, // 4.5 minutes
								mode: 'WALK',
								distance: 360.3,
								duration: 270, // 4.5 minutes in seconds
								from: {
									name: '15th Ave NE & NE 40th St',
									lat: 47.6556,
									lon: -122.3119,
									stopId: '1_30521'
								},
								to: {
									name: to?.split(',')[0] || 'Destination',
									lat: parseFloat(to?.split(',')[0]) || 47.6587,
									lon: parseFloat(to?.split(',')[1]) || -122.3128
								},
								legGeometry: {
									points: 'encoded_polyline_points_here',
									length: 12
								},
								steps: [
									{
										distance: 180.1,
										relativeDirection: 'CONTINUE',
										streetName: '15th Ave NE',
										absoluteDirection: 'NORTH'
									},
									{
										distance: 180.2,
										relativeDirection: 'RIGHT',
										streetName: 'NE 45th St',
										absoluteDirection: 'EAST'
									}
								]
							}
						]
					},
					{
						duration: 2280, // 38 minutes
						startTime: baseTime + 600000, // 10 minutes from now
						endTime: baseTime + 2880000, // 48 minutes from now
						walkTime: 720, // 12 minutes
						transitTime: 1560, // 26 minutes
						waitingTime: 0,
						walkDistance: 960.8, // meters
						elevationLost: 2.1,
						elevationGained: 15.7,
						transfers: 1,
						fare: {
							fare: {
								regular: {
									cents: 275,
									currency: { symbol: '$', currency: 'USD', defaultFractionDigits: 2 }
								}
							}
						},
						legs: [
							{
								startTime: baseTime + 600000,
								endTime: baseTime + 900000, // 5 minutes
								mode: 'WALK',
								distance: 400.4,
								duration: 300, // 5 minutes in seconds
								from: {
									name: from?.split(',')[0] || 'Origin',
									lat: parseFloat(from?.split(',')[0]) || 47.6205,
									lon: parseFloat(from?.split(',')[1]) || -122.3212
								},
								to: {
									name: 'Broadway & E John St',
									lat: 47.619,
									lon: -122.3211,
									stopId: '1_11080'
								},
								legGeometry: {
									points: 'encoded_polyline_points_here',
									length: 18
								},
								steps: [
									{
										distance: 200.2,
										relativeDirection: 'LEFT',
										streetName: 'E John St',
										absoluteDirection: 'WEST'
									},
									{
										distance: 200.2,
										relativeDirection: 'RIGHT',
										streetName: 'Broadway',
										absoluteDirection: 'SOUTH'
									}
								]
							},
							{
								startTime: baseTime + 900000,
								endTime: baseTime + 1800000, // 15 minutes
								mode: 'BUS',
								route: '49',
								routeShortName: '49',
								routeLongName: 'Capitol Hill - University District',
								agencyName: 'King County Metro',
								distance: 2800.6,
								duration: 900, // 15 minutes in seconds
								from: {
									name: 'Broadway & E John St',
									lat: 47.619,
									lon: -122.3211,
									stopId: '1_11080'
								},
								to: {
									name: 'NE 45th St & 15th Ave NE',
									lat: 47.6598,
									lon: -122.3118,
									stopId: '1_30530'
								},
								legGeometry: {
									points: 'encoded_polyline_points_here',
									length: 35
								},
								routeColor: '008080',
								routeTextColor: 'FFFFFF'
							},
							{
								startTime: baseTime + 1800000,
								endTime: baseTime + 2460000, // 11 minutes
								mode: 'BUS',
								route: '271',
								routeShortName: '271',
								routeLongName: 'University District - Bellevue',
								agencyName: 'King County Metro',
								distance: 1400.3,
								duration: 660, // 11 minutes in seconds
								from: {
									name: 'NE 45th St & 15th Ave NE',
									lat: 47.6598,
									lon: -122.3118,
									stopId: '1_30530'
								},
								to: {
									name: 'NE 43rd St & University Way NE',
									lat: 47.6576,
									lon: -122.3138,
									stopId: '1_30540'
								},
								legGeometry: {
									points: 'encoded_polyline_points_here',
									length: 28
								},
								routeColor: 'FF6600',
								routeTextColor: 'FFFFFF'
							},
							{
								startTime: baseTime + 2460000,
								endTime: baseTime + 2880000, // 7 minutes
								mode: 'WALK',
								distance: 560.4,
								duration: 420, // 7 minutes in seconds
								from: {
									name: 'NE 43rd St & University Way NE',
									lat: 47.6576,
									lon: -122.3138,
									stopId: '1_30540'
								},
								to: {
									name: to?.split(',')[0] || 'Destination',
									lat: parseFloat(to?.split(',')[0]) || 47.6587,
									lon: parseFloat(to?.split(',')[1]) || -122.3128
								},
								legGeometry: {
									points: 'encoded_polyline_points_here',
									length: 22
								},
								steps: [
									{
										distance: 280.2,
										relativeDirection: 'CONTINUE',
										streetName: 'University Way NE',
										absoluteDirection: 'NORTH'
									},
									{
										distance: 280.2,
										relativeDirection: 'LEFT',
										streetName: 'NE 45th St',
										absoluteDirection: 'WEST'
									}
								]
							}
						]
					}
				]
			}
		});
	}),

	// Geocoding API mocks
	http.get('/api/oba/geocode-location', ({ request }) => {
		const url = new URL(request.url);
		const query = url.searchParams.get('query');

		// Mock error case
		if (query === 'InvalidLocation') {
			return HttpResponse.json(
				{
					error: 'Location not found'
				},
				{ status: 404 }
			);
		}

		// Default geocoding response
		const coords =
			query === 'Capitol Hill'
				? { lat: 47.6205, lng: -122.3212 }
				: query === 'University District'
					? { lat: 47.6587, lng: -122.3128 }
					: { lat: 47.6062, lng: -122.3321 }; // Default Seattle coordinates

		return HttpResponse.json({
			location: {
				geometry: {
					location: coords
				},
				formatted_address: `${query}, Seattle, WA, USA`,
				name: query
			},
			results: [
				{
					geometry: {
						location: coords
					},
					formatted_address: `${query}, Seattle, WA, USA`,
					name: query
				}
			]
		});
	}),

	http.get('/api/oba/place-suggestions', ({ request }) => {
		const url = new URL(request.url);
		const query = url.searchParams.get('query');

		// Mock empty results for specific test case
		if (query === 'NoResults') {
			return HttpResponse.json({
				suggestions: [],
				predictions: []
			});
		}

		// Mock error case
		if (query === 'ErrorCase') {
			return HttpResponse.json(
				{
					error: 'Place suggestions service unavailable'
				},
				{ status: 500 }
			);
		}

		// Default suggestions based on query
		const suggestions = [
			{
				description: `${query} - Test Location`,
				place_id: `place_${query.replace(/\s+/g, '_').toLowerCase()}`,
				structured_formatting: {
					main_text: query,
					secondary_text: 'Test Location, Seattle, WA, USA'
				},
				name: query,
				displayText: `${query}, Seattle, WA, USA`
			},
			{
				description: `${query} Station`,
				place_id: `place_${query.replace(/\s+/g, '_').toLowerCase()}_station`,
				structured_formatting: {
					main_text: `${query} Station`,
					secondary_text: 'Transit Station, Seattle, WA, USA'
				},
				name: `${query} Station`,
				displayText: `${query} Station, Seattle, WA, USA`
			},
			{
				description: `${query} Center`,
				place_id: `place_${query.replace(/\s+/g, '_').toLowerCase()}_center`,
				structured_formatting: {
					main_text: `${query} Center`,
					secondary_text: 'Shopping Center, Seattle, WA, USA'
				},
				name: `${query} Center`,
				displayText: `${query} Center, Seattle, WA, USA`
			}
		];

		return HttpResponse.json({
			suggestions,
			predictions: suggestions
		});
	})
];
