import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ServiceAlertItem from '../ServiceAlertItem.svelte';

vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
}));

// Local i18n mock that interpolates {values} so we can assert severity lands
// in the accessible name (the global vitest-setup mock returns the bare key).
vi.mock('svelte-i18n', () => {
	const translate = (key, options) => {
		let str = key;
		for (const [k, v] of Object.entries(options?.values ?? {})) {
			str = str.replace(`{${k}}`, String(v));
		}
		// Resolve nested severity_* lookups the component makes first.
		if (key.startsWith('service_alerts.severity_')) {
			return key.replace('service_alerts.severity_', '');
		}
		if (key === 'service_alerts.open_alert') {
			return `Open ${options?.values?.severity} service alert details: ${options?.values?.summary}`;
		}
		if (key === 'service_alerts.active_range') {
			return `${options?.values?.from} – ${options?.values?.to}`;
		}
		if (key === 'service_alerts.service_alert') return 'Service Alert';
		return str;
	};
	return {
		t: {
			subscribe: (fn) => {
				fn(translate);
				return () => {};
			}
		}
	};
});

function makeAlert(overrides = {}) {
	return {
		id: 'alert_1',
		summary: { lang: 'en', value: 'Route 10 Detour' },
		description: { lang: 'en', value: 'Buses reroute via Pike Street.' },
		severity: 'warning',
		reason: 'CONSTRUCTION',
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

		expect(screen.getByText('severe')).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: 'Open severe service alert details: Route 10 Detour'
			})
		).toBeInTheDocument();
	});

	it('renders the active date range when a window exists', () => {
		render(ServiceAlertItem, {
			props: { alert: makeAlert(), openModal }
		});

		expect(screen.getByText(/–/)).toBeInTheDocument();
	});

	it('activates via Enter and Space as a real button', async () => {
		const user = userEvent.setup();
		render(ServiceAlertItem, {
			props: { alert: makeAlert(), openModal }
		});

		const button = screen.getByRole('button', {
			name: /Open warning service alert details/
		});
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

		await user.click(screen.getByRole('button', { name: /Open warning service alert details/ }));
		expect(openModal).toHaveBeenCalledWith(alert);
	});
});
