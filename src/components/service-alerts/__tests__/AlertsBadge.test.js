import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import AlertsBadge from '../AlertsBadge.svelte';
import * as alertsStoreModule from '$stores/alertsStore';

vi.mock('$stores/alertsStore', () => ({
	alertsStore: {
		subscribe: vi.fn(),
		fetchAlertsForStop: vi.fn(),
		getAlertCount: vi.fn()
	}
}));

describe('AlertsBadge', () => {
	const setupMocks = (alerts = [], count = 0) => {
		alertsStoreModule.alertsStore.subscribe.mockImplementation((callback) => {
			callback(alerts);
			return () => {};
		});
		alertsStoreModule.alertsStore.fetchAlertsForStop.mockResolvedValue(alerts);
		alertsStoreModule.alertsStore.getAlertCount.mockReturnValue(count);
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders nothing when alert count is 0', () => {
		setupMocks([], 0);

		const { container } = render(AlertsBadge, {
			props: { id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('[role="status"]')?.querySelector('[aria-label]');
		expect(badge).not.toBeInTheDocument();
	});

	it('renders badge with count when alerts exist', () => {
		setupMocks([{ id: 'alert1' }], 3);

		const { container } = render(AlertsBadge, {
			props: { id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('[aria-label]');
		expect(badge).toBeInTheDocument();
		expect(badge?.textContent).toContain('3');
		expect(badge).toHaveClass('bg-red-500');
	});

	it('shows 9+ when alert count exceeds 9', () => {
		setupMocks([{ id: 'alert1' }], 15);

		const { container } = render(AlertsBadge, {
			props: { id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('div');
		expect(badge?.textContent).toBe('9+');
	});

	it('calls fetchAlertsForStop when component mounts with stop type', () => {
		setupMocks([], 0);

		render(AlertsBadge, {
			props: { id: 'stop123', type: 'stop' }
		});

		expect(alertsStoreModule.alertsStore.fetchAlertsForStop).toHaveBeenCalledWith('stop123');
	});

	it('does not call fetchAlertsForStop for route type', () => {
		setupMocks([], 0);

		render(AlertsBadge, {
			props: { id: 'route456', type: 'route' }
		});

		expect(alertsStoreModule.alertsStore.fetchAlertsForStop).not.toHaveBeenCalled();
	});

	it('has correct aria-label for multiple alerts', () => {
		setupMocks([{ id: 'alert1' }], 2);

		const { container } = render(AlertsBadge, {
			props: { id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('[aria-label]');
		expect(badge).toHaveAttribute('aria-label', '2 alerts');
		expect(badge).toHaveAttribute('title', '2 active alerts');
	});

	it('has correct aria-label for single alert', () => {
		setupMocks([{ id: 'alert1' }], 1);

		const { container } = render(AlertsBadge, {
			props: { id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('[aria-label]');
		expect(badge).toHaveAttribute('aria-label', '1 alert');
		expect(badge).toHaveAttribute('title', '1 active alert');
	});
});
