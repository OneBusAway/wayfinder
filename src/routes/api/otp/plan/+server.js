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

	// Convert HH:mm (24-hour) time to h:mm AM/PM format if provided
	let time = url.searchParams.get('time');
	if (time && time.includes(':') && !time.includes(' ')) {
		// Input is in HH:mm format, convert to h:mm AM/PM
		const parts = time.split(':');
		if (parts.length === 2) {
			const hours = parseInt(parts[0], 10);
			const minutes = parseInt(parts[1], 10);
			// Validate hours (0-23) and minutes (0-59)
			if (
				!isNaN(hours) &&
				!isNaN(minutes) &&
				hours >= 0 &&
				hours <= 23 &&
				minutes >= 0 &&
				minutes <= 59
			) {
				const period = hours >= 12 ? 'PM' : 'AM';
				const displayHours = hours % 12 || 12;
				time = `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
			} else {
				time = null; // Invalid time, fall back to default
			}
		} else {
			time = null; // Invalid format, fall back to default
		}
	}
	time = time || defaultTime;

	// Convert YYYY-MM-DD date to MM-DD-YYYY format if provided
	let date = url.searchParams.get('date');
	if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
		// Input is in YYYY-MM-DD format, convert to MM-DD-YYYY
		const [year, month, day] = date.split('-');
		date = `${month}-${day}-${year}`;
	}
	date = date || defaultDate;

	const mode = url.searchParams.get('mode') || 'TRANSIT,WALK';
	const arriveBy = url.searchParams.get('arriveBy') || 'false';
	const maxWalkDistance = url.searchParams.get('maxWalkDistance') || '4828'; // ~3 miles in meters
	const wheelchair = url.searchParams.get('wheelchair') || 'false';
	const showIntermediateStops = url.searchParams.get('showIntermediateStops') || 'true';
	const transferPenalty = url.searchParams.get('transferPenalty') || '0';

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
		return json(data);
	} catch (err) {
		if (err.status) throw err;

		throw error(500, {
			message: 'Failed to fetch trip planning data',
			error: err.message
		});
	}
}
