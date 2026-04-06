import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FavoritesList from '../FavoritesList.svelte';

const { mockSubscribe, mockRemoveFavorite, mockClearAll } = vi.hoisted(() => ({
	mockSubscribe: vi.fn(),
	mockRemoveFavorite: vi.fn(),
	mockClearAll: vi.fn()
}));

vi.mock('$stores/favoritesStore', () => ({
	favorites: {
		subscribe: mockSubscribe,
		removeFavorite: mockRemoveFavorite,
		clearAll: mockClearAll
	}
}));

describe('FavoritesList', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function renderWithFavorites(items, props = {}) {
		mockSubscribe.mockImplementation((fn) => {
			fn(items);
			return () => {};
		});
		return render(FavoritesList, { props });
	}

	it('shows empty state when no favorites', () => {
		renderWithFavorites([]);
		expect(screen.getByText('favorites.empty')).toBeInTheDocument();
	});

	it('renders a list of favorites', () => {
		renderWithFavorites([
			{ id: '1', type: 'stop', entityId: '1_75403', name: 'Pine St', direction: 'N' },
			{ id: '2', type: 'route', entityId: '1_100', name: 'Route 10', direction: null }
		]);

		expect(screen.getByText('Pine St')).toBeInTheDocument();
		expect(screen.getByText('Route 10')).toBeInTheDocument();
	});

	it('shows direction for stops that have it', () => {
		renderWithFavorites([
			{ id: '1', type: 'stop', entityId: '1_75403', name: 'Pine St', direction: 'N' }
		]);

		expect(screen.getByText('direction.N')).toBeInTheDocument();
	});

	it('does not show direction when null', () => {
		renderWithFavorites([
			{ id: '1', type: 'route', entityId: '1_100', name: 'Route 10', direction: null }
		]);

		expect(screen.queryByText(/direction\./)).not.toBeInTheDocument();
	});

	it('calls onStopClick when a stop favorite is clicked', async () => {
		const onStopClick = vi.fn();
		const item = { id: '1', type: 'stop', entityId: '1_75403', name: 'Pine St', direction: 'N' };
		renderWithFavorites([item], { onStopClick });

		const user = userEvent.setup();
		await user.click(screen.getByText('Pine St'));
		expect(onStopClick).toHaveBeenCalledWith(item);
	});

	it('calls onRouteClick when a route favorite is clicked', async () => {
		const onRouteClick = vi.fn();
		const item = {
			id: '2',
			type: 'route',
			entityId: '1_100',
			name: 'Route 10',
			direction: null
		};
		renderWithFavorites([item], { onRouteClick });

		const user = userEvent.setup();
		await user.click(screen.getByText('Route 10'));
		expect(onRouteClick).toHaveBeenCalledWith(item);
	});

	it('shows clear all button when favorites exist', () => {
		renderWithFavorites([
			{ id: '1', type: 'stop', entityId: '1_75403', name: 'Pine St', direction: 'N' }
		]);

		expect(screen.getByText('favorites.clear_all')).toBeInTheDocument();
	});

	it('does not show clear all button when empty', () => {
		renderWithFavorites([]);
		expect(screen.queryByText('favorites.clear_all')).not.toBeInTheDocument();
	});

	it('calls removeFavorite when trash button is clicked', async () => {
		const item = { id: 'abc-123', type: 'stop', entityId: '1_75403', name: 'Pine St', direction: 'N' };
		renderWithFavorites([item]);

		const user = userEvent.setup();
		const removeButton = screen.getByLabelText('favorites.remove');
		await user.click(removeButton);
		expect(mockRemoveFavorite).toHaveBeenCalledWith('abc-123');
	});

	it('does not trigger onStopClick when trash button is clicked', async () => {
		const onStopClick = vi.fn();
		const item = { id: 'abc-123', type: 'stop', entityId: '1_75403', name: 'Pine St', direction: 'N' };
		renderWithFavorites([item], { onStopClick });

		const user = userEvent.setup();
		const removeButton = screen.getByLabelText('favorites.remove');
		await user.click(removeButton);
		expect(onStopClick).not.toHaveBeenCalled();
	});

	it('calls clearAll when clear all button is clicked', async () => {
		renderWithFavorites([
			{ id: '1', type: 'stop', entityId: '1_75403', name: 'Pine St', direction: 'N' }
		]);

		const user = userEvent.setup();
		await user.click(screen.getByText('favorites.clear_all'));
		expect(mockClearAll).toHaveBeenCalled();
	});

	it('handles keyboard navigation on items', async () => {
		const onStopClick = vi.fn();
		const item = { id: '1', type: 'stop', entityId: '1_75403', name: 'Pine St', direction: 'N' };
		renderWithFavorites([item], { onStopClick });

		const user = userEvent.setup();
		const buttons = screen.getAllByRole('button');
		const itemEl = buttons.find((b) => b.textContent.includes('Pine St'));
		expect(itemEl).toBeDefined();
		itemEl.focus();
		await user.keyboard('{Enter}');
		expect(onStopClick).toHaveBeenCalledWith(item);
	});
});
