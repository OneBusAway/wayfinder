import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import RouteModal from '../RouteModal.svelte';
import { mockRoutesListData, mockStopsForRouteData } from '../../../tests/fixtures/obaData.js';

// Mock ModalPane component
vi.mock('$components/navigation/ModalPane.svelte', () => ({
	default: vi.fn().mockImplementation(({ children, title, closePane }) => {
		const component = {
			title,
			closePane,
			children
		};
		return component;
	})
}));

// Mock StopItem component
vi.mock('$components/StopItem.svelte', () => ({
	default: vi.fn().mockImplementation(({ stop, handleStopItemClick }) => {
		const component = {
			stop,
			handleStopItemClick
		};
		return component;
	})
}));

describe('RouteModal', () => {
	const mockRoute = mockRoutesListData[0]; // Bus route 44
	const mockStops = mockStopsForRouteData;

	const mockMapProvider = {
		flyTo: vi.fn(),
		openStopMarker: vi.fn()
	};

	const mockClosePane = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('renders route modal with route information', () => {
		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should display route information
		expect(screen.getByText(`Route: ${mockRoute.shortName}`)).toBeInTheDocument();
		expect(screen.getByText(mockRoute.description)).toBeInTheDocument();
	});

	test('displays route title correctly with i18n', () => {
		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should display localized title (mocked to return the key)
		expect(screen.getByText('route_modal_title')).toBeInTheDocument();
	});

	test('renders all stops for the route', () => {
		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should render a StopItem for each stop
		expect(screen.getAllByTestId(/stop-item/)).toHaveLength(mockStops.length);
	});

	test('handles stop item click correctly', async () => {
		const user = userEvent.setup();

		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Find and click a stop item
		const stopButtons = screen.getAllByRole('button', { name: /stop/i });
		if (stopButtons.length > 0) {
			await user.click(stopButtons[0]);
		}

		// Should call map provider methods
		expect(mockMapProvider.flyTo).toHaveBeenCalledWith(mockStops[0].lat, mockStops[0].lon, 18);
		expect(mockMapProvider.openStopMarker).toHaveBeenCalledWith(mockStops[0]);
	});

	test('handles missing route gracefully', () => {
		render(RouteModal, {
			props: {
				selectedRoute: null,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should not crash and should not display route information
		expect(screen.queryByText(/Route:/)).not.toBeInTheDocument();
	});

	test('handles missing stops gracefully', () => {
		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: null,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should not crash and should not display stops
		expect(screen.queryByTestId(/stop-item/)).not.toBeInTheDocument();
	});

	test('handles empty stops array', () => {
		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: [],
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should display route info but no stops
		expect(screen.getByText(`Route: ${mockRoute.shortName}`)).toBeInTheDocument();
		expect(screen.queryByTestId(/stop-item/)).not.toBeInTheDocument();
	});

	test('displays route header with proper styling', () => {
		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		const routeHeader = screen.getByText(`Route: ${mockRoute.shortName}`);
		expect(routeHeader).toHaveClass('mb-6', 'text-center', 'text-2xl', 'font-bold', 'text-white');

		const routeDescription = screen.getByText(mockRoute.description);
		expect(routeDescription).toHaveClass('mb-6', 'text-center', 'text-xl', 'text-white');
	});

	test('has proper modal structure and classes', () => {
		const { container } = render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should have proper container structure
		const modalContent = container.querySelector('.space-y-4');
		expect(modalContent).toBeInTheDocument();

		const headerContainer = container.querySelector('.h-36.rounded-lg.bg-brand-secondary');
		expect(headerContainer).toBeInTheDocument();

		const stopsContainer = container.querySelector('.space-y-2.rounded-lg');
		expect(stopsContainer).toBeInTheDocument();
	});

	test('calls closePane when modal is closed', async () => {
		const user = userEvent.setup();

		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Find close button (typically rendered by ModalPane)
		const closeButton = screen.getByRole('button', { name: /close/i });
		await user.click(closeButton);

		expect(mockClosePane).toHaveBeenCalledTimes(1);
	});

	test('is keyboard accessible', async () => {
		const user = userEvent.setup();

		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should be able to navigate through stops with keyboard
		const stopButtons = screen.getAllByRole('button');

		if (stopButtons.length > 0) {
			// Focus first stop
			stopButtons[0].focus();
			expect(stopButtons[0]).toHaveFocus();

			// Should be able to activate with Enter
			await user.keyboard('{Enter}');
			expect(mockMapProvider.flyTo).toHaveBeenCalled();
		}
	});

	test('handles route with different types correctly', () => {
		const ferryRoute = mockRoutesListData[3]; // Ferry route

		render(RouteModal, {
			props: {
				selectedRoute: ferryRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should display ferry route information
		expect(screen.getByText(ferryRoute.description)).toBeInTheDocument();
	});

	test('handles route without description', () => {
		const routeWithoutDescription = {
			...mockRoute,
			description: null
		};

		render(RouteModal, {
			props: {
				selectedRoute: routeWithoutDescription,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should still render route name
		expect(screen.getByText(`Route: ${routeWithoutDescription.shortName}`)).toBeInTheDocument();
		// Description should not be rendered
		expect(screen.queryByText(mockRoute.description)).not.toBeInTheDocument();
	});

	test('provides proper ARIA labels for accessibility', () => {
		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Modal should have proper ARIA structure
		const modal = screen.getByRole('dialog');
		expect(modal).toBeInTheDocument();
		expect(modal).toHaveAttribute('aria-labelledby');
	});

	test('handles map provider errors gracefully', async () => {
		const user = userEvent.setup();
		const errorMapProvider = {
			flyTo: vi.fn().mockRejectedValue(new Error('Map error')),
			openStopMarker: vi.fn().mockRejectedValue(new Error('Marker error'))
		};

		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: errorMapProvider,
				closePane: mockClosePane
			}
		});

		const stopButtons = screen.getAllByRole('button', { name: /stop/i });
		if (stopButtons.length > 0) {
			// Should not crash when map provider throws errors
			await user.click(stopButtons[0]);
			expect(errorMapProvider.flyTo).toHaveBeenCalled();
		}
	});

	test('displays stops in correct order', () => {
		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		const stopElements = screen.getAllByTestId(/stop-item/);
		expect(stopElements).toHaveLength(mockStops.length);

		// Stops should be displayed in the same order as provided
		mockStops.forEach((stop, index) => {
			expect(stopElements[index]).toHaveTextContent(stop.name);
		});
	});

	test('handles very long route names and descriptions', () => {
		const routeWithLongNames = {
			...mockRoute,
			shortName: 'VeryLongRouteNameThatMightCauseLayoutIssues',
			description:
				'This is an extremely long route description that could potentially cause layout issues if not handled properly by the component and should wrap correctly'
		};

		render(RouteModal, {
			props: {
				selectedRoute: routeWithLongNames,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Should render without breaking layout
		expect(screen.getByText(/VeryLongRouteNameThatMightCauseLayoutIssues/)).toBeInTheDocument();
		expect(screen.getByText(/extremely long route description/)).toBeInTheDocument();
	});

	test('displays title function returns empty string for missing route', () => {
		render(RouteModal, {
			props: {
				selectedRoute: null,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Title should be empty when no route is selected
		expect(screen.queryByText('route_modal_title')).not.toBeInTheDocument();
	});

	test('integrates properly with stop item interactions', async () => {
		const user = userEvent.setup();

		render(RouteModal, {
			props: {
				selectedRoute: mockRoute,
				stops: mockStops,
				mapProvider: mockMapProvider,
				closePane: mockClosePane
			}
		});

		// Each stop should have its own interaction handler
		const stopButtons = screen.getAllByRole('button', { name: /stop/i });

		for (let i = 0; i < stopButtons.length && i < mockStops.length; i++) {
			await user.click(stopButtons[i]);

			expect(mockMapProvider.flyTo).toHaveBeenCalledWith(mockStops[i].lat, mockStops[i].lon, 18);
			expect(mockMapProvider.openStopMarker).toHaveBeenCalledWith(mockStops[i]);
		}
	});
});
