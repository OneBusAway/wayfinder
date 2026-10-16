import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tick } from 'svelte';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FavoritesFloatingControl from '../FavoritesFloatingControl.svelte';

vi.mock('@lucide/svelte', async (importOriginal) => {
	const { default: LucideStub } = await import('../../../tests/mocks/LucideStub.svelte');
	return { ...(await importOriginal()), Star: LucideStub, Signpost: LucideStub, X: LucideStub };
});

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

	// jsdom lays every element out as a 0x0 box at the origin, and Bits UI only
	// dismisses when the pointer lands outside the content's rect, so click off-origin
	function clickOutside(target) {
		return user.pointer({ coords: { clientX: 1, clientY: 1 }, keys: '[MouseLeft]', target });
	}

	beforeEach(() => {
		user = userEvent.setup();
		mockStoreValue.current = [];
		vi.clearAllMocks();
	});

	it('renders a floating open-favorites button', () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByText('No favorites yet')).not.toBeInTheDocument();
	});

	it('opens the favorites panel on click', async () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		await user.click(toggle);

		const panel = document.getElementById(toggle.getAttribute('aria-controls'));
		expect(panel).toBeInTheDocument();
		expect(panel).toHaveAttribute('aria-label', 'Favorites');
		expect(panel).not.toHaveAttribute('aria-modal');
		await waitFor(() => expect(panel).toHaveFocus());
		expect(screen.getByText('No favorites yet')).toBeInTheDocument();
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(toggle).toHaveAccessibleName('Close favorites');
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

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		await user.click(toggle);
		await user.click(screen.getByLabelText('Open Pine St & 3rd Ave'));

		expect(onStopClick).toHaveBeenCalledTimes(1);
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByLabelText('Open Pine St & 3rd Ave')).not.toBeInTheDocument();
	});

	it('stays open when a node inside the panel detaches itself in its own handler', async () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		await user.click(toggle);
		const panel = document.getElementById(toggle.getAttribute('aria-controls'));
		expect(panel).toBeInTheDocument();

		// A row's ✕ removes its own DOM node mid-click, leaving a detached target
		// whose contains() reads false. That must not count as an outside click.
		const row = document.createElement('button');
		panel.appendChild(row);
		row.addEventListener('click', () => row.remove());

		row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// Let any (wrongful) close flush to the DOM before asserting.
		await tick();

		expect(panel).toBeInTheDocument();
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
	});

	it('closes when the toggle is clicked again, keeping focus on the toggle', async () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		await user.click(toggle);
		const panel = document.getElementById(toggle.getAttribute('aria-controls'));
		expect(panel).toBeInTheDocument();

		await user.click(toggle);

		expect(panel).not.toBeInTheDocument();
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(toggle).toHaveFocus();
	});

	it('closes when a click lands on a node outside the control', async () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		await user.click(toggle);
		const panel = document.getElementById(toggle.getAttribute('aria-controls'));
		expect(panel).toBeInTheDocument();

		const outside = document.createElement('div');
		document.body.appendChild(outside);

		await clickOutside(outside);

		await waitFor(() => expect(panel).not.toBeInTheDocument());
		outside.remove();
	});

	it('returns focus to the toggle when an outside click focuses another element', async () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		await user.click(toggle);
		const panel = document.getElementById(toggle.getAttribute('aria-controls'));
		expect(panel).toBeInTheDocument();

		const input = document.createElement('input');
		document.body.appendChild(input);

		await clickOutside(input);

		await waitFor(() => expect(panel).not.toBeInTheDocument());
		expect(toggle).toHaveFocus();
		input.remove();
	});

	it('restores focus to the toggle when the outside click took none', async () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		await user.click(toggle);
		const panel = document.getElementById(toggle.getAttribute('aria-controls'));
		expect(panel).toBeInTheDocument();

		const outside = document.createElement('div');
		document.body.appendChild(outside);

		await clickOutside(outside);

		await waitFor(() => expect(panel).not.toBeInTheDocument());
		expect(toggle).toHaveFocus();
		outside.remove();
	});

	it('closes on Escape and restores focus to the toggle', async () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		await user.click(toggle);
		const panel = document.getElementById(toggle.getAttribute('aria-controls'));
		expect(panel).toBeInTheDocument();

		await user.keyboard('{Escape}');
		expect(panel).not.toBeInTheDocument();
		expect(toggle).toHaveFocus();
	});
});
