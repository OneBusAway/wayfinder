import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { buildGraphQLQueryBody, mapGraphQLResponse, getOtpApiType, OTP_DEFAULTS } from '$lib/otp';
import { formatTimeForOTP, formatDateForOTP, getLocalTimeZone } from '$lib/dateTimeFormat';

/** Cached region timezone — set once on first successful resolution. */
let regionTimeZone;

/**
 * Returns the IANA timezone for this transit region (e.g. "America/Los_Angeles").
 * Falls back to the server's local timezone when PUBLIC_OBA_TIMEZONE is not set.
 * Valid timezones and the "not set" default are cached for the lifetime of the
 * process. Invalid values are NOT cached, so fixing the env var takes effect
 * on the next request without a restart.
 */
function getRegionTimeZone() {
	if (regionTimeZone) return regionTimeZone;

	const tz = env.PUBLIC_OBA_TIMEZONE;
	if (tz) {
		try {
			new Intl.DateTimeFormat(undefined, { timeZone: tz });
			regionTimeZone = tz;
			return regionTimeZone;
		} catch (err) {
			if (!(err instanceof RangeError)) throw err;
			console.error(
				`Invalid PUBLIC_OBA_TIMEZONE: "${tz}". Must be a valid IANA timezone (e.g. "America/Los_Angeles"). Falling back to ${getLocalTimeZone()}.`
			);
			// Don't cache — let the operator fix the env var without a restart
			return getLocalTimeZone();
		}
	}
	regionTimeZone = getLocalTimeZone();
	return regionTimeZone;
}

/**
 * Fetch trip plan from OTP 1.x REST API.
 *
 * @throws {HttpError} SvelteKit HttpError on non-2xx responses
 */
async function fetchREST(params) {
	const searchParams = new URLSearchParams(params);
	const otpUrl = `${env.PUBLIC_OTP_SERVER_URL}/routers/default/plan?${searchParams}`;

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
 * @param {Object} params - OTP query parameters
 * @param {string} timeZone - IANA timezone for datetime conversion
 * @throws {HttpError} SvelteKit HttpError on non-2xx responses
 */
async function fetchGraphQL(params, timeZone) {
	const graphqlUrl = `${env.PUBLIC_OTP_SERVER_URL}/gtfs/v1`;

	const response = await fetch(graphqlUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(buildGraphQLQueryBody({ ...params, timeZone }))
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

	// Client sends time as "h:mm AM/PM" and date as "MM-DD-YYYY".
	// REST passes these through as-is; GraphQL converts via convertToISO8601().
	// Defaults use the transit region's timezone so they are correct even when
	// the server runs in UTC.
	const timeZone = getRegionTimeZone();
	const time = url.searchParams.get('time') || formatTimeForOTP(new Date(), timeZone);
	const date = url.searchParams.get('date') || formatDateForOTP(new Date(), timeZone);

	const mode = url.searchParams.get('mode') || OTP_DEFAULTS.mode;
	const arriveBy = url.searchParams.get('arriveBy') || String(OTP_DEFAULTS.arriveBy);
	const maxWalkDistance =
		url.searchParams.get('maxWalkDistance') || String(OTP_DEFAULTS.maxWalkDistance);
	const wheelchair = url.searchParams.get('wheelchair') || String(OTP_DEFAULTS.wheelchair);
	const showIntermediateStops =
		url.searchParams.get('showIntermediateStops') || String(OTP_DEFAULTS.showIntermediateStops);
	const transferPenalty =
		url.searchParams.get('transferPenalty') || String(OTP_DEFAULTS.transferPenalty);

	return {
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
}

export async function GET({ url }) {
	const params = buildParamsFromRequest(url);

	if (!params.fromPlace || !params.toPlace) {
		throw error(400, 'Missing required parameters: fromPlace and toPlace');
	}

	if (!env.PUBLIC_OTP_SERVER_URL) {
		throw error(503, 'Trip planning is not configured for this region');
	}

	const apiType = getOtpApiType();

	try {
		if (apiType === 'graphql') {
			return await fetchGraphQL(params, getRegionTimeZone());
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
