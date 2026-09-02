import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { get } from 'svelte/store';
import ServiceAlerts from '../ServiceAlerts.svelte';
import { modalOpen } from '$src/stores/modalOpen';
import { mockServiceAlertsData } from '../../../tests/fixtures/obaData.js';

vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
}));

vi.mock('flowbite-svelte/Modal.svelte', () => ({
	default: vi.fn(() => ({ $$: { component: 'div' } }))
}));

const STOP_ID = '1_75403';
const ROUTE_IDS = ['1_100479', '1_100044'];

describe('ServiceAlerts', () => {
	beforeEach(() => {
		modalOpen.set(false);
	});

	afterEach(() => {
		vi.clearAllMocks();
		modalOpen.set(false);
	});

	it('orders relevant alerts first and shows group headings when both groups exist', () => {
		render(ServiceAlerts, {
			props: {
				serviceAlerts: mockServiceAlertsData,
				stopId: STOP_ID,
				routeIds: ROUTE_IDS
			}
		});

		expect(screen.getByText('service_alerts.affects_this_stop')).toBeInTheDocument();
		expect(screen.getByText('service_alerts.other_alerts')).toBeInTheDocument();

		const buttons = screen.getAllByRole('button', { name: 'service_alerts.open_alert' });
		// Severity-sorted within relevant: warning (route) then info (stop); then agency severe.
		expect(buttons).toHaveLength(3);
		expect(buttons[0]).toHaveTextContent('Route 10 Detour');
		expect(buttons[1]).toHaveTextContent('Stop temporarily relocated');
		expect(buttons[2]).toHaveTextContent('Downtown Transit Tunnel Closed');
	});

	it('omits group headings when every alert is relevant', () => {
		const onlyRelevant = mockServiceAlertsData.filter((a) => a.id !== 'alert_2');
		render(ServiceAlerts, {
			props: {
				serviceAlerts: onlyRelevant,
				stopId: STOP_ID,
				routeIds: ROUTE_IDS
			}
		});

		expect(screen.queryByText('service_alerts.affects_this_stop')).not.toBeInTheDocument();
		expect(screen.queryByText('service_alerts.other_alerts')).not.toBeInTheDocument();
	});

	it('paginates 3 alerts per page across the ordered list', async () => {
		const user = userEvent.setup();
		const extras = [
			{
				id: 'alert_4',
				summary: { lang: 'en', value: 'Extra agency notice' },
				description: { lang: 'en', value: 'More agency text' },
				severity: 'info',
				activeWindows: [{ from: Date.now() - 1000, to: Date.now() + 1000 }],
				allAffects: [{ agencyId: '1' }]
			}
		];

		render(ServiceAlerts, {
			props: {
				serviceAlerts: [...mockServiceAlertsData, ...extras],
				stopId: STOP_ID,
				routeIds: ROUTE_IDS
			}
		});

		expect(screen.getByText(/1 of 2/)).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'service_alerts.open_alert' })).toHaveLength(3);

		const pageRow = screen.getByText(/1 of 2/).parentElement;
		const paginationButtons = within(pageRow).getAllByRole('button');
		await user.click(paginationButtons[1]);

		expect(screen.getByText(/2 of 2/)).toBeInTheDocument();
		expect(screen.getByText('Extra agency notice')).toBeInTheDocument();
	});

	it('hides and shows the list without losing alerts', async () => {
		const user = userEvent.setup();
		render(ServiceAlerts, {
			props: {
				serviceAlerts: mockServiceAlertsData,
				stopId: STOP_ID,
				routeIds: ROUTE_IDS
			}
		});

		await user.click(screen.getByRole('button', { name: 'service_alerts.hide' }));
		expect(
			screen.queryByRole('button', { name: 'service_alerts.open_alert' })
		).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'service_alerts.show' }));
		expect(screen.getAllByRole('button', { name: 'service_alerts.open_alert' })).toHaveLength(3);
	});

	it('opens the detail modal when an alert is activated', async () => {
		const user = userEvent.setup();
		render(ServiceAlerts, {
			props: {
				serviceAlerts: mockServiceAlertsData,
				stopId: STOP_ID,
				routeIds: ROUTE_IDS
			}
		});

		await user.click(screen.getAllByRole('button', { name: 'service_alerts.open_alert' })[0]);
		expect(get(modalOpen)).toBe(true);
	});
});
