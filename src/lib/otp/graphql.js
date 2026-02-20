import { error } from '@sveltejs/kit';

const GRAPHQL_QUERY = `
query planTrip(
  $origin: PlanLabeledLocationInput!,
  $destination: PlanLabeledLocationInput!,
  $dateTime: PlanDateTimeInput!,
  $modes: PlanModesInput,
  $wheelchair: Boolean
) {
  planConnection(
    origin: $origin,
    destination: $destination,
    dateTime: $dateTime,
    modes: $modes,
    preferences: { accessibility: { wheelchair: { enabled: $wheelchair } } }
  ) {
    edges {
      node {
        start
        end
        legs {
          mode
          duration
          distance
          headsign
          from {
            name
            lat
            lon
            departure { scheduledTime estimated { time } }
          }
          to {
            name
            lat
            lon
            arrival { scheduledTime estimated { time } }
          }
          route { shortName longName }
          legGeometry { points }
          steps { relativeDirection streetName distance absoluteDirection }
        }
      }
    }
  }
}`;

/**
 * Convert date ("MM-DD-YYYY") + time ("h:mm AM/PM") to OffsetDateTime
 * ("YYYY-MM-DDThh:mm:ss±HH:MM") as required by OTP 2.x GraphQL API.
 *
 * The timezone offset is derived from the server process's locale for the
 * target date, which handles DST transitions correctly. This works when the
 * server runs in the same timezone as the transit agency's service area.
 *
 * @param {string} date - Date in "MM-DD-YYYY" format
 * @param {string} time - Time in "h:mm AM/PM" format
 * @returns {string|null} OffsetDateTime string, or null if time format is invalid
 */
function convertToISO8601(date, time) {
	const [month, day, year] = date.split('-');

	const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
	if (!match) return null;

	let hours = parseInt(match[1], 10);
	const minutes = match[2];
	const period = match[3].toUpperCase();

	if (period === 'AM' && hours === 12) hours = 0;
	else if (period === 'PM' && hours !== 12) hours += 12;

	// Compute the UTC offset for this specific date/time in the server's timezone.
	// Using the target date (not "now") ensures DST is handled correctly.
	const localDate = new Date(
		parseInt(year),
		parseInt(month) - 1,
		parseInt(day),
		hours,
		parseInt(minutes)
	);
	const offsetMinutes = -localDate.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? '+' : '-';
	const absOffset = Math.abs(offsetMinutes);
	const offsetH = String(Math.floor(absOffset / 60)).padStart(2, '0');
	const offsetM = String(absOffset % 60).padStart(2, '0');

	return `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${minutes}:00${sign}${offsetH}:${offsetM}`;
}

/**
 * Convert comma-separated mode string (e.g. "TRANSIT,WALK") to GraphQL modes input.
 * When "TRANSIT" is present, expands to BUS, RAIL, FERRY, and TRAM.
 * SUBWAY is intentionally excluded from the "TRANSIT" umbrella but can be
 * specified individually (e.g., "SUBWAY,WALK") for servers that support it.
 * Individual transit modes can also be specified directly for finer control.
 *
 * @param {string} modeString - Comma-separated transport modes
 * @returns {{ direct: string[], transit?: { transit: Array<{mode: string}> } }}
 */
function convertModesToGraphQL(modeString) {
	const modes = modeString.split(',').map((m) => m.trim().toUpperCase());

	const hasTransit = modes.includes('TRANSIT');
	const hasWalk = modes.includes('WALK');
	const hasBicycle = modes.includes('BICYCLE');

	const direct = [];
	if (hasWalk) direct.push('WALK');
	if (hasBicycle) direct.push('BICYCLE');

	const result = { direct };

	if (hasTransit) {
		result.transit = {
			transit: [{ mode: 'BUS' }, { mode: 'RAIL' }, { mode: 'FERRY' }, { mode: 'TRAM' }]
		};
	} else {
		const transitModes = [];
		for (const mode of modes) {
			if (['BUS', 'RAIL', 'FERRY', 'TRAM', 'SUBWAY'].includes(mode)) {
				transitModes.push({ mode });
			}
		}
		if (transitModes.length > 0) {
			result.transit = { transit: transitModes };
		}
	}

	return result;
}

/**
 * Build GraphQL variables from the collected query parameters.
 *
 * @param {Object} params - Parameter object. Uses: fromPlace, toPlace, date,
 *   time, mode, arriveBy, wheelchair (all strings). Remaining REST-specific
 *   params (maxWalkDistance, showIntermediateStops, transferPenalty) are not
 *   mapped to the GraphQL schema and are ignored here.
 * @returns {Object} GraphQL variables matching the planTrip query signature
 * @throws {HttpError} 400 if coordinates or date/time format is invalid
 */
function buildGraphQLVariables(params) {
	const fromParts = params.fromPlace.split(',').map(Number);
	const toParts = params.toPlace.split(',').map(Number);

	if (fromParts.length !== 2 || fromParts.some(isNaN)) {
		throw error(
			400,
			`Invalid fromPlace coordinate format: "${params.fromPlace}". Expected "lat,lon".`
		);
	}
	if (toParts.length !== 2 || toParts.some(isNaN)) {
		throw error(400, `Invalid toPlace coordinate format: "${params.toPlace}". Expected "lat,lon".`);
	}

	const [fromLat, fromLon] = fromParts;
	const [toLat, toLon] = toParts;

	const isoDateTime = convertToISO8601(params.date, params.time);
	if (!isoDateTime) {
		throw error(
			400,
			`Invalid date/time format: date="${params.date}", time="${params.time}". Expected date as MM-DD-YYYY and time as h:mm AM/PM.`
		);
	}

	const dateTime = {};
	if (params.arriveBy === 'true') {
		dateTime.latestArrival = isoDateTime;
	} else {
		dateTime.earliestDeparture = isoDateTime;
	}

	return {
		origin: {
			location: { coordinate: { latitude: fromLat, longitude: fromLon } }
		},
		destination: {
			location: { coordinate: { latitude: toLat, longitude: toLon } }
		},
		dateTime,
		modes: convertModesToGraphQL(params.mode),
		wheelchair: params.wheelchair === 'true'
	};
}

export function buildGraphQLQueryBody(params) {
	const variables = buildGraphQLVariables(params);
	return { query: GRAPHQL_QUERY, variables };
}

/**
 * Map a GraphQL planConnection response to the REST-style plan shape
 * ({ plan: { itineraries: [...] } }) so downstream components can consume
 * either API version without changes.
 *
 * @param {Object} graphqlData - Raw JSON from the OTP GraphQL endpoint
 *   (may contain .data, .errors, or both)
 * @returns {{ plan: { itineraries: Array } } | { error: { id: string, msg: string } }}
 */
export function mapGraphQLResponse(graphqlData) {
	// GraphQL can return both data and errors for partial results;
	// only treat as an error when there is no usable data at all.
	if (graphqlData.errors && !graphqlData.data) {
		return {
			error: {
				id: 'GRAPHQL_ERROR',
				msg: graphqlData.errors[0]?.message || 'Unknown GraphQL error'
			}
		};
	}

	// Log partial errors — these might indicate deprecations, rate limits,
	// or incomplete results
	if (graphqlData.errors && graphqlData.data) {
		console.warn(
			'GraphQL returned partial errors alongside data:',
			graphqlData.errors.map((e) => e.message).join('; ')
		);
	}

	if (!graphqlData.data?.planConnection) {
		return {
			error: {
				id: 'GRAPHQL_ERROR',
				msg: 'Unexpected response structure from trip planning server'
			}
		};
	}

	const edges = graphqlData.data.planConnection.edges || [];

	const itineraries = edges.map(({ node }) => {
		const startTime = new Date(node.start).getTime();
		const endTime = new Date(node.end).getTime();
		const duration = (endTime - startTime) / 1000;

		const legs = node.legs.map((leg) => {
			const legDuration =
				typeof leg.duration === 'number' ? leg.duration : (leg.duration?.total ?? 0);

			const fromTime = leg.from?.departure?.estimated?.time || leg.from?.departure?.scheduledTime;
			const toTime = leg.to?.arrival?.estimated?.time || leg.to?.arrival?.scheduledTime;

			const mapped = {
				mode: leg.mode,
				duration: legDuration,
				distance: leg.distance,
				headsign: leg.headsign || null,
				from: {
					name: leg.from?.name,
					lat: leg.from?.lat,
					lon: leg.from?.lon
				},
				to: {
					name: leg.to?.name,
					lat: leg.to?.lat,
					lon: leg.to?.lon
				},
				legGeometry: leg.legGeometry || { points: '' },
				steps: leg.steps || []
			};

			if (fromTime) mapped.startTime = new Date(fromTime).getTime();
			if (toTime) mapped.endTime = new Date(toTime).getTime();
			if (leg.route) {
				mapped.routeShortName = leg.route.shortName;
				mapped.routeLongName = leg.route.longName;
			}

			return mapped;
		});

		return { startTime, endTime, duration, legs };
	});

	return { plan: { itineraries } };
}
