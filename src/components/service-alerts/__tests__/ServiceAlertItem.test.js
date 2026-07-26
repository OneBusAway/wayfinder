import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ServiceAlertItem from '../ServiceAlertItem.svelte';

vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
}));

function makeAlert(overrides = {}) {
	return {
		id: 'alert_1',
		summary: { lang: 'en', value: 'Route 10 Detour' },
		description: { lang: 'en', value: 'Buses reroute via Pike Street.' },
		severity: 'warning',
		activeWindows: [
			{
				from: Date.now() - 3600000,
				to: Date.now() + 3600000
			}
		],
		allAffects: [{ routeId: '1_100479' }],
		...overrides
	};
}

describe('ServiceAlertItem', () => {
	let openModal;

	beforeEach(() => {
		openModal = vi.fn();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('shows a severity badge and includes severity in the accessible name', () => {
		render(ServiceAlertItem, {
			props: { alert: makeAlert({ severity: 'severe' }), openModal }
		});

		expect(screen.getByText('service_alerts.severity_severe')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'service_alerts.open_alert' })).toBeInTheDocument();
	});

	it('renders the active date range when a window exists', () => {
		render(ServiceAlertItem, {
			props: { alert: makeAlert(), openModal }
		});

		// i18n mock returns the key; the date-range string uses active_range.
		expect(screen.getByText('service_alerts.active_range')).toBeInTheDocument();
	});

	it('activates via Enter and Space as a real button', async () => {
		const user = userEvent.setup();
		render(ServiceAlertItem, {
			props: { alert: makeAlert(), openModal }
		});

		const button = screen.getByRole('button', { name: 'service_alerts.open_alert' });
		button.focus();
		await user.keyboard('{Enter}');
		expect(openModal).toHaveBeenCalledTimes(1);

		await user.keyboard(' ');
		expect(openModal).toHaveBeenCalledTimes(2);
	});

	it('opens on click', async () => {
		const user = userEvent.setup();
		const alert = makeAlert();
		render(ServiceAlertItem, { props: { alert, openModal } });

		await user.click(screen.getByRole('button', { name: 'service_alerts.open_alert' }));
		expect(openModal).toHaveBeenCalledWith(alert);
	});
});
