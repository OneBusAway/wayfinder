import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import TripPlanSearchField from '../TripPlanSearchField.svelte';
import { renderWithUtils } from '../../../tests/helpers/test-utils.js';
// Mock FontAwesome icons
vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
}));

// Mock svelte-i18n
vi.mock('svelte-i18n', () => {
	const translations = {
		'trip-planner.search_for_a_place': 'Search for a place',
		'trip-planner.loading': 'Loading',
		'search.clear': 'Clear'
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

describe('TripPlanSearchField', () => {
	let mockOnInput;
	let mockOnClear;
	let mockOnSelect;
	let user;
	let defaultProps;

	beforeEach(() => {
		mockOnInput = vi.fn();
		mockOnClear = vi.fn();
		mockOnSelect = vi.fn();
		user = userEvent.setup();

		defaultProps = {
			inputId: 'from-location-input',
			place: '',
			results: [],
			isLoading: false,
			onInput: mockOnInput,
			onClear: mockOnClear,
			onSelect: mockOnSelect
		};
	});

	describe('Rendering', () => {
		it('renders with default props', () => {
			render(TripPlanSearchField, { props: defaultProps });

			const input = screen.getByPlaceholderText('Search for a place...');
			expect(input).toBeInTheDocument();
			expect(input).toHaveAttribute('id', 'from-location-input');
		});

		it('renders with initial place value', () => {
			const props = { ...defaultProps, place: 'Capitol Hill' };
			render(TripPlanSearchField, { props });

			const input = screen.getByDisplayValue('Capitol Hill');
			expect(input).toBeInTheDocument();
		});

		it('shows clear button when place has value', () => {
			const props = { ...defaultProps, place: 'Capitol Hill' };
			render(TripPlanSearchField, { props });

			const clearButton = screen.getByLabelText('Clear');
			expect(clearButton).toBeInTheDocument();
		});

		it('hides clear button when place is empty', () => {
			render(TripPlanSearchField, { props: defaultProps });

			const clearButton = screen.queryByLabelText('Clear');
			expect(clearButton).not.toBeInTheDocument();
		});

		it('shows loading state', () => {
			const props = { ...defaultProps, isLoading: true };
			render(TripPlanSearchField, { props });

			expect(screen.getByText('Loading...')).toBeInTheDocument();
		});

		it('shows autocomplete results', () => {
			const results = [
				{
					displayText: 'Capitol Hill, Seattle, WA, USA',
					name: 'Capitol Hill'
				},
				{
					displayText: 'University District, Seattle, WA, USA',
					name: 'University District'
				}
			];
			const props = { ...defaultProps, results };
			render(TripPlanSearchField, { props });

			expect(screen.getByText('Capitol Hill, Seattle, WA, USA')).toBeInTheDocument();
			expect(screen.getByText('University District, Seattle, WA, USA')).toBeInTheDocument();
		});
	});

	describe('User Interactions', () => {
		it('calls onInput when user types', async () => {
			render(TripPlanSearchField, { props: defaultProps });

			const input = screen.getByPlaceholderText('Search for a place...');
			await user.type(input, 'Capitol');

			// onInput should be called for each character
			expect(mockOnInput).toHaveBeenCalledWith('C');
			expect(mockOnInput).toHaveBeenCalledWith('Ca');
			expect(mockOnInput).toHaveBeenCalledWith('Cap');
			expect(mockOnInput).toHaveBeenCalledWith('Capi');
			expect(mockOnInput).toHaveBeenCalledWith('Capit');
			expect(mockOnInput).toHaveBeenCalledWith('Capito');
			expect(mockOnInput).toHaveBeenCalledWith('Capitol');
		});

		it('calls onClear when clear button is clicked', async () => {
			const props = { ...defaultProps, place: 'Capitol Hill' };
			render(TripPlanSearchField, { props });

			const clearButton = screen.getByLabelText('Clear');
			await user.click(clearButton);

			expect(mockOnClear).toHaveBeenCalledOnce();
		});

		it('calls onSelect when autocomplete result is clicked', async () => {
			const result = {
				displayText: 'Capitol Hill, Seattle, WA, USA',
				name: 'Capitol Hill'
			};
			const props = { ...defaultProps, results: [result] };
			render(TripPlanSearchField, { props });

			const resultButton = screen.getByText('Capitol Hill, Seattle, WA, USA');
			await user.click(resultButton);

			expect(mockOnSelect).toHaveBeenCalledWith(result);
		});

		it('keeps focus on the input while Arrow keys select an active result', async () => {
			const results = [
				{ displayText: 'Capitol Hill, Seattle, WA, USA', name: 'Capitol Hill' },
				{ displayText: 'University District, Seattle, WA, USA', name: 'University District' }
			];
			const props = { ...defaultProps, results };
			render(TripPlanSearchField, { props });

			const input = screen.getByRole('combobox');
			const options = screen.getAllByRole('option');

			await user.click(input);
			await user.keyboard('{ArrowDown}');

			expect(input).toHaveFocus();
			expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
			expect(options[0]).toHaveAttribute('aria-selected', 'true');

			await user.keyboard('{ArrowUp}');
			expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
			expect(options[1]).toHaveAttribute('aria-selected', 'true');
		});

		it('selects result with Enter key', async () => {
			const result = {
				displayText: 'Capitol Hill, Seattle, WA, USA',
				name: 'Capitol Hill'
			};
			const props = { ...defaultProps, results: [result] };
			render(TripPlanSearchField, { props });

			const input = screen.getByRole('combobox');
			await user.click(input);
			await user.keyboard('{ArrowDown}{Enter}');

			expect(mockOnSelect).toHaveBeenCalledWith(result);
		});

		it('dismisses the results with Escape', async () => {
			const onDismiss = vi.fn();
			const results = [{ displayText: 'Capitol Hill, Seattle, WA, USA', name: 'Capitol Hill' }];
			const props = { ...defaultProps, results, onDismiss };
			render(TripPlanSearchField, { props });

			const input = screen.getByRole('combobox');
			await user.click(input);
			await user.keyboard('{ArrowDown}{Escape}');

			expect(onDismiss).toHaveBeenCalledOnce();
			expect(input).not.toHaveAttribute('aria-activedescendant');
		});
	});

	describe('Accessibility', () => {
		it('has proper input attributes for external labeling', () => {
			render(TripPlanSearchField, { props: defaultProps });

			const input = screen.getByPlaceholderText('Search for a place...');
			expect(input).toHaveAttribute('id', 'from-location-input');
			expect(input).toHaveAttribute('type', 'text');
			// Label is now in the parent component (TripPlan.svelte) and connects via the inputId
		});

		it('clear button has proper accessibility label', () => {
			const props = { ...defaultProps, place: 'Capitol Hill' };
			render(TripPlanSearchField, { props });

			const clearButton = screen.getByLabelText('Clear');
			expect(clearButton).toHaveAttribute('aria-label', 'Clear');
			expect(clearButton).toHaveAttribute('type', 'button');
		});

		it('exposes the full combobox/listbox relationship', () => {
			const results = [{ displayText: 'Capitol Hill, Seattle, WA, USA', name: 'Capitol Hill' }];
			const props = { ...defaultProps, results };
			render(TripPlanSearchField, { props });

			const input = screen.getByRole('combobox');
			const listbox = screen.getByRole('listbox');
			const option = screen.getByRole('option');

			expect(input).toHaveAttribute('aria-expanded', 'true');
			expect(input).toHaveAttribute('aria-controls', listbox.id);
			expect(input).toHaveAttribute('aria-autocomplete', 'list');
			expect(option).toHaveAttribute('aria-posinset', '1');
			expect(option).toHaveAttribute('aria-setsize', '1');
		});

		it('has proper semantic structure', () => {
			const results = [
				{ displayText: 'Capitol Hill, Seattle, WA, USA', name: 'Capitol Hill' },
				{ displayText: 'University District, Seattle, WA, USA', name: 'University District' }
			];
			const props = { ...defaultProps, results };
			render(TripPlanSearchField, { props });

			// Results should be in a listbox.
			const resultsList = screen.getByRole('listbox');
			expect(resultsList).toBeInTheDocument();

			// Each result should be an option within the listbox.
			const resultOptions = screen.getAllByRole('option');
			expect(resultOptions).toHaveLength(2);
		});

		it('supports screen readers with proper labeling', () => {
			const props = { ...defaultProps, isLoading: true };
			render(TripPlanSearchField, { props });

			// Loading message should be announced to screen readers
			const loadingMessage = screen.getByText('Loading...');
			expect(loadingMessage).toBeInTheDocument();
		});
	});

	describe('Edge Cases', () => {
		it('handles empty results gracefully', () => {
			const props = { ...defaultProps, results: [] };
			render(TripPlanSearchField, { props });

			const resultsList = screen.queryByRole('listbox');
			expect(resultsList).not.toBeInTheDocument();
		});

		it('handles null/undefined results', () => {
			const props = { ...defaultProps, results: null };
			expect(() => render(TripPlanSearchField, { props })).not.toThrow();
		});

		it('handles results without displayText', () => {
			const results = [
				{ name: 'Capitol Hill' } // Missing displayText
			];
			const props = { ...defaultProps, results };

			expect(() => render(TripPlanSearchField, { props })).not.toThrow();
		});

		it('handles very long place names', () => {
			const longPlaceName = 'A'.repeat(200);
			const props = { ...defaultProps, place: longPlaceName };
			render(TripPlanSearchField, { props });

			const input = screen.getByDisplayValue(longPlaceName);
			expect(input).toBeInTheDocument();
		});

		it('handles rapid input changes', async () => {
			render(TripPlanSearchField, { props: defaultProps });

			const input = screen.getByPlaceholderText('Search for a place...');

			// Simulate rapid typing
			await user.type(input, 'Capitol Hill', { delay: 1 });

			// onInput should be called for each character regardless of speed
			expect(mockOnInput).toHaveBeenCalledTimes(12); // 'Capitol Hill'.length
		});
	});

	describe('Integration', () => {
		it('works with reactive place binding', async () => {
			renderWithUtils(TripPlanSearchField, { props: defaultProps });

			const input = screen.getByPlaceholderText('Search for a place...');
			await user.type(input, 'New Place');

			// The component's internal state should update
			expect(input).toHaveValue('New Place');
		});

		it('updates when results prop changes', async () => {
			const newResults = [{ displayText: 'Capitol Hill, Seattle, WA, USA', name: 'Capitol Hill' }];
			const props = { ...defaultProps, results: newResults };
			render(TripPlanSearchField, { props });

			expect(screen.getByText('Capitol Hill, Seattle, WA, USA')).toBeInTheDocument();
		});

		it('updates when loading state changes', async () => {
			const props = { ...defaultProps, isLoading: true };
			render(TripPlanSearchField, { props });

			expect(screen.getByText('Loading...')).toBeInTheDocument();
		});
	});
});
