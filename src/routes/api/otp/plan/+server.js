import { error, json } from '@sveltejs/kit';
import { PUBLIC_OTP_SERVER_URL } from '$env/static/public';
import {
	buildGraphQLQueryBody,
	formatTimeForOTP,
	formatDateForOTP,
	mapGraphQLResponse,
	getOtpApiType,
	OTP_DEFAULTS
} from '$lib/otp';

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
 * @throws {HttpError} SvelteKit HttpError on non-2xx responses
 */
async function fetchGraphQL(params) {
	const graphqlUrl = `${PUBLIC_OTP_SERVER_URL}/otp/gtfs/v1`;

	const response = await fetch(graphqlUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(buildGraphQLQueryBody(params))
	});

	if (!response.ok) {
		throw error(response.status, `GraphQL API returned status ${response.status}`);
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

	const apiType = getOtpApiType();

	try {
		if (apiType === 'graphql') {
			return await fetchGraphQL(params);
		}
		// Default to REST when apiType is 'rest' or null (server unreachable at startup)
		return await fetchREST(params);
	} catch (err) {
		if (err.status) throw err;

		throw error(500, {
			message: 'Failed to fetch trip planning data',
			error: err.message
		});
	}
}
