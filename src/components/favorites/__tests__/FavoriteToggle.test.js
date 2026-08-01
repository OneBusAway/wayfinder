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

const { mockToggle, mockFavorites, mockKeys } = vi.hoisted(() => {
	return {
		mockToggle: vi.fn(),
		mockFavorites: { current: [] },
		mockKeys: { current: new Set() }
	};
});

vi.mock('$stores/favoritesStore', () => ({
	favorites: {
		subscribe: vi.fn((fn) => {
			fn(mockFavorites.current);
			return () => {};
		}),
		toggle: mockToggle
	},
	favoriteKeys: {
		subscribe: vi.fn((fn) => {
			fn(mockKeys.current);
			return () => {};
		})
	}
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
		mockKeys.current = new Set();
		vi.clearAllMocks();
	});

	it('renders a button with add label when not favorited', () => {
		render(FavoriteToggle, { props: stopProps });

		const button = screen.getByRole('button', { name: 'Add to favorites' });
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute('aria-pressed', 'false');
	});

	it('renders remove label and aria-pressed when favorited', () => {
		mockKeys.current = new Set(['stop:1_75403']);

		render(FavoriteToggle, { props: stopProps });

		const button = screen.getByRole('button', { name: 'Remove from favorites' });
		expect(button).toHaveAttribute('aria-pressed', 'true');
	});

	it('calls favorites.toggle with the entry on click', async () => {
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
	});

	it('toggles a route entry', async () => {
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
	});

	it('uses a native button with no onkeydown attribute', () => {
		render(FavoriteToggle, { props: stopProps });
		const button = screen.getByRole('button', { name: 'Add to favorites' });
		expect(button.tagName).toBe('BUTTON');
		expect(button.getAttribute('onkeydown')).toBeNull();
	});
});
