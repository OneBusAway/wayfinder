import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import RecentTripsList from '../RecentTripsList.svelte';

// Mock FontAwesome (same pattern as TripPlanSearchField.test.js)
vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
}));

// Mock svelte-i18n (same pattern as TripPlanSearchField.test.js)
vi.mock('svelte-i18n', () => {
	const translations = {
		'trip-planner.remove_recent_trip': 'Remove'
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

// Use vi.hoisted so mock variables are available inside vi.mock factories
const { mockRemoveTrip, mockStoreValue } = vi.hoisted(() => {
	return {
		mockRemoveTrip: vi.fn(),
		mockStoreValue: { current: [] }
	};
});

vi.mock('$stores/recentTripsStore', () => ({
	recentTrips: {
		subscribe: vi.fn((fn) => {
			fn(mockStoreValue.current);
			return () => {};
		}),
		removeTrip: mockRemoveTrip
	}
}));

describe('RecentTripsList', () => {
	let user;

	const sampleTrips = [
		{
			id: 'trip-1',
			fromPlace: 'Capitol Hill',
			toPlace: 'University District',
			fromCoords: { lat: 47.62, lng: -122.32 },
			toCoords: { lat: 47.66, lng: -122.31 }
		},
		{
			id: 'trip-2',
			fromPlace: 'Downtown',
			toPlace: 'Ballard',
			fromCoords: { lat: 47.61, lng: -122.34 },
			toCoords: { lat: 47.67, lng: -122.38 }
		}
	];

	beforeEach(() => {
		user = userEvent.setup();
		mockStoreValue.current = [];
		vi.clearAllMocks();
	});

	describe('Rendering', () => {
		it('renders nothing when the store is empty', () => {
			mockStoreValue.current = [];
			const { container } = render(RecentTripsList, { props: { onSelect: vi.fn() } });

			expect(screen.queryAllByRole('button')).toHaveLength(0);
			expect(container.querySelector('.mt-4')).toBeNull();
		});

		it('renders trip cards with correct from/to text', () => {
			mockStoreValue.current = sampleTrips;

			render(RecentTripsList, { props: { onSelect: vi.fn() } });

			expect(screen.getByText('Capitol Hill')).toBeInTheDocument();
			expect(screen.getByText('University District')).toBeInTheDocument();
			expect(screen.getByText('Downtown')).toBeInTheDocument();
			expect(screen.getByText('Ballard')).toBeInTheDocument();
		});

		it('does NOT render a header or Clear All button', () => {
			mockStoreValue.current = sampleTrips;

			render(RecentTripsList, { props: { onSelect: vi.fn() } });

			expect(screen.queryByText('Recent Searches')).not.toBeInTheDocument();
			expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
		});
	});

	describe('Interactions', () => {
		it('calls onSelect with the trip when a card is clicked', async () => {
			mockStoreValue.current = sampleTrips;
			const mockOnSelect = vi.fn();

			render(RecentTripsList, { props: { onSelect: mockOnSelect } });

			const firstCard = screen.getByText('Capitol Hill').closest('button');
			await user.click(firstCard);

			expect(mockOnSelect).toHaveBeenCalledTimes(1);
			expect(mockOnSelect).toHaveBeenCalledWith(sampleTrips[0]);
		});

		it('calls removeTrip when the delete button is clicked', async () => {
			mockStoreValue.current = sampleTrips;

			render(RecentTripsList, { props: { onSelect: vi.fn() } });

			const removeButtons = screen.getAllByLabelText('Remove');
			await user.click(removeButtons[0]);

			expect(mockRemoveTrip).toHaveBeenCalledTimes(1);
			expect(mockRemoveTrip).toHaveBeenCalledWith('trip-1');
		});
	});
});
