import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { buildURL } from '$lib/urls.js';
import { getAgencyFilter, alertBelongsToAgency } from '$lib/agencyFilter.js';
import { isValidAlert } from '$lib/alerts.js';
import {
	getSidecarBaseURL,
	getSidecarRegionPath,
	sidecarShowsTestAlerts,
	warnSidecarNotConfigured
} from '$lib/sidecarConfig.js';

export async function GET() {
	const baseURL = getSidecarBaseURL();
	const regionPath = getSidecarRegionPath();
	const missing = [];
	if (!baseURL) missing.push('PRIVATE_SIDECAR_API_BASE_URL');
	if (!regionPath) missing.push('PRIVATE_SIDECAR_REGION_ID');
	if (missing.length > 0) {
		warnSidecarNotConfigured('alerts', missing);
		return new Response(null, { status: 204, headers: { 'Content-Type': 'application/json' } });
	}

	const showTestAlerts = sidecarShowsTestAlerts();

	try {
		const alertsURL = buildURL(
			baseURL,
			regionPath + 'alerts.pb',
			showTestAlerts ? { test: 1 } : {}
		);

		const response = await fetch(alertsURL);

		const buffer = await response.arrayBuffer();

		const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

		const agencyFilter = getAgencyFilter();
		let validAlert = null;
		for (const entity of feed.entity) {
			// If we're in test mode, show the alert to test the UI
			if (showTestAlerts) {
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
