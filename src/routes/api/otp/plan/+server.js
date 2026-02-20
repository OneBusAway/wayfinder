import { error, json } from '@sveltejs/kit';
import { PUBLIC_OTP_SERVER_URL } from '$env/static/public';
import { formatTimeForOTP, formatDateForOTP, OTP_DEFAULTS } from '$lib/otp';

// Detected OTP API type: 'graphql' | 'rest' | null.
// Persists for the server process lifetime to skip auto-detection.
// - 'rest': cached permanently when GraphQL returns 404/405 during detection.
// - 'graphql': cached on first successful GraphQL call, but reset to null
//   if a subsequent GraphQL request fails (triggering re-detection next time).
// - null: transient GraphQL errors during detection do not cache, so the
//   next request retries detection.
let apiType = null;

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
          duration { total }
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
 * Convert date ("MM-DD-YYYY") + time ("h:mm AM/PM") to ISO 8601 ("YYYY-MM-DDThh:mm:00").
 * These formats match OTP convention: dates via formatDateForOTP(), times via
 * formatTimeForOTP() (server-side defaults) or parseTimeInput() (client-side
 * user input). See $lib/otp/dateTimeFormatters.js for format details.
 *
 * @param {string} date - Date in "MM-DD-YYYY" format (must be pre-validated)
 * @param {string} time - Time in "h:mm AM/PM" format
 * @returns {string|null} ISO 8601 string, or null if time format is invalid
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

	return `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${minutes}:00`;
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

/**
 * Map a GraphQL planConnection response to the REST-style plan shape
 * ({ plan: { itineraries: [...] } }) so downstream components can consume
 * either API version without changes.
 *
 * @param {Object} graphqlData - Raw JSON from the OTP GraphQL endpoint
 *   (may contain .data, .errors, or both)
 * @returns {{ plan: { itineraries: Array } } | { error: { id: string, msg: string } }}
 */
function mapGraphQLResponse(graphqlData) {
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

/**
 * Fetch trip plan from OTP 1.x REST API.
 *
 * @throws {HttpError} SvelteKit HttpError on non-2xx responses
 */
async function fetchREST(params) {
	const searchParams = new URLSearchParams(params);
	const otpUrl = `${PUBLIC_OTP_SERVER_URL}/routers/default/plan?${searchParams}`;

	const response = await fetch(otpUrl, {
		headers: { Accept: 'application/json' }
	});

	if (!response.ok) {
		throw error(response.status, `OpenTripPlanner API returned status ${response.status}`);
	}

	const data = await response.json();
	return json({ ...data, _otpUrl: otpUrl });
}

/**
 * Fetch trip plan from OTP 2.x GraphQL API.
 *
 * @throws {Error} Plain Error with .status set to the HTTP status code on
 *   non-2xx responses (plain Error used instead of SvelteKit's error() to
 *   enable status-code-based fallback logic in the caller).
 */
async function fetchGraphQL(params) {
	const variables = buildGraphQLVariables(params);
	const graphqlUrl = `${PUBLIC_OTP_SERVER_URL}/otp/gtfs/v1`;

	const response = await fetch(graphqlUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({ query: GRAPHQL_QUERY, variables })
	});

	if (!response.ok) {
		const err = new Error(`GraphQL API returned status ${response.status}`);
		err.status = response.status;
		throw err;
	}

	const data = await response.json();
	const mapped = mapGraphQLResponse(data);
	return json({ ...mapped, _otpUrl: graphqlUrl });
}

export async function GET({ url }) {
	const fromPlace = url.searchParams.get('fromPlace');
	const toPlace = url.searchParams.get('toPlace');

	if (!fromPlace || !toPlace) {
		throw error(400, 'Missing required parameters: fromPlace and toPlace');
	}

	if (!PUBLIC_OTP_SERVER_URL) {
		throw error(503, 'Trip planning is not configured for this region');
	}

	const now = new Date();
	const defaultTime = formatTimeForOTP(now);
	const defaultDate = formatDateForOTP(now);

	// Client sends time as "h:mm AM/PM" and date as "MM-DD-YYYY".
	// REST passes these through as-is; GraphQL converts via convertToISO8601().
	const time = url.searchParams.get('time') || defaultTime;
	const date = url.searchParams.get('date') || defaultDate;

	const mode = url.searchParams.get('mode') || OTP_DEFAULTS.mode;
	const arriveBy = url.searchParams.get('arriveBy') || String(OTP_DEFAULTS.arriveBy);
	const maxWalkDistance =
		url.searchParams.get('maxWalkDistance') || String(OTP_DEFAULTS.maxWalkDistance);
	const wheelchair = url.searchParams.get('wheelchair') || String(OTP_DEFAULTS.wheelchair);
	const showIntermediateStops =
		url.searchParams.get('showIntermediateStops') || String(OTP_DEFAULTS.showIntermediateStops);
	const transferPenalty =
		url.searchParams.get('transferPenalty') || String(OTP_DEFAULTS.transferPenalty);

	const params = {
		fromPlace,
		toPlace,
		time,
		date,
		mode,
		arriveBy,
		maxWalkDistance,
		wheelchair,
		showIntermediateStops,
		transferPenalty
	};

	try {
		// Cached as REST — go directly
		if (apiType === 'rest') {
			return await fetchREST(params);
		}

		// Cached as GraphQL — try it, but reset cache on endpoint failure.
		// Re-throw SvelteKit HttpErrors (from our own validation in
		// buildGraphQLVariables) so they don't silently degrade to REST.
		// SvelteKit HttpErrors have a .body property; plain fetch errors don't.
		if (apiType === 'graphql') {
			try {
				return await fetchGraphQL(params);
			} catch (cachedErr) {
				if (cachedErr.body) throw cachedErr;
				console.error('Cached GraphQL endpoint failed, resetting detection:', cachedErr);
				apiType = null;
				return await fetchREST(params);
			}
		}

		// Auto-detect: try GraphQL first.
		// Re-throw SvelteKit HttpErrors (validation errors); only fall back
		// to REST for network-level or endpoint-not-found failures.
		try {
			const result = await fetchGraphQL(params);
			apiType = 'graphql';
			return result;
		} catch (graphqlErr) {
			// Re-throw SvelteKit HttpErrors (from our validation, e.g. bad coordinates/time)
			if (graphqlErr.body) throw graphqlErr;

			if (graphqlErr.status === 404 || graphqlErr.status === 405) {
				// Server doesn't support GraphQL — cache and use REST
				apiType = 'rest';
				return await fetchREST(params);
			}

			// Transient server/network error — fall back to REST without caching
			console.warn(
				'GraphQL detection failed with transient error, falling back to REST:',
				graphqlErr
			);
			return await fetchREST(params);
		}
	} catch (err) {
		if (err.status) throw err;

		throw error(500, {
			message: 'Failed to fetch trip planning data',
			error: err.message
		});
	}
}
