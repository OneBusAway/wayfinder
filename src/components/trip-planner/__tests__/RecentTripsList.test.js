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
		'trip-planner.remove_recent_trip': 'Remove recent trip',
		'trip-planner.recent_searches': 'Recent Searches',
		'trip-planner.recent_trip': 'Recent trip from {from} to {to}',
		'trip-planner.clear_all': 'Clear All'
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
const { mockRemoveTrip, mockClearAll, mockStoreValue } = vi.hoisted(() => {
	return {
		mockRemoveTrip: vi.fn(),
		mockClearAll: vi.fn(),
		mockStoreValue: { current: [] }
	};
});

vi.mock('$stores/recentTripsStore', () => ({
	recentTrips: {
		subscribe: vi.fn((fn) => {
			fn(mockStoreValue.current);
			return () => {};
		}),
		removeTrip: mockRemoveTrip,
		clearAll: mockClearAll
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

			expect(container.querySelector('.mt-4')).toBeNull();
		});

		it('renders trip cards with from on one line and to on another', () => {
			mockStoreValue.current = sampleTrips;

			render(RecentTripsList, { props: { onSelect: vi.fn() } });

			expect(screen.getByText('Capitol Hill')).toBeInTheDocument();
			expect(screen.getByText('University District')).toBeInTheDocument();
			expect(screen.getByText('Downtown')).toBeInTheDocument();
			expect(screen.getByText('Ballard')).toBeInTheDocument();
		});

		it('renders a header with "Recent Searches" and a "Clear All" button', () => {
			mockStoreValue.current = sampleTrips;

			render(RecentTripsList, { props: { onSelect: vi.fn() } });

			expect(screen.getByText('Recent Searches')).toBeInTheDocument();
			expect(screen.getByText('Clear All')).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('renders the section heading as an h2 (no skipped heading level)', () => {
			mockStoreValue.current = sampleTrips;

			render(RecentTripsList, { props: { onSelect: vi.fn() } });

			const heading = screen.getByRole('heading', { level: 2, name: 'Recent Searches' });
			expect(heading).toBeInTheDocument();
		});

		it('uses a native button for each card with no nested interactive controls', () => {
			mockStoreValue.current = sampleTrips;

			render(RecentTripsList, { props: { onSelect: vi.fn() } });

			const card = screen.getByText('Capitol Hill').closest('button');
			expect(card.tagName).toBe('BUTTON');
			// The delete control must be a sibling, not nested inside the card button.
			expect(card.querySelector('button')).toBeNull();
		});

		it('gives the "Clear All" button AA-compliant text color (not gray-400)', () => {
			mockStoreValue.current = sampleTrips;

			render(RecentTripsList, { props: { onSelect: vi.fn() } });

			const clearAll = screen.getByText('Clear All');
			// gray-600 was the AA fix in #531; pin the regression (gray-400) rather than
			// the exact shade so an equal-or-better change (e.g. gray-700) still passes.
			expect(clearAll).not.toHaveClass('text-gray-400');
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

		it('calls onSelect when a card is activated via Enter or Space', async () => {
			mockStoreValue.current = sampleTrips;
			const mockOnSelect = vi.fn();

			render(RecentTripsList, { props: { onSelect: mockOnSelect } });

			const firstCard = screen.getByText('Capitol Hill').closest('button');
			firstCard.focus();
			await user.keyboard('{Enter}');

			expect(mockOnSelect).toHaveBeenCalledTimes(1);
			expect(mockOnSelect).toHaveBeenCalledWith(sampleTrips[0]);

			mockOnSelect.mockClear();
			await user.keyboard(' ');

			expect(mockOnSelect).toHaveBeenCalledTimes(1);
			expect(mockOnSelect).toHaveBeenCalledWith(sampleTrips[0]);
		});

		it('calls removeTrip when the delete button is clicked', async () => {
			mockStoreValue.current = sampleTrips;
			const mockOnSelect = vi.fn();

			render(RecentTripsList, { props: { onSelect: mockOnSelect } });

			const removeButtons = screen.getAllByLabelText('Remove recent trip');
			await user.click(removeButtons[0]);

			expect(mockRemoveTrip).toHaveBeenCalledTimes(1);
			expect(mockRemoveTrip).toHaveBeenCalledWith('trip-1');
			expect(mockOnSelect).not.toHaveBeenCalled();
		});

		it('calls clearAll when "Clear All" button is clicked', async () => {
			mockStoreValue.current = sampleTrips;

			render(RecentTripsList, { props: { onSelect: vi.fn() } });

			await user.click(screen.getByText('Clear All'));

			expect(mockClearAll).toHaveBeenCalledTimes(1);
		});
	});
});
