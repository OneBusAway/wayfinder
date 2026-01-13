import { error, json } from '@sveltejs/kit';
import { PUBLIC_OTP_SERVER_URL } from '$env/static/public';

export async function GET({ url }) {
	const fromPlace = url.searchParams.get('fromPlace');
	const toPlace = url.searchParams.get('toPlace');

	if (!fromPlace || !toPlace) {
		throw error(400, 'Missing required parameters: fromPlace and toPlace');
	}

	if (!PUBLIC_OTP_SERVER_URL) {
		throw error(503, 'Trip planning is not configured for this region');
	}

	// Get optional parameters with defaults
	const now = new Date();
	// Format time as h:mm AM/PM (e.g., "9:10 PM")
	const defaultTime = now.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
	// Format date as MM-DD-YYYY (e.g., "01-12-2026")
	const defaultDate = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
	const time = url.searchParams.get('time') || defaultTime;
	const date = url.searchParams.get('date') || defaultDate;
	const mode = url.searchParams.get('mode') || 'TRANSIT,WALK';
	const arriveBy = url.searchParams.get('arriveBy') || 'false';
	const maxWalkDistance = url.searchParams.get('maxWalkDistance') || '4828'; // ~3 miles in meters
	const wheelchair = url.searchParams.get('wheelchair') || 'false';
	const showIntermediateStops = url.searchParams.get('showIntermediateStops') || 'true';

	const params = new URLSearchParams({
		fromPlace,
		toPlace,
		time,
		date,
		mode,
		arriveBy,
		maxWalkDistance,
		wheelchair,
		showIntermediateStops
	});

	const otpUrl = `${PUBLIC_OTP_SERVER_URL}/routers/default/plan?${params}`;
	console.log('OTP Request URL:', otpUrl);

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
		return json(data);
	} catch (err) {
		if (err.status) throw err;

		throw error(500, {
			message: 'Failed to fetch trip planning data',
			error: err.message
		});
	}
}
