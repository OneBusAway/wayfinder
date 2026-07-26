export function filterActiveAlerts(situations) {
	const now = Date.now();
	return situations.filter((situation) =>
		(situation.activeWindows ?? []).some((window) => {
			const from = normalizeTimestamp(window.from) || 0;
			// If no end date provided, default to Infinity.
			const to = window.to ? normalizeTimestamp(window.to) : Infinity;
			return now >= from && now <= to;
		})
	);
}

/**
 * Normalizes a timestamp value.
 * If the difference between now and the timestamp is smaller when interpreted as milliseconds,
 * then it's assumed to be in milliseconds; otherwise, it's in seconds and converted to milliseconds.
 *
 * @param {number|null|undefined} time - The timestamp to normalize.
 * @returns {number} Normalized timestamp in milliseconds.
 */
export function normalizeTimestamp(time) {
	if (!time) return 0;
	const dtMilliseconds = new Date(time);
	const diffMilliseconds = Math.abs(Date.now() - dtMilliseconds.getTime());
	const dtSeconds = new Date(time * 1000);
	const diffSeconds = Math.abs(Date.now() - dtSeconds.getTime());
	return diffMilliseconds < diffSeconds ? time : time * 1000;
}

/** @typedef {'severe' | 'warning' | 'info'} NormalizedSeverity */

export const SEVERITY_RANK = /** @type {const} */ ({
	severe: 3,
	warning: 2,
	info: 1
});

const SEVERE_VALUES = new Set(['severe', 'verysevere']);
const WARNING_VALUES = new Set(['warning', 'normal']);
const INFO_VALUES = new Set(['info', 'slight', 'veryslight', 'noimpact']);

/**
 * Normalize the free-form OBA `severity` string into INFO / WARNING / SEVERE.
 * Covers both SIRI-style (`verySevere`, `normal`, `slight`) and GTFS-style
 * (`severe`, `warning`, `info`) vocabularies. Missing / unknown → `info`.
 *
 * @param {{ severity?: string } | null | undefined} alert
 * @returns {NormalizedSeverity}
 */
export function normalizeSeverity(alert) {
	const raw = alert?.severity;
	if (!raw || typeof raw !== 'string') return 'info';

	const key = raw.trim().toLowerCase();
	if (SEVERE_VALUES.has(key)) return 'severe';
	if (WARNING_VALUES.has(key)) return 'warning';
	if (INFO_VALUES.has(key)) return 'info';
	return 'info';
}

/**
 * True when any `allAffects` entry names this stop or one of its routes.
 *
 * @param {{ allAffects?: Array<{ stopId?: string, routeId?: string }> } | null | undefined} alert
 * @param {{ stopId?: string | null, routeIds?: string[] }} ctx
 * @returns {boolean}
 */
export function alertAffects(alert, { stopId = null, routeIds = [] } = {}) {
	const affects = alert?.allAffects;
	if (!Array.isArray(affects) || affects.length === 0) return false;

	const routeSet = new Set(routeIds ?? []);
	return affects.some((entry) => {
		if (stopId && entry.stopId && entry.stopId === stopId) return true;
		if (entry.routeId && routeSet.has(entry.routeId)) return true;
		return false;
	});
}

/**
 * Agency-wide when no allAffects entry names a stop, route, or trip
 * (agency-only entries, or an empty/missing list).
 *
 * @param {{ allAffects?: Array<{ stopId?: string, routeId?: string, tripId?: string }> } | null | undefined} alert
 * @returns {boolean}
 */
export function isAgencyWideAlert(alert) {
	const affects = alert?.allAffects;
	if (!Array.isArray(affects) || affects.length === 0) return true;

	return !affects.some((entry) => entry.stopId || entry.routeId || entry.tripId);
}

/**
 * Order alerts so those affecting this stop/its routes come first, then
 * agency-wide / other alerts. Within each group, sort by descending severity.
 * Returns a flat ordered array plus the count of relevant alerts so the UI
 * can place a group heading without re-filtering.
 *
 * @param {Array} alerts
 * @param {{ stopId?: string | null, routeIds?: string[] }} ctx
 * @returns {{ ordered: Array, relevantCount: number }}
 */
export function orderAlertsByRelevance(alerts, { stopId = null, routeIds = [] } = {}) {
	if (!Array.isArray(alerts) || alerts.length === 0) {
		return { ordered: [], relevantCount: 0 };
	}

	const relevant = [];
	const general = [];

	for (const alert of alerts) {
		if (alertAffects(alert, { stopId, routeIds })) {
			relevant.push(alert);
		} else {
			general.push(alert);
		}
	}

	const bySeverityDesc = (a, b) =>
		SEVERITY_RANK[normalizeSeverity(b)] - SEVERITY_RANK[normalizeSeverity(a)];

	relevant.sort(bySeverityDesc);
	general.sort(bySeverityDesc);

	return {
		ordered: [...relevant, ...general],
		relevantCount: relevant.length
	};
}

/**
 * Active date range for display: the window that contains now, else the first
 * window. Timestamps are returned in milliseconds.
 *
 * @param {{ activeWindows?: Array<{ from?: number, to?: number }> } | null | undefined} alert
 * @returns {{ from: number, to: number | null } | null}
 */
export function activeWindowRange(alert) {
	const windows = alert?.activeWindows;
	if (!Array.isArray(windows) || windows.length === 0) return null;

	const now = Date.now();
	const normalized = windows.map((window) => ({
		from: normalizeTimestamp(window.from) || 0,
		to: window.to ? normalizeTimestamp(window.to) : null
	}));

	const current = normalized.find((window) => {
		const end = window.to ?? Infinity;
		return now >= window.from && now <= end;
	});

	return current ?? normalized[0];
}
