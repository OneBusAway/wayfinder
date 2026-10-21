import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { tick } from 'svelte';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FavoritesFloatingControl from '../FavoritesFloatingControl.svelte';
import { stubLayoutBox } from '../../../tests/helpers/test-utils';

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
		locale: {
			subscribe: vi.fn((fn) => {
				fn('en');
				return () => {};
			})
		},
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

	function renderFavoritesFloatingControl(props) {
		const result = render(FavoritesFloatingControl, props);
		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		stubLayoutBox(toggle);
		return { ...result, toggle };
	}

	async function openFavoritesDialog(toggle) {
		await user.click(toggle);
		return screen.findByRole('dialog', { name: 'Favorites' });
	}

	beforeEach(() => {
		user = userEvent.setup();
		mockStoreValue.current = [];
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders a floating open-favorites button', () => {
		render(FavoritesFloatingControl);

		const toggle = screen.getByRole('button', { name: 'Open favorites' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('opens the favorites panel on click', async () => {
		const { toggle } = renderFavoritesFloatingControl();

		const panel = await openFavoritesDialog(toggle);

		expect(toggle).toHaveAttribute('aria-controls', panel.id);
		expect(panel).not.toHaveAttribute('aria-modal');
		await waitFor(() => expect(panel).toHaveFocus());
		expect(panel).toHaveTextContent('No favorites yet');
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

		const { toggle } = renderFavoritesFloatingControl({ props: { onStopClick } });

		await user.click(toggle);
		await user.click(await screen.findByRole('button', { name: 'Open Pine St & 3rd Ave' }));

		expect(onStopClick).toHaveBeenCalledTimes(1);
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Open Pine St & 3rd Ave' })
		).not.toBeInTheDocument();
	});

	it('stays open when a node inside the panel detaches itself in its own handler', async () => {
		const { toggle } = renderFavoritesFloatingControl();

		const panel = await openFavoritesDialog(toggle);

		// A row's ✕ removes its own DOM node mid-click, leaving a detached target
		// whose contains() reads false. That must not count as an outside click.
		const row = document.createElement('button');
		panel.appendChild(row);
		row.addEventListener('click', () => row.remove());

		row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// Let any (wrongful) close flush to the DOM before asserting.
		await tick();

		expect(screen.queryByRole('dialog', { name: 'Favorites' })).toBeInTheDocument();
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
	});

	it('closes when the toggle is clicked again, keeping focus on the toggle', async () => {
		const { toggle } = renderFavoritesFloatingControl();

		await openFavoritesDialog(toggle);

		await user.click(toggle);

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(toggle).toHaveFocus();
	});

	it('closes when a click lands on a node outside the control', async () => {
		const { toggle } = renderFavoritesFloatingControl();

		await openFavoritesDialog(toggle);

		const outside = document.createElement('div');
		document.body.appendChild(outside);

		await clickOutside(outside);

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		outside.remove();
	});

	it('leaves focus on an outside element that took it', async () => {
		const { toggle } = renderFavoritesFloatingControl();

		const panel = await openFavoritesDialog(toggle);
		await waitFor(() => expect(panel).toHaveFocus());

		const input = document.createElement('input');
		document.body.appendChild(input);

		await clickOutside(input);

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(input).toHaveFocus();
		input.remove();
	});

	it('restores focus to the toggle when the outside click took none', async () => {
		const { toggle } = renderFavoritesFloatingControl();

		await openFavoritesDialog(toggle);

		const outside = document.createElement('div');
		document.body.appendChild(outside);

		await clickOutside(outside);

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(toggle).toHaveFocus();
		outside.remove();
	});

	it('closes on Escape and restores focus to the toggle', async () => {
		const { toggle } = renderFavoritesFloatingControl();

		await openFavoritesDialog(toggle);

		await user.keyboard('{Escape}');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(toggle).toHaveFocus();
	});
});
