import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import AlertsBadge from '../AlertsBadge.svelte';

describe('AlertsBadge', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders nothing when alerts array is empty', () => {
		const { container } = render(AlertsBadge, {
			props: { alerts: [], id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('[role="status"]')?.querySelector('[aria-label]');
		expect(badge).not.toBeInTheDocument();
	});

	it('renders badge with count for stops', () => {
		const alerts = [{ id: 'alert1' }, { id: 'alert2' }, { id: 'alert3' }];

		const { container } = render(AlertsBadge, {
			props: { alerts, id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('[aria-label]');
		expect(badge).toBeInTheDocument();
		expect(badge?.textContent).toContain('3');
		expect(badge).toHaveClass('bg-red-500');
	});

	it('shows 9+ when alert count exceeds 9', () => {
		const alerts = Array.from({ length: 15 }, (_, i) => ({ id: `alert${i}` }));

		const { container } = render(AlertsBadge, {
			props: { alerts, id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('div');
		expect(badge?.textContent).toBe('9+');
	});

	it('filters route alerts by routeId', () => {
		const alerts = [
			{
				id: 'alert1',
				affectedEntity: [{ routeId: 'route456' }]
			},
			{
				id: 'alert2',
				affectedEntity: [{ routeId: 'route789' }]
			}
		];

		const { container } = render(AlertsBadge, {
			props: { alerts, id: 'route456', type: 'route' }
		});

		const badge = container.querySelector('[aria-label]');
		expect(badge).toBeInTheDocument();
		expect(badge?.textContent).toContain('1');
	});

	it('handles missing affectedEntity gracefully', () => {
		const alerts = [
			{ id: 'alert1' },
			{ id: 'alert2', affectedEntity: null }
		];

		const { container } = render(AlertsBadge, {
			props: { alerts, id: 'route456', type: 'route' }
		});

		// Should render with 0 count since no matching routes
		const badge = container.querySelector('[role="status"]')?.querySelector('[aria-label]');
		expect(badge).not.toBeInTheDocument();
	});

	it('sets correct aria-label with singular alert', () => {
		const alerts = [{ id: 'alert1' }];

		const { container } = render(AlertsBadge, {
			props: { alerts, id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('[aria-label]');
		expect(badge?.getAttribute('aria-label')).toBe('1 alert');
	});

	it('sets correct aria-label with multiple alerts', () => {
		const alerts = [{ id: 'alert1' }, { id: 'alert2' }];

		const { container } = render(AlertsBadge, {
			props: { alerts, id: 'stop123', type: 'stop' }
		});

		const badge = container.querySelector('[aria-label]');
		expect(badge?.getAttribute('aria-label')).toBe('2 alerts');
	});
});
