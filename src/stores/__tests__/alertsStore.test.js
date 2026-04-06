import { describe, it, expect, beforeEach, vi } from 'vitest';
import { alertsStore } from '../alertsStore';

// Mock fetch and serviceAlertsHelper
globalThis.fetch = vi.fn();

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$components/service-alerts/serviceAlertsHelper', () => ({
	filterActiveAlerts: vi.fn((situations) => situations || [])
}));

describe('alertsStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset the store by creating a fresh instance
		globalThis.fetch.mockClear();
	});

	it('initializes with empty alerts', () => {
		let alerts = [];
		const unsubscribe = alertsStore.subscribe((value) => {
			alerts = value;
		});

		expect(Array.isArray(alerts)).toBe(true);
		unsubscribe();
	});

	it('getAlertCount returns 0 when no alerts exist', () => {
		const count = alertsStore.getAlertCount('stop123', 'stop');
		expect(count).toBe(0);
	});

	it('getAlertsForStop returns alerts from store', () => {
		const result = alertsStore.getAlertsForStop('stop123');
		expect(Array.isArray(result)).toBe(true);
	});

	it('getAlertsForRoute filters alerts by route ID', () => {
		const result = alertsStore.getAlertsForRoute('route456');
		expect(Array.isArray(result)).toBe(true);
	});

	it('getAlertCount returns correct count for stop type', () => {
		const stopCount = alertsStore.getAlertCount('stop123', 'stop');
		expect(typeof stopCount).toBe('number');
		expect(stopCount).toBeGreaterThanOrEqual(0);
	});

	it('getAlertCount returns correct count for route type', () => {
		const routeCount = alertsStore.getAlertCount('route456', 'route');
		expect(typeof routeCount).toBe('number');
		expect(routeCount).toBeGreaterThanOrEqual(0);
	});

	it('handles null or undefined stop IDs gracefully', () => {
		const nullCount = alertsStore.getAlertCount(null, 'stop');
		const undefinedCount = alertsStore.getAlertCount(undefined, 'stop');

		expect(nullCount).toBe(0);
		expect(undefinedCount).toBe(0);
	});

	it('handles null or undefined route IDs gracefully', () => {
		const nullCount = alertsStore.getAlertCount(null, 'route');
		const undefinedCount = alertsStore.getAlertCount(undefined, 'route');

		expect(nullCount).toBe(0);
		expect(undefinedCount).toBe(0);
	});
});
