import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { env } from '$env/dynamic/private';
import { buildURL } from '$lib/urls.js';
import { getAgencyFilter, alertBelongsToAgency } from '$lib/agencyFilter.js';

const REGION_PATH = `regions/${env.PRIVATE_REGION_ID}/`;

export async function GET() {
	try {
		const alertsURL = buildURL(
			env.PRIVATE_OBACO_API_BASE_URL,
			REGION_PATH + 'alerts.pb',
			env.PRIVATE_OBACO_SHOW_TEST_ALERTS == 'true' ? { test: 1 } : {}
		);

		const response = await fetch(alertsURL);

		const buffer = await response.arrayBuffer();

		const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

		const agencyFilter = getAgencyFilter();
		let validAlert = null;
		for (const entity of feed.entity) {
			// If we're in test mode, show the alert to test the UI
			if (env.PRIVATE_OBACO_SHOW_TEST_ALERTS === 'true') {
				validAlert = entity.alert;
				break;
			}
			if (
				entity.alert &&
				isValidAlert(entity.alert) &&
				alertBelongsToAgency(entity.alert, agencyFilter)
			) {
				validAlert = entity.alert;
				break;
			}
		}

		if (validAlert) {
			return new Response(JSON.stringify(validAlert), {
				headers: { 'Content-Type': 'application/json' }
			});
		} else {
			return new Response(null, {
				status: 204,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	} catch (error) {
		console.error('Alerts endpoint failure:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to fetch or parse alerts',
				message: error instanceof Error ? error.message : String(error)
			}),
			{
				headers: { 'Content-Type': 'application/json' },
				status: 500
			}
		);
	}
}

function isValidAlert(alert) {
	return isAgencyWideAlert(alert) && isStartDateWithin24Hours(alert) && isHighSeverity(alert);
}

function isHighSeverity(alert) {
	if (!alert) {
		return false;
	}

	const isHighSeverity =
		(alert &&
			getSeverityLevel(alert) ===
				GtfsRealtimeBindings.transit_realtime.Alert.SeverityLevel.SEVERE) ||
		getSeverityLevel(alert) === GtfsRealtimeBindings.transit_realtime.Alert.SeverityLevel.WARNING;

	return isHighSeverity;
}

function getSeverityLevel(alert) {
	return alert.severityLevel;
}

function isStartDateWithin24Hours(alert) {
	const startDate = alert.activePeriod[0].start;
	const now = Date.now() / 1000;
	return startDate <= now && startDate >= now - 24 * 60 * 60;
}

function isAgencyWideAlert(alert) {
	return alert.informedEntity && alert.informedEntity.length > 0;
}
