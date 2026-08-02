import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FavoritesFloatingControl from '../FavoritesFloatingControl.svelte';

vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
}));

vi.mock('svelte-i18n', () => {
	const translations = {
		'favorites.title': 'Favorites',
		'favorites.open_panel': 'Open favorites',
		'favorites.close_panel': 'Close favorites',
		'favorites.empty': 'No favorites yet',
		'favorites.clear_all': 'Clear All',
		'favorites.stop_code': 'Code',
		'favorites.open_item': 'Open {name}',
		'favorites.remove_item': 'Remove {name} from favorites',
		route: 'Route',
		'direction.N': 'North'
	};
	return {
		t: {
			subscribe: vi.fn((fn) => {
				fn((key, opts) => {
					let text = translations[key] || key;
					if (opts?.values) {
						for (const [k, v] of Object.entries(opts.values)) {
							text = text.replace(`{${k}}`, v);
						}
					}
					return text;
				});
				return { unsubscribe: () => {} };
			})
		}
	};
});

const { mockStoreValue } = vi.hoisted(() => ({
	mockStoreValue: { current: [] }
}));

vi.mock('$stores/favoritesStore', () => ({
	favorites: {
		subscribe: vi.fn((fn) => {
			fn(mockStoreValue.current);
			return () => {};
		}),
		remove: vi.fn(),
		clearAll: vi.fn()
	}
}));

describe('FavoritesFloatingControl', () => {
	let user;

	beforeEach(() => {
		user = userEvent.setup();
		mockStoreValue.current = [];
		vi.clearAllMocks();
	});

	it('renders a floating open-favorites button', () => {
		render(FavoritesFloatingControl);

		expect(screen.getByRole('button', { name: 'Open favorites' })).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('opens the favorites panel on click', async () => {
		render(FavoritesFloatingControl);

		await user.click(screen.getByRole('button', { name: 'Open favorites' }));

		const dialog = screen.getByRole('dialog', { name: 'Favorites' });
		expect(dialog).toBeInTheDocument();
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(dialog).toHaveAttribute('id');
		expect(dialog).toHaveFocus();
		expect(screen.getByText('No favorites yet')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Close favorites' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		expect(screen.getByRole('button', { name: 'Close favorites' })).toHaveAttribute(
			'aria-controls',
			dialog.getAttribute('id')
		);
	});

	it('shows a count badge when favorites exist', () => {
		mockStoreValue.current = [
			{ type: 'stop', id: '1_1', name: 'A', lat: 1, lon: 2 },
			{ type: 'route', id: '1_r', shortName: '10' }
		];

		render(FavoritesFloatingControl);

		expect(screen.getByText('2')).toBeInTheDocument();
	});

	it('calls onStopClick and closes when a favorite stop is selected', async () => {
		mockStoreValue.current = [
			{
				type: 'stop',
				id: '1_75403',
				name: 'Pine St & 3rd Ave',
				code: '75403',
				direction: 'N',
				lat: 47.61,
				lon: -122.33
			}
		];
		const onStopClick = vi.fn();

		render(FavoritesFloatingControl, { props: { onStopClick } });

		await user.click(screen.getByRole('button', { name: 'Open favorites' }));
		await user.click(screen.getByLabelText('Open Pine St & 3rd Ave'));

		expect(onStopClick).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('closes on Escape and restores focus to the toggle', async () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		await user.click(toggle);
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		await user.keyboard('{Escape}');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(toggle).toHaveFocus();
	});
});
