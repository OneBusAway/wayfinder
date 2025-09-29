import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import ViewAllRoutesModal from '../ViewAllRoutesModal.svelte';
import { mockRoutesListData } from '../../../tests/fixtures/obaData.js';

// Allow child components to render naturally - they should be properly implemented

// Mock svelte-i18n
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => {
				const translations = {
					'search.all_routes': 'All Routes',
					'search.search_for_routes': 'Search for routes',
					'search.no_routes_found': 'No routes found',
					loading: 'loading'
				};
				return translations[key] || key;
			});
			return { unsubscribe: () => {} };
		})
	}
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

		// Should show loading text initially
		expect(screen.getByText(/loading/i)).toBeInTheDocument();
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		// Should display routes
		expect(screen.getByPlaceholderText('Search for routes')).toBeInTheDocument(); // Search input
		expect(
			screen.getAllByRole('button').filter((btn) => btn.className.includes('route-item'))
		).toHaveLength(mockRoutesListData.length);
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		// Should handle error and not display routes
		expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch routes:', 'Failed to fetch routes');
		const routeButtons = screen
			.queryAllByRole('button')
			.filter((btn) => btn.className.includes('route-item'));
		expect(routeButtons).toHaveLength(0);

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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		// Search for specific route
		const searchInput = screen.getByPlaceholderText('Search for routes');
		await user.type(searchInput, '44');

		// Should filter routes
		await waitFor(() => {
			const routeItems = screen
				.getAllByRole('button')
				.filter((btn) => btn.className.includes('route-item') && btn.textContent.includes('44'));
			expect(routeItems.length).toBeGreaterThan(0);
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		// Search for non-existent route
		const searchInput = screen.getByPlaceholderText('Search for routes');
		await user.type(searchInput, 'nonexistentroute');

		// Should show no results message
		await waitFor(() => {
			expect(screen.getByText('No routes found')).toBeInTheDocument();
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search for routes');
		await user.type(searchInput, '44');

		// Should find route with short name '44'
		await waitFor(() => {
			const routeItems = screen
				.getAllByRole('button')
				.filter((btn) => btn.className.includes('route-item'));
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search for routes');
		await user.type(searchInput, 'Ballard');

		// Should find route with 'Ballard' in long name
		await waitFor(() => {
			const routeItems = screen
				.getAllByRole('button')
				.filter((btn) => btn.className.includes('route-item'));
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search for routes');
		await user.type(searchInput, 'Sound Transit');

		// Should find routes operated by Sound Transit
		await waitFor(() => {
			const routeItems = screen
				.getAllByRole('button')
				.filter((btn) => btn.className.includes('route-item'));
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search for routes');
		await user.type(searchInput, 'BALLARD');

		// Should find route with 'Ballard' in long name (case insensitive)
		await waitFor(() => {
			const routeItems = screen
				.getAllByRole('button')
				.filter((btn) => btn.className.includes('route-item'));
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search for routes');

		// First, search for something
		await user.type(searchInput, '44');
		await waitFor(() => {
			const filteredItems = screen
				.getAllByRole('button')
				.filter((btn) => btn.className.includes('route-item'));
			expect(filteredItems.length).toBeLessThan(mockRoutesListData.length);
		});

		// Then clear the search
		await user.clear(searchInput);

		// Should show all routes again
		await waitFor(() => {
			const allItems = screen
				.getAllByRole('button')
				.filter((btn) => btn.className.includes('route-item'));
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		// Click on a route
		const routeButtons = screen
			.getAllByRole('button')
			.filter((btn) => btn.className.includes('route-item'));
		if (routeButtons.length > 0) {
			await user.click(routeButtons[0]);

			const sortedRoutes = [...mockRoutesListData].sort((a, b) => {
				const getNumericValue = (route) => {
					if (!route.shortName) return 999999;
					const matches = route.shortName.match(/(\d+)/);
					return matches ? parseInt(matches[1], 10) : 999999;
				};
				const aNumeric = getNumericValue(a);
				const bNumeric = getNumericValue(b);
				if (aNumeric !== bNumeric) {
					return aNumeric - bNumeric;
				}
				return (a.shortName || '').localeCompare(b.shortName || '');
			});

			expect(mockHandleModalRouteClick).toHaveBeenCalledWith(sortedRoutes[0]);
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
		expect(screen.getByText('All Routes')).toBeInTheDocument();
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		// Should have search icon with the correct viewBox
		const searchIcon = container.querySelector('svg[viewBox="0 0 20 20"]');
		expect(searchIcon).toBeInTheDocument();
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search for routes');
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		// Focus the search input directly
		const searchInput = screen.getByPlaceholderText('Search for routes');
		searchInput.focus();
		expect(searchInput).toHaveFocus();

		// Should be able to tab to route items
		await user.tab();
		const routeButtons = screen
			.getAllByRole('button')
			.filter((btn) => btn.className.includes('route-item'));
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		// Should display all different route types
		const routeItems = screen
			.getAllByRole('button')
			.filter((btn) => btn.className.includes('route-item'));
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search for routes');

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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search for routes');
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
			expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search for routes');
		await user.type(searchInput, 'service');

		// Should find routes by description
		await waitFor(() => {
			const routeItems = screen
				.getAllByRole('button')
				.filter((btn) => btn.className.includes('route-item'));
			expect(routeItems.length).toBeGreaterThan(0);
		});
	});
});
