import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import FavoritesPanel from '$components/search/FavoritesPanel.svelte';
import * as favoritesStoreModule from '$stores/favoritesStore';

// Mock the favoritesStore
vi.mock('$stores/favoritesStore', () => ({
	favorites: {
		subscribe: vi.fn((callback) => {
			// Default: no favorites
			callback([]);
			return () => {};
		}),
		removeFavorite: vi.fn(),
		addFavorite: vi.fn(),
		toggleFavorite: vi.fn(),
		isFavorite: vi.fn(),
		clearAll: vi.fn()
	}
}));

// Mock global fetch
globalThis.fetch = vi.fn();

describe('FavoritesPanel.svelte', () => {
	let mockMapProvider;
	let mockHandleStopMarkerSelect;
	let mockHandleRouteSelected;

	beforeEach(() => {
		vi.clearAllMocks();

		mockMapProvider = {
			addMarker: vi.fn(),
			flyTo: vi.fn(),
			panTo: vi.fn(),
			setZoom: vi.fn()
		};

		mockHandleStopMarkerSelect = vi.fn();
		mockHandleRouteSelected = vi.fn();

		// Reset the store mock
		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback([]);
			return () => {};
		});
	});

	it('renders empty state when no favorites exist', () => {
		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		// Check for the i18n key since translations aren't loaded in tests
		const emptyState = screen.getByText('favorites.empty_state');
		expect(emptyState).toBeInTheDocument();
	});

	it('shows star emoji in empty state', () => {
		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		const star = screen.getByText('⭐');
		expect(star).toBeInTheDocument();
	});

	it('renders favorites list when favorites exist', () => {
		const testFavorites = [
			{ id: 'stop_1', type: 'stop', addedAt: Date.now() },
			{ id: 'route_5', type: 'route', addedAt: Date.now() }
		];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		// Check that favorites are rendered
		const stopText = screen.getByText('stop stop_1');
		const routeText = screen.getByText('route route_5');

		expect(stopText).toBeInTheDocument();
		expect(routeText).toBeInTheDocument();
	});

	it('displays stop and route type labels', () => {
		const testFavorites = [
			{ id: 'stop_1', type: 'stop', addedAt: Date.now() },
			{ id: 'route_5', type: 'route', addedAt: Date.now() }
		];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		const stopType = screen.getByText('stop', { selector: '.capitalize' });
		expect(stopType).toBeInTheDocument();
	});

	it('calls removeFavorite when remove button is clicked', async () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', addedAt: Date.now() }];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		const user = userEvent.setup();
		const removeButtons = screen.getAllByRole('button', { name: 'favorites.remove' });

		await user.click(removeButtons[0]);

		expect(favoritesStoreModule.favorites.removeFavorite).toHaveBeenCalledWith('stop_1', 'stop');
	});

	it('calls handleStopMarkerSelect when stop favorite is clicked', async () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', name: 'Main St', addedAt: Date.now() }];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		globalThis.fetch.mockResolvedValueOnce({
			json: async () => ({
				code: 200,
				data: {
					entry: {
						id: 'stop_1',
						name: 'Main St',
						lat: 47.6,
						lon: -122.3
					}
				}
			})
		});

		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		const user = userEvent.setup();
		const favoriteButtons = screen.getAllByRole('button');
		const favoriteButton = favoriteButtons[0]; // First button is the favorite action

		await user.click(favoriteButton);

		// Wait for mapProvider.addMarker to be called
		await waitFor(() => {
			expect(mockMapProvider.addMarker).toHaveBeenCalled();
		});

		// Verify all map methods were called in sequence
		expect(mockMapProvider.flyTo).toHaveBeenCalledWith(47.6, -122.3, 20);
		await waitFor(() => {
			expect(mockHandleStopMarkerSelect).toHaveBeenCalled();
		});
	});

	it('calls handleRouteSelected when route favorite is clicked', async () => {
		const testFavorites = [{ id: 'route_5', type: 'route', name: 'Route 5', addedAt: Date.now() }];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		globalThis.fetch.mockResolvedValueOnce({
			json: async () => ({
				route: {
					id: 'route_5',
					name: 'Route 5'
				}
			})
		});

		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		const user = userEvent.setup();
		const favoriteButtons = screen.getAllByRole('button');
		const favoriteButton = favoriteButtons[0]; // First button is the favorite action

		await user.click(favoriteButton);

		// Wait for handleRouteSelected to be called
		await waitFor(() => {
			expect(mockHandleRouteSelected).toHaveBeenCalled();
		});
	});

	it('has proper accessibility attributes', () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', addedAt: Date.now() }];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		const removeButton = screen.getByRole('button', { name: 'favorites.remove' });
		expect(removeButton).toHaveAttribute('aria-label', 'favorites.remove');
	});

	it('handles fetch errors gracefully', async () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', name: 'Main St', addedAt: Date.now() }];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		// Mock fetch to reject
		globalThis.fetch.mockRejectedValueOnce(new Error('Network error'));

		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		const user = userEvent.setup();
		const favoriteButtons = screen.getAllByRole('button');
		const favoriteButton = favoriteButtons[0]; // First button is the favorite action

		await user.click(favoriteButton);

		// Should gracefully handle error without crashing
		// (component should not call handlers on error)
		await waitFor(() => {
			expect(mockHandleStopMarkerSelect).not.toHaveBeenCalled();
		});
	});

	it('displays actual stop/route name when available', () => {
		const testFavorites = [
			{ id: 'stop_1', type: 'stop', name: 'W Olympic Pl & 3rd Ave W', addedAt: Date.now() },
			{ id: 'route_5', type: 'route', name: '5 - Downtown Express', addedAt: Date.now() }
		];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		// Check that actual names are displayed, not just IDs
		const stopName = screen.getByText('W Olympic Pl & 3rd Ave W');
		const routeName = screen.getByText('5 - Downtown Express');

		expect(stopName).toBeInTheDocument();
		expect(routeName).toBeInTheDocument();
	});

	it('displays multiple favorites in list', () => {
		const testFavorites = [
			{ id: 'stop_1', type: 'stop', name: 'Stop 1', addedAt: Date.now() },
			{ id: 'stop_2', type: 'stop', name: 'Stop 2', addedAt: Date.now() },
			{ id: 'route_5', type: 'route', name: 'Route 5', addedAt: Date.now() }
		];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		// Check that all items are displayed
		const stopItem1 = screen.getByText('Stop 1');
		const stopItem2 = screen.getByText('Stop 2');
		const routeItem = screen.getByText('Route 5');

		expect(stopItem1).toBeInTheDocument();
		expect(stopItem2).toBeInTheDocument();
		expect(routeItem).toBeInTheDocument();
	});

	it('renders list items with proper styling classes', () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', addedAt: Date.now() }];

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(testFavorites);
			return () => {};
		});

		const { container } = render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		const listContainer = container.querySelector('.divide-y');
		expect(listContainer).toBeInTheDocument();
		expect(listContainer).toHaveClass('dark:divide-gray-700');
	});

	it('unsubscribes from store on component destroy', () => {
		const unsubscribeMock = vi.fn();

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback([]);
			return unsubscribeMock;
		});

		const { unmount } = render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mockHandleStopMarkerSelect,
				handleRouteSelected: mockHandleRouteSelected,
				mapProvider: mockMapProvider
			}
		});

		unmount();

		expect(unsubscribeMock).toHaveBeenCalled();
	});
});
