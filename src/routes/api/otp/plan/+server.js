import { error, json } from '@sveltejs/kit';
import { PUBLIC_OTP_SERVER_URL } from '$env/static/public';
import { formatTimeForOTP, formatDateForOTP, OTP_DEFAULTS } from '$lib/otp';

export async function GET({ url }) {
	const fromPlace = url.searchParams.get('fromPlace');
	const toPlace = url.searchParams.get('toPlace');

	if (!fromPlace || !toPlace) {
		throw error(400, 'Missing required parameters: fromPlace and toPlace');
	}

	if (!PUBLIC_OTP_SERVER_URL) {
		throw error(503, 'Trip planning is not configured for this region');
	}

	// Get current time for defaults
	const now = new Date();
	const defaultTime = formatTimeForOTP(now);
	const defaultDate = formatDateForOTP(now);

	// Time and date arrive already formatted for OTP by the client
	// (h:mm AM/PM and MM-DD-YYYY respectively), so just pass them through.
	const time = url.searchParams.get('time') || defaultTime;
	const date = url.searchParams.get('date') || defaultDate;

	// Get remaining parameters with defaults
	const mode = url.searchParams.get('mode') || OTP_DEFAULTS.mode;
	const arriveBy = url.searchParams.get('arriveBy') || String(OTP_DEFAULTS.arriveBy);
	const maxWalkDistance =
		url.searchParams.get('maxWalkDistance') || String(OTP_DEFAULTS.maxWalkDistance);
	const wheelchair = url.searchParams.get('wheelchair') || String(OTP_DEFAULTS.wheelchair);
	const showIntermediateStops =
		url.searchParams.get('showIntermediateStops') || String(OTP_DEFAULTS.showIntermediateStops);
	const transferPenalty =
		url.searchParams.get('transferPenalty') || String(OTP_DEFAULTS.transferPenalty);

	const params = new URLSearchParams({
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
	});

	const otpUrl = `${PUBLIC_OTP_SERVER_URL}/routers/default/plan?${params}`;

	try {
		const response = await fetch(otpUrl, {
			headers: {
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			throw error(response.status, `OpenTripPlanner API returned status ${response.status}`);
		}

		const data = await response.json();
		// Include the OTP URL for debugging
		return json({ ...data, _otpUrl: otpUrl });
	} catch (err) {
		if (err.status) throw err;

		throw error(500, {
			message: 'Failed to fetch trip planning data',
			error: err.message
		});
	}
}
