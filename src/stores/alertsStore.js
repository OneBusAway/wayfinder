import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { filterActiveAlerts } from '$components/service-alerts/serviceAlertsHelper';

function createAlertsStore() {
	let alerts = [];

	const { subscribe, set } = writable(alerts);

	async function fetchAlertsForStop(stopId) {
		if (!browser || !stopId) return [];

		try {
			const response = await fetch(`/api/oba/arrivals-and-departures-for-stop/${stopId}`);
			if (!response.ok) {
				return [];
			}

			const data = await response.json();
			const situations = data.data?.references?.situations || [];
			alerts = filterActiveAlerts(situations);
			set(alerts);
		} catch (error) {
			console.warn('[alertsStore] Error fetching alerts for stop:', error);
		}

		return alerts;
	}

	function getAlertsForStop(stopId) {
		if (!stopId || !Array.isArray(alerts)) return [];
		return alerts;
	}

	function getAlertsForRoute(routeId) {
		if (!routeId || !Array.isArray(alerts)) return [];
		return alerts.filter((alert) => {
			if (!alert.affectedEntity) return false;
			return alert.affectedEntity.some(
				(entity) => entity.routeId === routeId || entity.route?.id === routeId
			);
		});
	}

	function getAlertCount(entityId, type = 'stop') {
		if (type === 'stop') {
			return getAlertsForStop(entityId).length;
		} else if (type === 'route') {
			return getAlertsForRoute(entityId).length;
		}
		return 0;
	}

	return {
		subscribe,
		fetchAlertsForStop,
		getAlertsForStop,
		getAlertsForRoute,
		getAlertCount
	};
}

export const alertsStore = createAlertsStore();
