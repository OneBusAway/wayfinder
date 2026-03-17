import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

export function isValidAlert(alert) {
	return isAgencyWideAlert(alert) && isStartDateWithin24Hours(alert) && isHighSeverity(alert);
}

export function isHighSeverity(alert) {
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

export function isStartDateWithin24Hours(alert) {
	if (!alert) return false;
	if (!alert.activePeriod || alert.activePeriod.length === 0) return false;
	const startDate = alert.activePeriod[0].start;
	if (!startDate) return false;
	const now = Date.now() / 1000;
	return startDate <= now && startDate >= now - 24 * 60 * 60;
}

export function isAgencyWideAlert(alert) {
	return alert.informedEntity && alert.informedEntity.length > 0;
}
