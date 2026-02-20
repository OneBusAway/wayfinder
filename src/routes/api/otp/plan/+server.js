import { error, json } from '@sveltejs/kit';
import { PUBLIC_OTP_SERVER_URL } from '$env/static/public';
import {
	buildGraphQLQueryBody,
	formatTimeForOTP,
	formatDateForOTP,
	mapGraphQLResponse,
	OTP_DEFAULTS
} from '$lib/otp';

// Detected OTP API type: 'graphql' | 'rest' | null.
// Persists for the server process lifetime to skip auto-detection.
// - 'rest': cached permanently when GraphQL returns 404/405 during detection.
// - 'graphql': cached on first successful GraphQL call, but reset to null
//   if a subsequent GraphQL request fails (triggering re-detection next time).
// - null: transient GraphQL errors during detection do not cache, so the
//   next request retries detection.
let apiType = null;

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
	const graphqlUrl = `${PUBLIC_OTP_SERVER_URL}/otp/gtfs/v1`;

	const response = await fetch(graphqlUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(buildGraphQLQueryBody(params))
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

function buildParamsFromRequest(url) {
	const fromPlace = url.searchParams.get('fromPlace');
	const toPlace = url.searchParams.get('toPlace');
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

	return params;
}

export async function GET({ url }) {
	const params = buildParamsFromRequest(url);

	if (!params.fromPlace || !params.toPlace) {
		throw error(400, 'Missing required parameters: fromPlace and toPlace');
	}

	if (!PUBLIC_OTP_SERVER_URL) {
		throw error(503, 'Trip planning is not configured for this region');
	}

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
