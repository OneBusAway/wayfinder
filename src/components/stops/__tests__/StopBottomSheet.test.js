import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import StopBottomSheet from '../StopBottomSheet.svelte';
import {
	mockStopData,
	mockArrivalsAndDeparturesResponse
} from '../../../tests/fixtures/obaData.js';

// Mock svelte-i18n
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key);
			return { unsubscribe: () => {} };
		})
	},
	isLoading: {
		subscribe: vi.fn((fn) => {
			fn(false);
			return { unsubscribe: () => {} };
		})
	}
}));

global.fetch = vi.fn();

describe('StopBottomSheet', () => {
	const defaultProps = {
		stop: mockStopData,
		closePane: vi.fn(),
		handleUpdateRouteMap: vi.fn(),
		tripSelected: vi.fn()
	};

	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => mockArrivalsAndDeparturesResponse
		});
	});

	test('renders the condensed stop header with stop number and routes', async () => {
		render(StopBottomSheet, { props: defaultProps });

		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText('stop #75403 · 10, 11')).toBeInTheDocument();
		});
	});

	test('renders View Details and View Schedule links to the standalone stop pages', () => {
		render(StopBottomSheet, { props: defaultProps });

		expect(screen.getByRole('link', { name: 'stop_details.view_details' })).toHaveAttribute(
			'href',
			`/stops/${mockStopData.id}`
		);
		expect(screen.getByRole('link', { name: 'schedule_for_stop.view_schedule' })).toHaveAttribute(
			'href',
			`/stops/${mockStopData.id}/schedule`
		);
	});

	test('close button calls closePane', async () => {
		const user = userEvent.setup();
		render(StopBottomSheet, { props: defaultProps });

		await user.click(screen.getByRole('button', { name: 'sheet.close' }));

		expect(defaultProps.closePane).toHaveBeenCalledTimes(1);
	});

	test('Escape calls closePane', async () => {
		render(StopBottomSheet, { props: defaultProps });

		await fireEvent.keyDown(window, { code: 'Escape' });

		expect(defaultProps.closePane).toHaveBeenCalledTimes(1);
	});

	test('does not render the hero card inside the sheet', async () => {
		render(StopBottomSheet, { props: defaultProps });

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalled();
		});

		// The hero card renders the "routes: ..." line; the condensed header does not.
		expect(screen.queryByText(/^routes:/)).not.toBeInTheDocument();
	});

	test('renders arrivals from the fetched data', async () => {
		render(StopBottomSheet, { props: defaultProps });

		await waitFor(() => {
			expect(
				screen.getByText(
					`${mockArrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures[0].routeShortName} - ${mockArrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures[0].tripHeadsign}`
				)
			).toBeInTheDocument();
		});
	});
});
