import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AlertsBadge from '../AlertsBadge.svelte';
import * as alertsStoreModule from '$stores/alertsStore';

// Mock the alerts store
vi.mock('$stores/alertsStore', () => ({
	alertsStore: {
		subscribe: vi.fn(),
		fetchAlertsForStop: vi.fn(),
		getAlertCount: vi.fn()
	}
}));

describe('AlertsBadge', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders nothing when alert count is 0', () => {
		alertsStoreModule.alertsStore.subscribe.mockImplementation((callback) => {
			callback([]);
			return () => {};
		});
		alertsStoreModule.alertsStore.fetchAlertsForStop.mockResolvedValue([]);
		alertsStoreModule.alertsStore.getAlertCount.mockReturnValue(0);

		const { container } = render(AlertsBadge, {
			props: {
				id: 'stop123',
				type: 'stop'
			}
		});

		// Check that badge div doesn't exist
		const badges = container.querySelectorAll('div');
		expect(badges.length).toBe(0);
	});

	it('renders badge with count when alerts exist', () => {
		alertsStoreModule.alertsStore.subscribe.mockImplementation((callback) => {
			callback([{ id: 'alert1' }]);
			return () => {};
		});
		alertsStoreModule.alertsStore.fetchAlertsForStop.mockResolvedValue([{ id: 'alert1' }]);
		alertsStoreModule.alertsStore.getAlertCount.mockReturnValue(3);

		const { container } = render(AlertsBadge, {
			props: {
				id: 'stop123',
				type: 'stop'
			}
		});

		const badge = container.querySelector('div');
		expect(badge).toBeInTheDocument();
		expect(badge?.textContent).toBe('3');
		expect(badge).toHaveClass('bg-red-500');
	});

	it('shows 9+ when alert count exceeds 9', () => {
		alertsStoreModule.alertsStore.subscribe.mockImplementation((callback) => {
			callback([{ id: 'alert1' }]);
			return () => {};
		});
		alertsStoreModule.alertsStore.fetchAlertsForStop.mockResolvedValue([{ id: 'alert1' }]);
		alertsStoreModule.alertsStore.getAlertCount.mockReturnValue(15);

		const { container } = render(AlertsBadge, {
			props: {
				id: 'stop123',
				type: 'stop'
			}
		});

		const badge = container.querySelector('div');
		expect(badge?.textContent).toBe('9+');
	});

	it('calls fetchAlertsForStop when component mounts with stop type', () => {
		alertsStoreModule.alertsStore.subscribe.mockImplementation((callback) => {
			callback([]);
			return () => {};
		});
		alertsStoreModule.alertsStore.fetchAlertsForStop.mockResolvedValue([]);
		alertsStoreModule.alertsStore.getAlertCount.mockReturnValue(0);

		render(AlertsBadge, {
			props: {
				id: 'stop123',
				type: 'stop'
			}
		});

		expect(alertsStoreModule.alertsStore.fetchAlertsForStop).toHaveBeenCalledWith('stop123');
	});

	it('does not call fetchAlertsForStop for route type', () => {
		alertsStoreModule.alertsStore.subscribe.mockImplementation((callback) => {
			callback([]);
			return () => {};
		});
		alertsStoreModule.alertsStore.getAlertCount.mockReturnValue(0);

		render(AlertsBadge, {
			props: {
				id: 'route456',
				type: 'route'
			}
		});

		expect(alertsStoreModule.alertsStore.fetchAlertsForStop).not.toHaveBeenCalled();
	});

	it('has proper accessibility attributes', () => {
		alertsStoreModule.alertsStore.subscribe.mockImplementation((callback) => {
			callback([{ id: 'alert1' }]);
			return () => {};
		});
		alertsStoreModule.alertsStore.fetchAlertsForStop.mockResolvedValue([{ id: 'alert1' }]);
		alertsStoreModule.alertsStore.getAlertCount.mockReturnValue(2);

		const { container } = render(AlertsBadge, {
			props: {
				id: 'stop123',
				type: 'stop'
			}
		});

		const badge = container.querySelector('div');
		expect(badge).toHaveAttribute('aria-label', '2 alerts');
		expect(badge).toHaveAttribute('title', '2 active alerts');
	});

	it('has correct singular aria-label for single alert', () => {
		alertsStoreModule.alertsStore.subscribe.mockImplementation((callback) => {
			callback([{ id: 'alert1' }]);
			return () => {};
		});
		alertsStoreModule.alertsStore.fetchAlertsForStop.mockResolvedValue([{ id: 'alert1' }]);
		alertsStoreModule.alertsStore.getAlertCount.mockReturnValue(1);

		const { container } = render(AlertsBadge, {
			props: {
				id: 'stop123',
				type: 'stop'
			}
		});

		const badge = container.querySelector('div');
		expect(badge).toHaveAttribute('aria-label', '1 alert');
		expect(badge).toHaveAttribute('title', '1 active alert');
	});
});
