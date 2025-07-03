/**
 * Test fixtures with realistic OneBusAway API response data
 */

export const mockStopData = {
	id: '1_75403',
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
};

export const mockStopDataWithoutRoutes = {
	id: '1_75404',
	name: 'Test Stop Without Routes',
	code: '75404',
	direction: 'S',
	lat: 47.61053848,
	lon: -122.33631134,
	routeIds: [],
	routes: []
};

export const mockRouteData = {
	id: '1_100479',
	shortName: '10',
	longName: 'Capitol Hill - Downtown Seattle',
	description: 'Connects Capitol Hill neighborhood with downtown Seattle',
	type: 3,
	url: '',
	color: '0066CC',
	textColor: 'FFFFFF',
	agencyInfo: {
		id: '1',
		name: 'King County Metro'
	}
};

export const mockRoutesListData = [
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
		type: 0, // Light rail
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
		type: 4, // Ferry
		color: '018571',
		textColor: 'FFFFFF',
		agencyInfo: {
			id: '95',
			name: 'Washington State Ferries'
		}
	},
	{
		id: 'route_sounder_north',
		shortName: 'N Line',
		longName: 'Seattle - Everett',
		description: 'Commuter rail service',
		type: 2, // Rail
		color: '8CC8A0',
		textColor: '000000',
		agencyInfo: {
			id: '40',
			name: 'Sound Transit'
		}
	}
];

export const mockStopsForRouteData = [
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
];

export const mockServiceAlertsData = [
	{
		id: 'alert_1',
		summary: 'Route 10 Detour',
		description:
			'Route 10 is experiencing a detour due to construction on Pine Street. Buses will use alternative routing via Pike Street.',
		severity: 'warning',
		reason: 'CONSTRUCTION',
		effect: 'DETOUR',
		cause: 'CONSTRUCTION',
		url: 'https://metro.kingcounty.gov/alerts/route-10-detour',
		activeWindows: [
			{
				from: Date.now() - 86400000, // 1 day ago
				to: Date.now() + 604800000 // 1 week from now
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
	},
	{
		id: 'alert_2',
		summary: 'Downtown Transit Tunnel Closed',
		description:
			'The Downtown Seattle Transit Tunnel is temporarily closed for maintenance. All bus routes are operating on surface streets.',
		severity: 'severe',
		reason: 'MAINTENANCE',
		effect: 'DETOUR',
		cause: 'MAINTENANCE',
		url: 'https://metro.kingcounty.gov/alerts/tunnel-closure',
		activeWindows: [
			{
				from: Date.now() - 3600000, // 1 hour ago
				to: Date.now() + 7200000 // 2 hours from now
			}
		],
		informedEntities: [
			{
				agencyId: '1',
				routeId: null,
				stopId: null,
				tripId: null
			}
		]
	}
];

export const mockArrivalsData = {
	stopId: '1_75403',
	arrivalsAndDepartures: [
		{
			routeId: '1_100479',
			routeShortName: '10',
			routeLongName: 'Capitol Hill - Downtown Seattle',
			tripId: '1_604138058',
			tripHeadsign: 'Capitol Hill',
			serviceDate: Date.now(),
			predicted: true,
			scheduleDeviation: 120, // 2 minutes late
			distanceFromStop: 0.5, // 0.5 miles away
			numberOfStopsAway: 3,
			tripStatus: {
				activeTripId: '1_604138058',
				vehicleId: '1_4001',
				position: {
					lat: 47.6089,
					lon: -122.335
				},
				orientation: 180.0,
				status: 'IN_TRANSIT_TO'
			},
			frequency: null,
			predictedArrivalTime: Date.now() + 300000, // 5 minutes from now
			scheduledArrivalTime: Date.now() + 240000, // 4 minutes from now
			predictedDepartureTime: Date.now() + 300000,
			scheduledDepartureTime: Date.now() + 240000,
			status: 'default',
			lastUpdateTime: Date.now() - 30000, // 30 seconds ago
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
			scheduledArrivalTime: Date.now() + 840000, // 14 minutes from now
			predictedDepartureTime: null,
			scheduledDepartureTime: Date.now() + 840000,
			status: 'default',
			lastUpdateTime: Date.now() - 60000, // 1 minute ago
			blockTripSequence: 1,
			vehicleId: null
		}
	]
};

export const mockArrivalsAndDeparturesResponse = {
	data: {
		entry: mockArrivalsData,
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
			situations: mockServiceAlertsData
		}
	}
};

export const mockEmptyArrivalsData = {
	stopId: '1_75403',
	arrivalsAndDepartures: []
};

export const mockEmptyArrivalsAndDeparturesResponse = {
	data: {
		entry: mockEmptyArrivalsData,
		references: {
			routes: [],
			situations: []
		}
	}
};

export const mockTripDetailsData = {
	tripId: '1_604138058',
	serviceDate: Date.now(),
	frequency: null,
	schedule: {
		timeZone: 'America/Los_Angeles',
		stopTimes: [
			{
				stopId: '1_75414',
				stopName: 'Pine St & 2nd Ave',
				arrivalTime: Date.now() - 120000, // 2 minutes ago
				departureTime: Date.now() - 120000,
				distanceAlongTrip: 0.0,
				historicalOccupancy: 'MANY_SEATS_AVAILABLE'
			},
			{
				stopId: '1_75403',
				stopName: 'Pine St & 3rd Ave',
				arrivalTime: Date.now() + 300000, // 5 minutes from now
				departureTime: Date.now() + 300000,
				distanceAlongTrip: 0.1,
				historicalOccupancy: 'MANY_SEATS_AVAILABLE'
			},
			{
				stopId: '1_75392',
				stopName: 'Pine St & 4th Ave',
				arrivalTime: Date.now() + 420000, // 7 minutes from now
				departureTime: Date.now() + 420000,
				distanceAlongTrip: 0.2,
				historicalOccupancy: 'FEW_SEATS_AVAILABLE'
			}
		]
	},
	status: {
		activeTripId: '1_604138058',
		vehicleId: '1_4001',
		position: {
			lat: 47.6089,
			lon: -122.335
		},
		orientation: 180.0,
		status: 'IN_TRANSIT_TO',
		lastLocationUpdateTime: Date.now() - 15000, // 15 seconds ago
		lastKnownLocation: {
			lat: 47.6089,
			lon: -122.335
		},
		lastKnownOrientation: 180.0,
		occupancyStatus: 'MANY_SEATS_AVAILABLE'
	}
};

export const mockSurveyData = {
	id: 'survey_transit_quality',
	title: 'Transit Service Quality Survey',
	description: 'Help us improve your public transportation experience',
	questions: [
		{
			id: 'overall_satisfaction',
			text: 'How would you rate your overall satisfaction with the transit service?',
			type: 'rating',
			required: true,
			options: [
				{ value: '1', label: 'Very Dissatisfied' },
				{ value: '2', label: 'Dissatisfied' },
				{ value: '3', label: 'Neutral' },
				{ value: '4', label: 'Satisfied' },
				{ value: '5', label: 'Very Satisfied' }
			]
		},
		{
			id: 'service_frequency',
			text: 'How do you feel about the frequency of service on your route?',
			type: 'multiple_choice',
			required: true,
			options: [
				{ value: 'too_frequent', label: 'Too frequent' },
				{ value: 'just_right', label: 'Just right' },
				{ value: 'not_frequent_enough', label: 'Not frequent enough' }
			]
		},
		{
			id: 'suggestions',
			text: 'What suggestions do you have for improving our service?',
			type: 'text',
			required: false,
			maxLength: 500
		}
	],
	metadata: {
		createdDate: Date.now() - 86400000, // 1 day ago
		expirationDate: Date.now() + 2592000000, // 30 days from now
		targetAudience: 'all_users'
	}
};

export const mockTripPlanData = {
	from: {
		name: 'Capitol Hill',
		lat: 47.6205,
		lon: -122.3212
	},
	to: {
		name: 'University District',
		lat: 47.6587,
		lon: -122.3128
	},
	plan: {
		date: Date.now(),
		itineraries: [
			{
				duration: 1980, // 33 minutes
				startTime: Date.now() + 300000, // 5 minutes from now
				endTime: Date.now() + 2280000, // 38 minutes from now
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
						startTime: Date.now() + 300000,
						endTime: Date.now() + 570000, // 4.5 minutes
						mode: 'WALK',
						distance: 360.2,
						duration: 270, // 4.5 minutes in seconds
						from: {
							name: 'Capitol Hill',
							lat: 47.6205,
							lon: -122.3212
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
						startTime: Date.now() + 570000,
						endTime: Date.now() + 2010000, // 24 minutes
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
						startTime: Date.now() + 2010000,
						endTime: Date.now() + 2280000, // 4.5 minutes
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
							name: 'University District',
							lat: 47.6587,
							lon: -122.3128
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
				startTime: Date.now() + 600000, // 10 minutes from now
				endTime: Date.now() + 2880000, // 48 minutes from now
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
						startTime: Date.now() + 600000,
						endTime: Date.now() + 900000, // 5 minutes
						mode: 'WALK',
						distance: 400.4,
						duration: 300, // 5 minutes in seconds
						from: {
							name: 'Capitol Hill',
							lat: 47.6205,
							lon: -122.3212
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
						startTime: Date.now() + 900000,
						endTime: Date.now() + 1800000, // 15 minutes
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
						startTime: Date.now() + 1800000,
						endTime: Date.now() + 2460000, // 11 minutes
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
						startTime: Date.now() + 2460000,
						endTime: Date.now() + 2880000, // 7 minutes
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
							name: 'University District',
							lat: 47.6587,
							lon: -122.3128
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
};

/**
 * Mock place suggestion data for autocomplete testing
 */
export const mockPlaceSuggestions = {
	predictions: [
		{
			description: 'Capitol Hill, Seattle, WA, USA',
			place_id: 'ChIJm2VpGR0VkFQRPdcXCFoJNZo',
			structured_formatting: {
				main_text: 'Capitol Hill',
				secondary_text: 'Seattle, WA, USA'
			},
			name: 'Capitol Hill',
			displayText: 'Capitol Hill, Seattle, WA, USA'
		},
		{
			description: 'University District, Seattle, WA, USA',
			place_id: 'ChIJOX3XzGYUkFQRn2hMcJmhHJ4',
			structured_formatting: {
				main_text: 'University District',
				secondary_text: 'Seattle, WA, USA'
			},
			name: 'University District',
			displayText: 'University District, Seattle, WA, USA'
		},
		{
			description: 'Pike Place Market, Seattle, WA, USA',
			place_id: 'ChIJJ6kJNO8UkFQRe7-NVV1FZ0Q',
			structured_formatting: {
				main_text: 'Pike Place Market',
				secondary_text: 'Seattle, WA, USA'
			},
			name: 'Pike Place Market',
			displayText: 'Pike Place Market, Seattle, WA, USA'
		}
	],
	suggestions: [
		{
			description: 'Capitol Hill, Seattle, WA, USA',
			place_id: 'ChIJm2VpGR0VkFQRPdcXCFoJNZo',
			structured_formatting: {
				main_text: 'Capitol Hill',
				secondary_text: 'Seattle, WA, USA'
			},
			name: 'Capitol Hill',
			displayText: 'Capitol Hill, Seattle, WA, USA'
		},
		{
			description: 'University District, Seattle, WA, USA',
			place_id: 'ChIJOX3XzGYUkFQRn2hMcJmhHJ4',
			structured_formatting: {
				main_text: 'University District',
				secondary_text: 'Seattle, WA, USA'
			},
			name: 'University District',
			displayText: 'University District, Seattle, WA, USA'
		},
		{
			description: 'Pike Place Market, Seattle, WA, USA',
			place_id: 'ChIJJ6kJNO8UkFQRe7-NVV1FZ0Q',
			structured_formatting: {
				main_text: 'Pike Place Market',
				secondary_text: 'Seattle, WA, USA'
			},
			name: 'Pike Place Market',
			displayText: 'Pike Place Market, Seattle, WA, USA'
		}
	]
};

/**
 * Mock geocode response data
 */
export const mockGeocodeData = {
	location: {
		geometry: {
			location: {
				lat: 47.6205,
				lng: -122.3212
			}
		},
		formatted_address: 'Capitol Hill, Seattle, WA, USA',
		name: 'Capitol Hill'
	},
	results: [
		{
			geometry: {
				location: {
					lat: 47.6205,
					lng: -122.3212
				}
			},
			formatted_address: 'Capitol Hill, Seattle, WA, USA',
			name: 'Capitol Hill'
		}
	]
};

/**
 * Mock error response for trip planning
 */
export const mockTripPlanError = {
	error: {
		code: 'NO_TRANSIT_CONNECTION',
		message: 'No transit connection found between the specified locations',
		details: 'Please check your start and end locations and try again'
	}
};

/**
 * Mock empty itineraries response
 */
export const mockEmptyItinerariesData = {
	plan: {
		date: Date.now(),
		itineraries: []
	}
};
