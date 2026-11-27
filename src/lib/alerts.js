/* eslint-disable no-restricted-syntax */
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

export function isValidAlert(alert) {
	return isAgencyWideAlert(alert) && isStartDateWithin24Hours(alert) && isHighSeverity(alert);
}

export function isHighSeverity(alert) {
	if (!alert) {
		return false;
	}

	const level = getSeverityLevel(alert);
	return (
		level === GtfsRealtimeBindings.transit_realtime.Alert.SeverityLevel.SEVERE ||
		level === GtfsRealtimeBindings.transit_realtime.Alert.SeverityLevel.WARNING
	);
}

function getSeverityLevel(alert) {
	return alert.severityLevel;
}

export function isStartDateWithin24Hours(alert) {
	if (!alert || !Array.isArray(alert.activePeriod) || alert.activePeriod.length === 0) {
		return false;
	}
	const now = Date.now() / 1000;
	const cutoff = now - 24 * 60 * 60;
	return alert.activePeriod.some((period) => {
		const rawStart = period?.start;
		if (!rawStart) return false;
		const startDate =
			typeof rawStart?.toNumber === 'function' ? rawStart.toNumber() : Number(rawStart);
		return Number.isFinite(startDate) && startDate > 0 && startDate <= now && startDate >= cutoff;
	});
}

export function isAgencyWideAlert(alert) {
	return Boolean(alert?.informedEntity && alert.informedEntity.length > 0);
}
