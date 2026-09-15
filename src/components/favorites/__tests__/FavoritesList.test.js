import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FavoritesList from '../FavoritesList.svelte';

vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
}));

vi.mock('svelte-i18n', () => {
	const translations = {
		'favorites.title': 'Favorites',
		'favorites.clear_all': 'Clear All',
		'favorites.empty': 'No favorites yet',
		'favorites.stop_code': 'Code',
		'favorites.open_item': 'Open {name}',
		'favorites.remove_item': 'Remove {name} from favorites',
		route: 'Route',
		'direction.N': 'Northbound'
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

const { mockRemove, mockClearAll, mockStoreValue } = vi.hoisted(() => {
	return {
		mockRemove: vi.fn(),
		mockClearAll: vi.fn(),
		mockStoreValue: { current: [] }
	};
});

vi.mock('$stores/favoritesStore', () => ({
	favorites: {
		subscribe: vi.fn((fn) => {
			fn(mockStoreValue.current);
			return () => {};
		}),
		remove: mockRemove,
		clearAll: mockClearAll
	}
}));

describe('FavoritesList', () => {
	let user;

	const sampleFavorites = [
		{
			schemaVersion: 1,
			type: 'stop',
			id: '1_75403',
			name: 'Pine St & 3rd Ave',
			code: '75403',
			direction: 'N',
			lat: 47.61,
			lon: -122.33,
			savedAt: 1
		},
		{
			schemaVersion: 1,
			type: 'route',
			id: '1_100479',
			shortName: '10',
			description: 'Capitol Hill - Downtown',
			routeType: 3,
			savedAt: 2
		}
	];

	beforeEach(() => {
		user = userEvent.setup();
		mockStoreValue.current = [];
		vi.clearAllMocks();
	});

	it('renders the empty state when there are no favorites', () => {
		render(FavoritesList);

		expect(screen.getByText('No favorites yet')).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Favorites' })).toBeInTheDocument();
		expect(screen.queryByText('Clear All')).toBeNull();
	});

	it('renders stop and route favorites', () => {
		mockStoreValue.current = sampleFavorites;

		render(FavoritesList);

		expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		expect(screen.getByText(/Northbound/)).toBeInTheDocument();
		expect(screen.getByText('Route 10')).toBeInTheDocument();
		expect(screen.getByText('Capitol Hill - Downtown')).toBeInTheDocument();
		expect(screen.getByText('Clear All')).toBeInTheDocument();
	});

	it('keeps the item button and delete button as siblings', () => {
		mockStoreValue.current = sampleFavorites;

		render(FavoritesList);

		const itemButton = screen.getByLabelText('Open Pine St & 3rd Ave');
		expect(itemButton.tagName).toBe('BUTTON');
		expect(itemButton.querySelector('button')).toBeNull();

		const removeButton = screen.getByLabelText('Remove Pine St & 3rd Ave from favorites');
		expect(removeButton.tagName).toBe('BUTTON');
		expect(itemButton.contains(removeButton)).toBe(false);
	});

	it('calls onStopClick when a stop is selected', async () => {
		mockStoreValue.current = sampleFavorites;
		const onStopClick = vi.fn();
		const onRouteClick = vi.fn();

		render(FavoritesList, { props: { onStopClick, onRouteClick } });

		await user.click(screen.getByLabelText('Open Pine St & 3rd Ave'));

		expect(onStopClick).toHaveBeenCalledTimes(1);
		expect(onStopClick).toHaveBeenCalledWith(sampleFavorites[0]);
		expect(onRouteClick).not.toHaveBeenCalled();
	});

	it('calls onRouteClick when a route is selected', async () => {
		mockStoreValue.current = sampleFavorites;
		const onStopClick = vi.fn();
		const onRouteClick = vi.fn();

		render(FavoritesList, { props: { onStopClick, onRouteClick } });

		await user.click(screen.getByLabelText('Open Route 10'));

		expect(onRouteClick).toHaveBeenCalledTimes(1);
		expect(onRouteClick).toHaveBeenCalledWith(sampleFavorites[1]);
		expect(onStopClick).not.toHaveBeenCalled();
	});

	it('calls remove without triggering onStopClick', async () => {
		mockStoreValue.current = sampleFavorites;
		const onStopClick = vi.fn();

		render(FavoritesList, { props: { onStopClick } });

		await user.click(screen.getByLabelText('Remove Pine St & 3rd Ave from favorites'));

		expect(mockRemove).toHaveBeenCalledTimes(1);
		expect(mockRemove).toHaveBeenCalledWith('stop', '1_75403');
		expect(onStopClick).not.toHaveBeenCalled();
	});

	it('calls clearAll when Clear All is clicked', async () => {
		mockStoreValue.current = sampleFavorites;

		render(FavoritesList);

		await user.click(screen.getByText('Clear All'));

		expect(mockClearAll).toHaveBeenCalledTimes(1);
	});
});
