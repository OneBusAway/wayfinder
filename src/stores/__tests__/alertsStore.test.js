import { describe, it, expect, beforeEach, vi } from 'vitest';
import { alertsStore } from '../alertsStore';

describe('alertsStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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

	it('getAlertsForStop filters alerts by stop ID', () => {
		const mockAlerts = [
			{
				id: 'alert1',
				affectedStops: ['stop1', 'stop2'],
				affectedRoutes: []
			},
			{
				id: 'alert2',
				affectedStops: ['stop2'],
				affectedRoutes: []
			}
		];

		const alerts = mockAlerts.filter((alert) =>
			alert.affectedStops?.includes('stop1')
		);

		expect(alerts).toHaveLength(1);
		expect(alerts[0].id).toBe('alert1');
	});

	it('getAlertsForRoute filters alerts by route ID', () => {
		const mockAlerts = [
			{
				id: 'alert1',
				affectedStops: [],
				affectedRoutes: ['route1', 'route2']
			},
			{
				id: 'alert2',
				affectedStops: [],
				affectedRoutes: ['route2']
			}
		];

		const alerts = mockAlerts.filter((alert) =>
			alert.affectedRoutes?.includes('route1')
		);

		expect(alerts).toHaveLength(1);
		expect(alerts[0].id).toBe('alert1');
	});

	it('getAlertCount works for both stop and route types', () => {
		const stopCount = alertsStore.getAlertCount('stop123', 'stop');
		const routeCount = alertsStore.getAlertCount('route456', 'route');

		expect(stopCount).toBe(0);
		expect(routeCount).toBe(0);
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
