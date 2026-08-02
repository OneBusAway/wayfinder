import {
	filterActiveAlerts,
	normalizeTimestamp,
	normalizeSeverity,
	SEVERITY_RANK,
	alertAffects,
	orderAlertsByRelevance,
	activeWindowRange,
	formatCauseLabel,
	formatEffectLabel,
	formatActiveWindowLabel
} from '$components/service-alerts/serviceAlertsHelper';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('filterActiveAlerts', () => {
	const fixedTime = new Date('2025-02-23T12:00:00Z').getTime();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(fixedTime);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns the situation when active window (in milliseconds) encloses current time', () => {
		const situations = [
			{
				activeWindows: [{ from: fixedTime - 1000, to: fixedTime + 1000 }]
			}
		];
		const result = filterActiveAlerts(situations);
		expect(result).toHaveLength(1);
	});

	it('returns the situation when active window (in seconds) encloses current time', () => {
		// Timestamps provided in seconds; they’ll be normalized to ms.
		const situations = [
			{
				activeWindows: [{ from: (fixedTime - 1000) / 1000, to: (fixedTime + 1000) / 1000 }]
			}
		];
		const result = filterActiveAlerts(situations);
		expect(result).toHaveLength(1);
	});

	it('excludes situations that have no activeWindows field', () => {
		const situations = [{}];
		const result = filterActiveAlerts(situations);
		expect(result).toHaveLength(0);
	});

	it('returns an empty array when current time is not within any active window', () => {
		const situations = [
			{
				activeWindows: [{ from: fixedTime + 1000, to: fixedTime + 2000 }]
			}
		];
		const result = filterActiveAlerts(situations);
		expect(result).toHaveLength(0);
	});

	it('returns the situation if one of multiple windows is active', () => {
		const situations = [
			{
				activeWindows: [
					{ from: fixedTime + 1000, to: fixedTime + 2000 }, // inactive window
					{ from: fixedTime - 5000, to: fixedTime + 5000 } // active window
				]
			}
		];
		const result = filterActiveAlerts(situations);
		expect(result).toHaveLength(1);
	});
});

describe('normalizeTimestamp', () => {
	const fixedTime = new Date('2025-02-23T12:00:00Z').getTime();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(fixedTime);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns the original timestamp if the value is in milliseconds', () => {
		const tsMilliseconds = fixedTime - 1000;
		const normalized = normalizeTimestamp(tsMilliseconds);
		expect(normalized).toBe(tsMilliseconds);
	});

	it('converts a timestamp in seconds to milliseconds', () => {
		const tsSeconds = (fixedTime - 1000) / 1000;
		const normalized = normalizeTimestamp(tsSeconds);
		expect(normalized).toBeCloseTo(tsSeconds * 1000);
	});

	it('returns 0 when given an undefined or falsy value (:', () => {
		expect(normalizeTimestamp(null)).toBe(0);
		expect(normalizeTimestamp(undefined)).toBe(0);
		expect(normalizeTimestamp(0)).toBe(0);
	});
});

describe('normalizeSeverity', () => {
	it.each([
		['severe', 'severe'],
		['SEVERE', 'severe'],
		['verySevere', 'severe'],
		['warning', 'warning'],
		['normal', 'warning'],
		['info', 'info'],
		['slight', 'info'],
		['verySlight', 'info'],
		['noImpact', 'info'],
		['unknown', 'info'],
		[undefined, 'info'],
		[null, 'info']
	])('maps %s → %s', (raw, expected) => {
		expect(normalizeSeverity(raw == null ? {} : { severity: raw })).toBe(expected);
		expect(normalizeSeverity(raw == null ? null : { severity: raw })).toBe(expected);
	});

	it('exposes SEVERITY_RANK with severe > warning > info', () => {
		expect(SEVERITY_RANK.severe).toBeGreaterThan(SEVERITY_RANK.warning);
		expect(SEVERITY_RANK.warning).toBeGreaterThan(SEVERITY_RANK.info);
	});
});

describe('alertAffects', () => {
	it('matches by stopId', () => {
		const alert = { allAffects: [{ stopId: '1_75403' }] };
		expect(alertAffects(alert, { stopId: '1_75403', routeIds: [] })).toBe(true);
		expect(alertAffects(alert, { stopId: '1_99999', routeIds: [] })).toBe(false);
	});

	it('matches by routeId', () => {
		const alert = { allAffects: [{ routeId: '1_100479' }] };
		expect(alertAffects(alert, { stopId: null, routeIds: ['1_100479', '1_100044'] })).toBe(true);
		expect(alertAffects(alert, { stopId: null, routeIds: ['1_100044'] })).toBe(false);
	});

	it('returns false for empty or missing allAffects', () => {
		expect(alertAffects({}, { stopId: '1_75403' })).toBe(false);
		expect(alertAffects({ allAffects: [] }, { stopId: '1_75403' })).toBe(false);
		expect(alertAffects(null, { stopId: '1_75403' })).toBe(false);
	});
});

describe('orderAlertsByRelevance', () => {
	const stopId = '1_75403';
	const routeIds = ['1_100479'];

	it('puts stop/route alerts before agency-wide ones and sorts by severity', () => {
		const agencySevere = {
			id: 'agency',
			severity: 'severe',
			allAffects: [{ agencyId: '1' }]
		};
		const routeInfo = {
			id: 'route',
			severity: 'info',
			allAffects: [{ routeId: '1_100479' }]
		};
		const stopWarning = {
			id: 'stop',
			severity: 'warning',
			allAffects: [{ stopId }]
		};

		const { ordered, relevantCount } = orderAlertsByRelevance(
			[agencySevere, routeInfo, stopWarning],
			{ stopId, routeIds }
		);

		expect(relevantCount).toBe(2);
		expect(ordered.map((a) => a.id)).toEqual(['stop', 'route', 'agency']);
	});

	it('returns an empty result for empty input', () => {
		expect(orderAlertsByRelevance([], { stopId, routeIds })).toEqual({
			ordered: [],
			relevantCount: 0
		});
	});

	it('keeps a single-group list without inventing a split', () => {
		const alerts = [
			{ id: 'a', severity: 'info', allAffects: [{ agencyId: '1' }] },
			{ id: 'b', severity: 'severe', allAffects: [{ agencyId: '1' }] }
		];
		const { ordered, relevantCount } = orderAlertsByRelevance(alerts, {
			stopId,
			routeIds
		});
		expect(relevantCount).toBe(0);
		expect(ordered.map((a) => a.id)).toEqual(['b', 'a']);
	});
});

describe('activeWindowRange', () => {
	const fixedTime = new Date('2025-02-23T12:00:00Z').getTime();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(fixedTime);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns null when there are no windows', () => {
		expect(activeWindowRange({})).toBeNull();
		expect(activeWindowRange({ activeWindows: [] })).toBeNull();
	});

	it('returns the window that contains now', () => {
		const range = activeWindowRange({
			activeWindows: [
				{ from: fixedTime + 1000, to: fixedTime + 2000 },
				{ from: fixedTime - 1000, to: fixedTime + 5000 }
			]
		});
		expect(range).toEqual({ from: fixedTime - 1000, to: fixedTime + 5000 });
	});

	it('falls back to the first window when none contain now', () => {
		const range = activeWindowRange({
			activeWindows: [{ from: fixedTime + 1000, to: fixedTime + 2000 }]
		});
		expect(range).toEqual({ from: fixedTime + 1000, to: fixedTime + 2000 });
	});

	it('treats a missing end as open-ended (to: null)', () => {
		const range = activeWindowRange({
			activeWindows: [{ from: fixedTime - 1000 }]
		});
		expect(range).toEqual({ from: fixedTime - 1000, to: null });
	});

	it('treats a missing start as open-ended (from: null), not epoch 0', () => {
		const range = activeWindowRange({
			activeWindows: [{ to: fixedTime + 5000 }]
		});
		expect(range).toEqual({ from: null, to: fixedTime + 5000 });
	});
});

describe('cause / effect labels', () => {
	const translate = (key) => `t:${key}`;

	it('resolves GTFS uppercase causes and TPEG reasons to the same i18n key', () => {
		expect(formatCauseLabel('CONSTRUCTION', translate)).toBe('t:service_alerts.cause_construction');
		expect(formatCauseLabel('MAINTENANCE', translate)).toBe('t:service_alerts.cause_maintenance');
		expect(formatCauseLabel('environmentReason', translate)).toBe(
			't:service_alerts.cause_environment'
		);
		expect(formatCauseLabel('equipmentReason', translate)).toBe('t:service_alerts.cause_equipment');
	});

	it('resolves GTFS effects and maps diversion onto detour', () => {
		expect(formatEffectLabel('DETOUR', translate)).toBe('t:service_alerts.effect_detour');
		expect(formatEffectLabel('STOP_MOVED', translate)).toBe('t:service_alerts.effect_stop_moved');
		expect(formatEffectLabel('diversion', translate)).toBe('t:service_alerts.effect_detour');
	});

	it('humanizes unknown enums instead of requesting a missing translation', () => {
		expect(formatCauseLabel('SOME_NEW_CAUSE', translate)).toBe('Some New Cause');
		expect(formatEffectLabel('stopMoved2', translate)).toBe('Stop Moved2');
	});

	it('returns null for blank values so the UI can omit the row', () => {
		expect(formatCauseLabel('', translate)).toBeNull();
		expect(formatCauseLabel(null, translate)).toBeNull();
		expect(formatEffectLabel('', translate)).toBeNull();
		expect(formatEffectLabel('   ', translate)).toBeNull();
	});
});

describe('formatActiveWindowLabel', () => {
	const fixedTime = new Date('2025-02-23T12:00:00Z').getTime();
	const translate = (key, opts) => {
		if (key === 'service_alerts.active_until') return `Until ${opts.values.date}`;
		if (key === 'service_alerts.active_from') return `From ${opts.values.date}`;
		if (key === 'service_alerts.active_range') {
			return `${opts.values.from} – ${opts.values.to}`;
		}
		return key;
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(fixedTime);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('uses the Until branch for open-start windows', () => {
		const label = formatActiveWindowLabel(
			{ from: null, to: fixedTime + 3600000 },
			translate,
			'UTC'
		);
		expect(label).toMatch(/^Until /);
	});
});
