import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FavoriteToggle from '../FavoriteToggle.svelte';

const { mockSubscribe, mockAddFavorite, mockRemoveFavorite } = vi.hoisted(() => ({
	mockSubscribe: vi.fn(),
	mockAddFavorite: vi.fn(),
	mockRemoveFavorite: vi.fn()
}));

vi.mock('$stores/favoritesStore', () => ({
	favorites: {
		subscribe: mockSubscribe,
		addFavorite: mockAddFavorite,
		removeFavorite: mockRemoveFavorite
	}
}));

describe('FavoriteToggle', () => {
	const defaultProps = {
		type: 'stop',
		entityId: '1_75403',
		name: 'Pine St & 3rd Ave',
		direction: 'N',
		coords: { lat: 47.61, lng: -122.33 }
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockSubscribe.mockImplementation((fn) => {
			fn([]);
			return () => {};
		});
	});

	it('renders a button with aria-label for adding', () => {
		render(FavoriteToggle, { props: defaultProps });
		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute('aria-label', 'favorites.add');
	});

	it('renders aria-label for removing when favorited', () => {
		mockSubscribe.mockImplementation((fn) => {
			fn([{ type: 'stop', entityId: '1_75403', id: 'abc' }]);
			return () => {};
		});

		render(FavoriteToggle, { props: defaultProps });
		const button = screen.getByRole('button');
		expect(button).toHaveAttribute('aria-label', 'favorites.remove');
	});

	it('calls addFavorite when clicking unfavorited toggle', async () => {
		const user = userEvent.setup();
		render(FavoriteToggle, { props: defaultProps });

		await user.click(screen.getByRole('button'));
		expect(mockAddFavorite).toHaveBeenCalledWith({
			type: 'stop',
			entityId: '1_75403',
			name: 'Pine St & 3rd Ave',
			direction: 'N',
			coords: { lat: 47.61, lng: -122.33 }
		});
	});

	it('calls removeFavorite when clicking favorited toggle', async () => {
		mockSubscribe.mockImplementation((fn) => {
			fn([{ type: 'stop', entityId: '1_75403', id: 'abc-123' }]);
			return () => {};
		});

		const user = userEvent.setup();
		render(FavoriteToggle, { props: defaultProps });

		await user.click(screen.getByRole('button'));
		expect(mockRemoveFavorite).toHaveBeenCalledWith('abc-123');
	});

	it('toggles on Enter key', async () => {
		const user = userEvent.setup();
		render(FavoriteToggle, { props: defaultProps });

		const button = screen.getByRole('button');
		button.focus();
		await user.keyboard('{Enter}');
		expect(mockAddFavorite).toHaveBeenCalled();
	});

	it('toggles on Space key', async () => {
		const user = userEvent.setup();
		render(FavoriteToggle, { props: defaultProps });

		const button = screen.getByRole('button');
		button.focus();
		await user.keyboard(' ');
		expect(mockAddFavorite).toHaveBeenCalled();
	});

	it('handles missing optional props', () => {
		render(FavoriteToggle, {
			props: { type: 'route', entityId: '1_100', name: 'Route 10' }
		});
		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
	});
});
