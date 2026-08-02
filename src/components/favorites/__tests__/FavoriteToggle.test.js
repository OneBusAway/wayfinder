import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FavoriteToggle from '../FavoriteToggle.svelte';

vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
}));

vi.mock('svelte-i18n', () => {
	const translations = {
		'favorites.add': 'Add to favorites',
		'favorites.remove': 'Remove from favorites'
	};
	return {
		t: {
			subscribe: vi.fn((fn) => {
				fn((key) => translations[key] || key);
				return { unsubscribe: () => {} };
			})
		}
	};
});

const { mockToggle, mockFavorites, mockNotifySaved, mockNotifyRemoved } = vi.hoisted(() => {
	return {
		mockToggle: vi.fn(),
		mockFavorites: { current: [] },
		mockNotifySaved: vi.fn(),
		mockNotifyRemoved: vi.fn()
	};
});

vi.mock('$stores/favoritesStore', () => ({
	favorites: {
		subscribe: vi.fn((fn) => {
			fn(mockFavorites.current);
			return () => {};
		}),
		toggle: mockToggle
	}
}));

vi.mock('$lib/favoriteNotifications', () => ({
	notifyFavoriteSaved: mockNotifySaved,
	notifyFavoriteRemoved: mockNotifyRemoved
}));

describe('FavoriteToggle', () => {
	let user;

	const stopProps = {
		type: 'stop',
		id: '1_75403',
		name: 'Pine St & 3rd Ave',
		code: '75403',
		direction: 'N',
		lat: 47.6105,
		lon: -122.3363
	};

	beforeEach(() => {
		user = userEvent.setup();
		mockFavorites.current = [];
		vi.clearAllMocks();
	});

	it('renders a button with add label when not favorited', () => {
		render(FavoriteToggle, { props: stopProps });

		const button = screen.getByRole('button', { name: 'Add to favorites' });
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute('aria-pressed', 'false');
	});

	it('renders remove label and aria-pressed when favorited', () => {
		mockFavorites.current = [{ type: 'stop', id: '1_75403' }];

		render(FavoriteToggle, { props: stopProps });

		const button = screen.getByRole('button', { name: 'Remove from favorites' });
		expect(button).toHaveAttribute('aria-pressed', 'true');
	});

	it('calls favorites.toggle and notifies when a stop is saved', async () => {
		mockToggle.mockReturnValue('added');
		render(FavoriteToggle, { props: stopProps });

		await user.click(screen.getByRole('button', { name: 'Add to favorites' }));

		expect(mockToggle).toHaveBeenCalledTimes(1);
		expect(mockToggle).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'stop',
				id: '1_75403',
				name: 'Pine St & 3rd Ave',
				lat: 47.6105,
				lon: -122.3363
			})
		);
		expect(mockNotifySaved).toHaveBeenCalledTimes(1);
		expect(mockNotifyRemoved).not.toHaveBeenCalled();
	});

	it('notifies when a favorite is removed', async () => {
		mockFavorites.current = [{ type: 'stop', id: '1_75403' }];
		mockToggle.mockReturnValue('removed');

		render(FavoriteToggle, { props: stopProps });

		await user.click(screen.getByRole('button', { name: 'Remove from favorites' }));

		expect(mockNotifyRemoved).toHaveBeenCalledTimes(1);
		expect(mockNotifySaved).not.toHaveBeenCalled();
	});

	it('toggles a route entry', async () => {
		mockToggle.mockReturnValue('added');

		render(FavoriteToggle, {
			props: {
				type: 'route',
				id: '1_100479',
				shortName: '10',
				description: 'Capitol Hill',
				routeType: 3
			}
		});

		await user.click(screen.getByRole('button', { name: 'Add to favorites' }));

		expect(mockToggle).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'route',
				id: '1_100479',
				shortName: '10'
			})
		);
		expect(mockNotifySaved).toHaveBeenCalledTimes(1);
	});

	it('does not toast when toggle returns null', async () => {
		mockToggle.mockReturnValue(null);
		render(FavoriteToggle, { props: stopProps });

		await user.click(screen.getByRole('button', { name: 'Add to favorites' }));

		expect(mockNotifySaved).not.toHaveBeenCalled();
		expect(mockNotifyRemoved).not.toHaveBeenCalled();
	});

	it('uses a native button with no onkeydown attribute', () => {
		render(FavoriteToggle, { props: stopProps });
		const button = screen.getByRole('button', { name: 'Add to favorites' });
		expect(button.tagName).toBe('BUTTON');
		expect(button.getAttribute('onkeydown')).toBeNull();
	});

	it('applies default size classes when no class prop is passed', () => {
		render(FavoriteToggle, { props: stopProps });
		const button = screen.getByRole('button', { name: 'Add to favorites' });
		expect(button).toHaveClass('h-10', 'w-12');
	});

	it('omits default size classes when a class prop provides sizing', () => {
		render(FavoriteToggle, { props: { ...stopProps, class: 'h-8 w-8' } });
		const button = screen.getByRole('button', { name: 'Add to favorites' });
		expect(button).toHaveClass('h-8', 'w-8');
		expect(button).not.toHaveClass('h-10');
		expect(button).not.toHaveClass('w-12');
	});
});
