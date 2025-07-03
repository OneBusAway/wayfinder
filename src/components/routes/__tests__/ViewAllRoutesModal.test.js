import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import ViewAllRoutesModal from '../ViewAllRoutesModal.svelte';
import { mockRoutesListData } from '../../../tests/fixtures/obaData.js';

// Mock ModalPane component
vi.mock('$components/navigation/ModalPane.svelte', () => ({
	default: vi.fn().mockImplementation(({ children, title, closePane }) => {
		return {
			$$: {
				fragment: {
					c: vi.fn(),
					m: vi.fn(),
					p: vi.fn(),
					d: vi.fn()
				}
			},
			title,
			closePane,
			children
		};
	})
}));

// Mock LoadingSpinner component
vi.mock('$components/LoadingSpinner.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: {
			fragment: {
				c: vi.fn(),
				m: vi.fn(),
				p: vi.fn(),
				d: vi.fn()
			}
		}
	}))
}));

// Mock RouteItem component
vi.mock('$components/RouteItem.svelte', () => ({
	default: vi.fn().mockImplementation(({ route, handleModalRouteClick }) => {
		return {
			$$: {
				fragment: {
					c: vi.fn(),
					m: vi.fn(),
					p: vi.fn(),
					d: vi.fn()
				}
			},
			route,
			handleModalRouteClick
		};
	})
}));

describe('ViewAllRoutesModal', () => {
	const mockHandleModalRouteClick = vi.fn();
	const mockClosePane = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset fetch mock
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('renders modal with loading state initially', async () => {
		// Mock successful API response
		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		// Should show loading spinner initially
		expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
	});

	test('fetches and displays routes successfully', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		// Wait for loading to complete
		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		// Should display routes
		expect(screen.getByDisplayValue('')).toBeInTheDocument(); // Search input
		expect(screen.getAllByTestId(/route-item/)).toHaveLength(mockRoutesListData.length);
	});

	test('handles API error gracefully', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		global.fetch.mockResolvedValueOnce({
			ok: false,
			json: async () => ({ error: 'Failed to fetch routes' })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		// Should handle error and not display routes
		expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch routes:', 'Failed to fetch routes');
		expect(screen.queryByTestId(/route-item/)).not.toBeInTheDocument();

		consoleSpy.mockRestore();
	});

	test('handles network error gracefully', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		global.fetch.mockRejectedValueOnce(new Error('Network error'));

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		expect(consoleSpy).toHaveBeenCalledWith('Error fetching routes:', expect.any(Error));
		consoleSpy.mockRestore();
	});

	test('filters routes by search query', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		// Wait for routes to load
		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		// Search for specific route
		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		await user.type(searchInput, '44');

		// Should filter routes
		await waitFor(() => {
			const routeItems = screen.getAllByTestId(/route-item/);
			expect(routeItems.length).toBeLessThan(mockRoutesListData.length);
		});
	});

	test('shows no results message when search has no matches', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		// Search for non-existent route
		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		await user.type(searchInput, 'nonexistentroute');

		// Should show no results message
		await waitFor(() => {
			expect(screen.getByText('search.no_routes_found')).toBeInTheDocument();
		});
	});

	test('searches by route short name', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		await user.type(searchInput, '44');

		// Should find route with short name '44'
		await waitFor(() => {
			const routeItems = screen.getAllByTestId(/route-item/);
			expect(routeItems.length).toBeGreaterThan(0);
		});
	});

	test('searches by route long name', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		await user.type(searchInput, 'Ballard');

		// Should find route with 'Ballard' in long name
		await waitFor(() => {
			const routeItems = screen.getAllByTestId(/route-item/);
			expect(routeItems.length).toBeGreaterThan(0);
		});
	});

	test('searches by agency name', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		await user.type(searchInput, 'Sound Transit');

		// Should find routes operated by Sound Transit
		await waitFor(() => {
			const routeItems = screen.getAllByTestId(/route-item/);
			expect(routeItems.length).toBeGreaterThan(0);
		});
	});

	test('search is case insensitive', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		await user.type(searchInput, 'BALLARD');

		// Should find route with 'Ballard' in long name (case insensitive)
		await waitFor(() => {
			const routeItems = screen.getAllByTestId(/route-item/);
			expect(routeItems.length).toBeGreaterThan(0);
		});
	});

	test('clears filter when search is empty', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('search.search_for_routes');

		// First, search for something
		await user.type(searchInput, '44');
		await waitFor(() => {
			const filteredItems = screen.getAllByTestId(/route-item/);
			expect(filteredItems.length).toBeLessThan(mockRoutesListData.length);
		});

		// Then clear the search
		await user.clear(searchInput);

		// Should show all routes again
		await waitFor(() => {
			const allItems = screen.getAllByTestId(/route-item/);
			expect(allItems).toHaveLength(mockRoutesListData.length);
		});
	});

	test('handles route selection correctly', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		// Click on a route
		const routeButtons = screen.getAllByRole('button', { name: /route/i });
		if (routeButtons.length > 0) {
			await user.click(routeButtons[0]);
			expect(mockHandleModalRouteClick).toHaveBeenCalledWith(mockRoutesListData[0]);
		}
	});

	test('displays modal title correctly', () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		// Should display localized title
		expect(screen.getByText('search.all_routes')).toBeInTheDocument();
	});

	test('shows search icon in input field', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		const { container } = render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		// Should have search icon
		const searchIcon = container.querySelector('svg');
		expect(searchIcon).toBeInTheDocument();
		expect(searchIcon).toHaveAttribute('viewBox', '0 0 20 20');
	});

	test('has proper input field styling and attributes', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		expect(searchInput).toHaveAttribute('type', 'text');
		expect(searchInput).toHaveClass(
			'w-full',
			'rounded-lg',
			'border',
			'border-gray-300',
			'p-2',
			'pl-10',
			'text-gray-700'
		);
	});

	test('is keyboard accessible', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		// Should be able to tab to search input
		await user.tab();
		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		expect(searchInput).toHaveFocus();

		// Should be able to tab to route items
		await user.tab();
		const routeButtons = screen.getAllByRole('button', { name: /route/i });
		if (routeButtons.length > 0) {
			expect(routeButtons[0]).toHaveFocus();
		}
	});

	test('handles modal close correctly', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		// Find close button (typically rendered by ModalPane)
		const closeButton = screen.getByRole('button', { name: /close/i });
		await user.click(closeButton);

		expect(mockClosePane).toHaveBeenCalledTimes(1);
	});

	test('displays different route types correctly', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		// Should display all different route types
		const routeItems = screen.getAllByTestId(/route-item/);
		expect(routeItems).toHaveLength(mockRoutesListData.length);
	});

	test('handles search input changes with debouncing', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('search.search_for_routes');

		// Type quickly
		await user.type(searchInput, 'Bus');

		// Should handle rapid input changes
		expect(searchInput).toHaveValue('Bus');
	});

	test('maintains search state when routes update', async () => {
		const user = userEvent.setup();

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: mockRoutesListData })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		await user.type(searchInput, '44');

		// Search value should be maintained
		expect(searchInput).toHaveValue('44');
	});

	test('filters by route description when no long name', async () => {
		const user = userEvent.setup();
		const routesWithDescription = mockRoutesListData.map((route) => ({
			...route,
			longName: null // Remove long name to test description fallback
		}));

		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ routes: routesWithDescription })
		});

		render(ViewAllRoutesModal, {
			props: {
				handleModalRouteClick: mockHandleModalRouteClick,
				closePane: mockClosePane
			}
		});

		await waitFor(() => {
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('search.search_for_routes');
		await user.type(searchInput, 'service');

		// Should find routes by description
		await waitFor(() => {
			const routeItems = screen.getAllByTestId(/route-item/);
			expect(routeItems.length).toBeGreaterThan(0);
		});
	});
});
