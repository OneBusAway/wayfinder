export function filterActiveAlerts(situations) {
	const now = Date.now();
	return situations.filter((situation) =>
		(situation.activeWindows ?? []).some((window) => {
			const from = normalizeBound(window.from) ?? 0;
			// If no end date provided, default to Infinity.
			const to = normalizeBound(window.to) ?? Infinity;
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

/**
 * Like normalizeTimestamp, but treats missing / zero as "no bound" (null) so
 * open-start windows don't render as Jan 1 1970.
 *
 * @param {number|null|undefined} time
 * @returns {number | null}
 */
function normalizeBound(time) {
	if (time == null || time === 0) return null;
	const ms = normalizeTimestamp(time);
	return ms || null;
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
 * window. Bounds are milliseconds, or null when open-ended / missing.
 *
 * @param {{ activeWindows?: Array<{ from?: number, to?: number }> } | null | undefined} alert
 * @returns {{ from: number | null, to: number | null } | null}
 */
export function activeWindowRange(alert) {
	const windows = alert?.activeWindows;
	if (!Array.isArray(windows) || windows.length === 0) return null;

	const now = Date.now();
	const normalized = windows.map((window) => ({
		from: normalizeBound(window.from),
		to: normalizeBound(window.to)
	}));

	const current = normalized.find((window) => {
		const start = window.from ?? 0;
		const end = window.to ?? Infinity;
		return now >= start && now <= end;
	});

	return current ?? normalized[0];
}

/**
 * Collapse GTFS / TPEG / camelCase enums to a lowercase alphanumeric token
 * so `CONSTRUCTION`, `construction`, and `environmentReason` share one lookup path.
 *
 * @param {string} value
 * @returns {string}
 */
function enumToken(value) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

/**
 * Title-case an unrecognized enum for display without hitting i18n
 * (`CONSTRUCTION` → `Construction`, `stopMoved` → `Stop Moved`).
 *
 * @param {string} value
 * @returns {string}
 */
function humanizeEnum(value) {
	return value
		.trim()
		.replace(/_/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

// GTFS Cause + TPEG/SIRI reason spellings → stable i18n suffix (cause_*).
const CAUSE_ALIASES = {
	// GTFS
	unknowncause: 'unknown',
	othercause: 'other',
	technicalproblem: 'technical',
	strike: 'strike',
	demonstration: 'demonstration',
	accident: 'accident',
	holiday: 'holiday',
	weather: 'weather',
	maintenance: 'maintenance',
	construction: 'construction',
	policeactivity: 'police',
	medicalemergency: 'medical',
	// TPEG / SDK typings
	equipmentreason: 'equipment',
	environmentreason: 'environment',
	personnelreason: 'personnel',
	miscellaneousreason: 'miscellaneous',
	securityalert: 'security'
};

// GTFS Effect + common consequence.condition spellings → effect_* i18n suffix.
const EFFECT_ALIASES = {
	// GTFS
	noservice: 'no_service',
	reducedservice: 'reduced_service',
	significantdelays: 'significant_delays',
	detour: 'detour',
	additionalservice: 'additional_service',
	modifiedservice: 'modified_service',
	othereffect: 'other',
	unknowneffect: 'unknown',
	stopmoved: 'stop_moved',
	noeffect: 'no_effect',
	accessibilityissue: 'accessibility',
	// SIRI-ish consequence conditions seen in the wild / older fixtures
	diversion: 'detour'
};

/**
 * Rider-facing label for an enum that may or may not be in our alias table.
 * Known values get a translation; unknown ones are humanized directly, so
 * svelte-i18n is never asked for a key that doesn't exist.
 *
 * @param {string | null | undefined} value
 * @param {Record<string, string>} aliases
 * @param {string} keyPrefix
 * @param {(key: string) => string} translate
 * @returns {string | null}
 */
function formatEnumLabel(value, aliases, keyPrefix, translate) {
	if (!value || typeof value !== 'string' || !value.trim()) return null;
	const suffix = aliases[enumToken(value)];
	if (suffix) return translate(`${keyPrefix}${suffix}`);
	return humanizeEnum(value);
}

/**
 * Rider-facing cause label, from GTFS `CONSTRUCTION`-style or TPEG
 * `environmentReason`-style values.
 *
 * @param {string | null | undefined} reason
 * @param {(key: string) => string} translate
 * @returns {string | null}
 */
export function formatCauseLabel(reason, translate) {
	return formatEnumLabel(reason, CAUSE_ALIASES, 'service_alerts.cause_', translate);
}

/**
 * Rider-facing effect label from `consequences[0].condition` (or a GTFS effect).
 * Empty / whitespace conditions return null so the UI can omit the row.
 *
 * @param {string | null | undefined} effect
 * @param {(key: string) => string} translate
 * @returns {string | null}
 */
export function formatEffectLabel(effect, translate) {
	return formatEnumLabel(effect, EFFECT_ALIASES, 'service_alerts.effect_', translate);
}

/**
 * Format a millisecond timestamp for alert date ranges.
 *
 * @param {number | null | undefined} ms
 * @param {string | undefined} timeZone
 * @returns {string | null}
 */
function formatAlertDate(ms, timeZone) {
	if (!Number.isFinite(ms)) return null;
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZone
	}).format(new Date(ms));
}

/**
 * Build the active-window label for list rows and the detail modal.
 * Open-start windows (from == null) take the "Until {date}" branch.
 *
 * @param {{ from: number | null, to: number | null } | null | undefined} range
 * @param {(key: string, opts?: { values?: Record<string, string> }) => string} translate
 * @param {string | undefined} timeZone
 * @returns {string | null}
 */
export function formatActiveWindowLabel(range, translate, timeZone) {
	if (!range) return null;
	const from = formatAlertDate(range.from, timeZone);
	const to = formatAlertDate(range.to, timeZone);
	if (from && to) {
		return translate('service_alerts.active_range', { values: { from, to } });
	}
	if (to) {
		return translate('service_alerts.active_until', { values: { date: to } });
	}
	if (from) {
		return translate('service_alerts.active_from', { values: { date: from } });
	}
	return null;
}
