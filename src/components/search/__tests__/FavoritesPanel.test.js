import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FavoritesPanel from '$components/search/FavoritesPanel.svelte';
import * as favoritesStoreModule from '$stores/favoritesStore';

vi.mock('$stores/favoritesStore', () => ({
	favorites: {
		subscribe: vi.fn(),
		removeFavorite: vi.fn(),
		addFavorite: vi.fn(),
		toggleFavorite: vi.fn(),
		isFavorite: vi.fn(),
		clearAll: vi.fn()
	}
}));

globalThis.fetch = vi.fn();

describe('FavoritesPanel.svelte', () => {
	const createMocks = (favorites = []) => {
		const mapProvider = {
			addMarker: vi.fn(),
			flyTo: vi.fn(),
			panTo: vi.fn(),
			setZoom: vi.fn()
		};

		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback(favorites);
			return () => {};
		});

		return {
			mapProvider,
			handleStopMarkerSelect: vi.fn(),
			handleRouteSelected: vi.fn()
		};
	};

	const renderPanel = (mocks) => {
		return render(FavoritesPanel, {
			props: {
				handleStopMarkerSelect: mocks.handleStopMarkerSelect,
				handleRouteSelected: mocks.handleRouteSelected,
				mapProvider: mocks.mapProvider
			}
		});
	};

	beforeEach(() => {
		vi.clearAllMocks();
		favoritesStoreModule.favorites.subscribe.mockImplementation((callback) => {
			callback([]);
			return () => {};
		});
	});

	it('renders empty state when no favorites exist', () => {
		const mocks = createMocks();
		renderPanel(mocks);

		const emptyState = screen.getByText('favorites.empty_state');
		expect(emptyState).toBeInTheDocument();
	});

	it('shows star emoji in empty state', () => {
		const mocks = createMocks();
		renderPanel(mocks);

		const star = screen.getByText('⭐');
		expect(star).toBeInTheDocument();
	});

	it('renders favorites list when favorites exist', () => {
		const testFavorites = [
			{ id: 'stop_1', type: 'stop', addedAt: Date.now() },
			{ id: 'route_5', type: 'route', addedAt: Date.now() }
		];
		const mocks = createMocks(testFavorites);
		renderPanel(mocks);

		expect(screen.getByText('stop stop_1')).toBeInTheDocument();
		expect(screen.getByText('route route_5')).toBeInTheDocument();
	});

	it('displays stop and route type labels', () => {
		const testFavorites = [
			{ id: 'stop_1', type: 'stop', addedAt: Date.now() },
			{ id: 'route_5', type: 'route', addedAt: Date.now() }
		];
		const mocks = createMocks(testFavorites);
		renderPanel(mocks);

		const stopType = screen.getByText('stop', { selector: '.capitalize' });
		expect(stopType).toBeInTheDocument();
	});

	it('calls removeFavorite when remove button is clicked', async () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', addedAt: Date.now() }];
		const mocks = createMocks(testFavorites);
		const user = userEvent.setup();
		renderPanel(mocks);

		const removeButtons = screen.getAllByRole('button', { name: 'favorites.remove' });
		await user.click(removeButtons[0]);

		expect(favoritesStoreModule.favorites.removeFavorite).toHaveBeenCalledWith('stop_1', 'stop');
	});

	it('calls handleStopMarkerSelect when stop favorite is clicked', async () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', name: 'Main St', addedAt: Date.now() }];
		const mocks = createMocks(testFavorites);
		const user = userEvent.setup();

		globalThis.fetch.mockResolvedValueOnce({
			json: async () => ({
				code: 200,
				data: { entry: { id: 'stop_1', name: 'Main St', lat: 47.6, lon: -122.3 } }
			})
		});

		renderPanel(mocks);
		const favoriteButtons = screen.getAllByRole('button');
		await user.click(favoriteButtons[0]);

		await waitFor(() => {
			expect(mocks.mapProvider.addMarker).toHaveBeenCalled();
		});

		expect(mocks.mapProvider.flyTo).toHaveBeenCalledWith(47.6, -122.3, 20);
		await waitFor(() => {
			expect(mocks.handleStopMarkerSelect).toHaveBeenCalled();
		});
	});

	it('calls handleRouteSelected when route favorite is clicked', async () => {
		const testFavorites = [{ id: 'route_5', type: 'route', name: 'Route 5', addedAt: Date.now() }];
		const mocks = createMocks(testFavorites);
		const user = userEvent.setup();

		globalThis.fetch.mockResolvedValueOnce({
			json: async () => ({ route: { id: 'route_5', name: 'Route 5' } })
		});

		renderPanel(mocks);
		const favoriteButtons = screen.getAllByRole('button');
		await user.click(favoriteButtons[0]);

		await waitFor(() => {
			expect(mocks.handleRouteSelected).toHaveBeenCalled();
		});
	});

	it('has proper accessibility attributes', () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', addedAt: Date.now() }];
		const mocks = createMocks(testFavorites);
		renderPanel(mocks);

		const removeButton = screen.getByRole('button', { name: 'favorites.remove' });
		expect(removeButton).toHaveAttribute('aria-label', 'favorites.remove');
	});

	it('handles fetch errors gracefully', async () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', name: 'Main St', addedAt: Date.now() }];
		const mocks = createMocks(testFavorites);
		const user = userEvent.setup();

		globalThis.fetch.mockRejectedValueOnce(new Error('Network error'));
		renderPanel(mocks);

		const favoriteButtons = screen.getAllByRole('button');
		await user.click(favoriteButtons[0]);

		await waitFor(() => {
			expect(mocks.handleStopMarkerSelect).not.toHaveBeenCalled();
		});
	});

	it('displays actual stop/route name when available', () => {
		const testFavorites = [
			{ id: 'stop_1', type: 'stop', name: 'W Olympic Pl & 3rd Ave W', addedAt: Date.now() },
			{ id: 'route_5', type: 'route', name: '5 - Downtown Express', addedAt: Date.now() }
		];
		const mocks = createMocks(testFavorites);
		renderPanel(mocks);

		expect(screen.getByText('W Olympic Pl & 3rd Ave W')).toBeInTheDocument();
		expect(screen.getByText('5 - Downtown Express')).toBeInTheDocument();
	});

	it('displays multiple favorites in list', () => {
		const testFavorites = [
			{ id: 'stop_1', type: 'stop', name: 'Stop 1', addedAt: Date.now() },
			{ id: 'stop_2', type: 'stop', name: 'Stop 2', addedAt: Date.now() },
			{ id: 'route_5', type: 'route', name: 'Route 5', addedAt: Date.now() }
		];
		const mocks = createMocks(testFavorites);
		renderPanel(mocks);

		expect(screen.getByText('Stop 1')).toBeInTheDocument();
		expect(screen.getByText('Stop 2')).toBeInTheDocument();
		expect(screen.getByText('Route 5')).toBeInTheDocument();
	});

	it('renders list items with proper styling classes', () => {
		const testFavorites = [{ id: 'stop_1', type: 'stop', addedAt: Date.now() }];
		const mocks = createMocks(testFavorites);
		const { container } = renderPanel(mocks);

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
				handleStopMarkerSelect: vi.fn(),
				handleRouteSelected: vi.fn(),
				mapProvider: { addMarker: vi.fn(), flyTo: vi.fn() }
			}
		});

		unmount();
		expect(unsubscribeMock).toHaveBeenCalled();
	});
});
