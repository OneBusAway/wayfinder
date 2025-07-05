import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import SearchField from '../SearchField.svelte';

// Mock analytics
vi.mock('$lib/Analytics/PlausibleAnalytics', () => ({
	default: {
		reportSearchQuery: vi.fn()
	}
}));

// Mock svelte-i18n
vi.mock('svelte-i18n', () => {
	const translations = {
		'search.search': 'Search'
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

describe('SearchField', () => {
	let mockHandleSearchResults;
	let mockFetch;
	let analytics;

	beforeEach(async () => {
		mockHandleSearchResults = vi.fn();

		// Get analytics mock
		analytics = (await import('$lib/Analytics/PlausibleAnalytics')).default;

		// Mock fetch globally
		mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({
				results: [
					{
						id: 'stop-123',
						name: 'Test Stop for query',
						type: 'stop',
						coordinates: [47.6062, -122.3321]
					}
				]
			})
		});
		global.fetch = mockFetch;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('renders search input with proper labels and placeholders', () => {
		render(SearchField, {
			props: {
				value: '',
				handleSearchResults: mockHandleSearchResults
			}
		});

		// Check for accessibility labels
		expect(screen.getByLabelText('Search')).toBeInTheDocument();

		// Check for placeholder text
		const input = screen.getByRole('textbox');
		expect(input).toHaveAttribute('placeholder', 'search.placeholder');

		// Check for search button
		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute('type', 'button');
	});

	test('search button is disabled when input is empty', () => {
		render(SearchField, {
			props: {
				value: '',
				handleSearchResults: mockHandleSearchResults
			}
		});

		const button = screen.getByRole('button');
		expect(button).toBeDisabled();
	});

	test('search button is enabled when input has value', () => {
		render(SearchField, {
			props: {
				value: 'University District',
				handleSearchResults: mockHandleSearchResults
			}
		});

		const button = screen.getByRole('button');
		expect(button).toBeEnabled();
	});

	test('input displays the provided value', () => {
		render(SearchField, {
			props: {
				value: 'Capitol Hill',
				handleSearchResults: mockHandleSearchResults
			}
		});

		const input = screen.getByRole('textbox');
		expect(input).toHaveValue('Capitol Hill');
	});

	test('performs search when Enter key is pressed', async () => {
		const user = userEvent.setup();

		render(SearchField, {
			props: {
				value: 'University District',
				handleSearchResults: mockHandleSearchResults
			}
		});

		const input = screen.getByRole('textbox');
		await user.click(input);
		await user.keyboard('{Enter}');

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith('/api/oba/search?query=University%20District');
			expect(mockHandleSearchResults).toHaveBeenCalledWith({
				results: expect.arrayContaining([
					expect.objectContaining({
						name: 'Test Stop for query',
						type: 'stop'
					})
				])
			});
		});
	});

	test('performs search when button is clicked', async () => {
		const user = userEvent.setup();

		render(SearchField, {
			props: {
				value: 'Capitol Hill',
				handleSearchResults: mockHandleSearchResults
			}
		});

		const button = screen.getByRole('button');
		await user.click(button);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith('/api/oba/search?query=Capitol%20Hill');
			expect(mockHandleSearchResults).toHaveBeenCalledWith({
				results: expect.arrayContaining([
					expect.objectContaining({
						name: 'Test Stop for query',
						type: 'stop'
					})
				])
			});
		});
	});

	test('does not perform search when Enter is pressed with empty input', async () => {
		const user = userEvent.setup();

		render(SearchField, {
			props: {
				value: '',
				handleSearchResults: mockHandleSearchResults
			}
		});

		const input = screen.getByRole('textbox');
		await user.click(input);
		await user.keyboard('{Enter}');

		// Wait a moment to ensure no API calls are made
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(mockHandleSearchResults).not.toHaveBeenCalled();
	});

	test('handles API errors gracefully', async () => {
		const user = userEvent.setup();
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		// Mock a failed fetch
		global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

		render(SearchField, {
			props: {
				value: 'test query',
				handleSearchResults: mockHandleSearchResults
			}
		});

		const button = screen.getByRole('button');
		await user.click(button);

		await waitFor(() => {
			expect(consoleSpy).toHaveBeenCalledWith('Error fetching search results:', expect.any(Error));
		});

		consoleSpy.mockRestore();
	});

	test('has proper ARIA attributes for accessibility', () => {
		const { container } = render(SearchField, {
			props: {
				value: '',
				handleSearchResults: mockHandleSearchResults
			}
		});

		// Check for screen reader only label
		const labelElement = container.querySelector('label.sr-only');
		expect(labelElement).toHaveClass('sr-only');

		// Check search icon has aria-hidden
		const searchIcon = container.querySelector('svg[aria-hidden="true"]');
		expect(searchIcon).toHaveAttribute('aria-hidden', 'true');

		// Check button has screen reader accessible text
		const buttonSpan = container.querySelector('button span.sr-only');
		expect(buttonSpan).toHaveClass('sr-only');
	});

	test('displays search and arrow icons correctly', () => {
		const { container } = render(SearchField, {
			props: {
				value: '',
				handleSearchResults: mockHandleSearchResults
			}
		});

		// Should have two SVG icons: search icon + arrow icon
		const svgs = container.querySelectorAll('svg');
		expect(svgs).toHaveLength(2);

		// Verify SVG attributes
		const searchIcon = svgs[0];
		expect(searchIcon).toHaveAttribute('viewBox', '0 0 20 20');

		const arrowIcon = svgs[1];
		expect(arrowIcon).toHaveAttribute('viewBox', '0 0 20 20');
	});

	test('button is disabled when value is empty', () => {
		render(SearchField, {
			props: {
				value: '',
				handleSearchResults: mockHandleSearchResults
			}
		});

		const button = screen.getByRole('button');
		expect(button).toBeDisabled();
	});

	test('button is enabled when value is not empty', () => {
		render(SearchField, {
			props: {
				value: 'test query',
				handleSearchResults: mockHandleSearchResults
			}
		});

		const button = screen.getByRole('button');
		expect(button).toBeEnabled();
	});

	describe('Analytics Integration', () => {
		test('reports search query to analytics when search is performed', async () => {
			const user = userEvent.setup();

			render(SearchField, {
				props: {
					value: 'University District',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');
			await user.click(button);

			await waitFor(() => {
				expect(analytics.reportSearchQuery).toHaveBeenCalledWith('University District');
			});
		});

		test('only reports analytics on successful search, not on error', async () => {
			const user = userEvent.setup();
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Mock a failed fetch
			global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

			render(SearchField, {
				props: {
					value: 'test query',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');
			await user.click(button);

			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalled();
			});

			expect(analytics.reportSearchQuery).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('Input Validation and Edge Cases', () => {
		test('handles empty response from API', async () => {
			const user = userEvent.setup();

			// Mock empty response
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({ results: [] })
			});

			render(SearchField, {
				props: {
					value: 'nonexistent location',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');
			await user.click(button);

			await waitFor(() => {
				expect(mockHandleSearchResults).toHaveBeenCalledWith({ results: [] });
			});
		});

		test('handles special characters in search query', async () => {
			const user = userEvent.setup();
			const specialQuery = 'Café & Restaurant@123';

			render(SearchField, {
				props: {
					value: specialQuery,
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');
			await user.click(button);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith(
					`/api/oba/search?query=${encodeURIComponent(specialQuery)}`
				);
			});
		});

		test('trims whitespace from search query', async () => {
			const user = userEvent.setup();

			render(SearchField, {
				props: {
					value: '  University District  ',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');
			await user.click(button);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith('/api/oba/search?query=University%20District');
			});
		});

		test('handles very long search queries', async () => {
			const user = userEvent.setup();
			const longQuery = 'A'.repeat(1000);

			render(SearchField, {
				props: {
					value: longQuery,
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');
			await user.click(button);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith(
					`/api/oba/search?query=${encodeURIComponent(longQuery)}`
				);
			});
		});
	});

	describe('Keyboard Navigation and Accessibility', () => {
		test('supports keyboard navigation with Tab key', async () => {
			const user = userEvent.setup();

			render(SearchField, {
				props: {
					value: 'test query',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const input = screen.getByRole('textbox');
			const button = screen.getByRole('button');

			// Tab to input
			await user.tab();
			expect(input).toHaveFocus();

			// Tab to button (only works when button is enabled)
			await user.tab();
			expect(button).toHaveFocus();
		});

		test('supports Shift+Tab for reverse navigation', async () => {
			const user = userEvent.setup();

			render(SearchField, {
				props: {
					value: 'test',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const input = screen.getByRole('textbox');
			const button = screen.getByRole('button');

			// Focus button first
			button.focus();
			expect(button).toHaveFocus();

			// Shift+Tab back to input
			await user.tab({ shift: true });
			expect(input).toHaveFocus();
		});

		test('provides proper ARIA labels and descriptions', () => {
			const { container } = render(SearchField, {
				props: {
					value: '',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const input = screen.getByRole('textbox');
			const button = screen.getByRole('button');

			// Input should have accessible name
			expect(input).toHaveAccessibleName('Search');

			// Button should have accessible text
			expect(button).toHaveAccessibleName('Search');

			// Icons should be hidden from screen readers
			const searchIcon = container.querySelector('svg[aria-hidden="true"]');
			expect(searchIcon).toBeInTheDocument();
		});

		test('announces search state changes to screen readers', async () => {
			const user = userEvent.setup();

			render(SearchField, {
				props: {
					value: '',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const input = screen.getByRole('textbox');
			const button = screen.getByRole('button');

			// Initially disabled
			expect(button).toBeDisabled();
			expect(button).toHaveAttribute('disabled');

			// Type to enable
			await user.type(input, 'test');
			expect(button).toBeEnabled();
			expect(button).not.toHaveAttribute('disabled');
		});
	});

	describe('Form Interaction Patterns', () => {
		test('handles rapid successive searches gracefully', async () => {
			const user = userEvent.setup();

			render(SearchField, {
				props: {
					value: 'University District',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');

			// Click multiple times rapidly
			await user.click(button);
			await user.click(button);
			await user.click(button);

			// Should handle multiple requests
			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledTimes(3);
			});
		});

		test('prevents search when value becomes empty', async () => {
			const user = userEvent.setup();

			render(SearchField, {
				props: {
					value: '',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');

			// Try to search with empty value
			await user.click(button);

			// Should not make API call for empty input
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('handles focus and blur events correctly', async () => {
			const user = userEvent.setup();

			render(SearchField, {
				props: {
					value: '',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const input = screen.getByRole('textbox');

			// Focus input
			await user.click(input);
			expect(input).toHaveFocus();

			// Tab away
			await user.tab();
			expect(input).not.toHaveFocus();
		});
	});

	describe('Error Recovery and Loading States', () => {
		test('recovers from network error and allows retry', async () => {
			const user = userEvent.setup();
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// First request fails
			global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

			render(SearchField, {
				props: {
					value: 'test query',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');
			await user.click(button);

			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalledWith(
					'Error fetching search results:',
					expect.any(Error)
				);
			});

			// Reset fetch to succeed
			global.fetch = mockFetch;
			consoleSpy.mockClear();

			// Retry should work
			await user.click(button);

			await waitFor(() => {
				expect(mockHandleSearchResults).toHaveBeenCalled();
			});

			expect(consoleSpy).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		test('handles malformed API responses', async () => {
			const user = userEvent.setup();
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Mock malformed response
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
			});

			render(SearchField, {
				props: {
					value: 'test query',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');
			await user.click(button);

			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalledWith(
					'Error fetching search results:',
					expect.any(Error)
				);
			});

			consoleSpy.mockRestore();
		});

		test('handles HTTP error responses', async () => {
			const user = userEvent.setup();
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Mock HTTP error
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: vi.fn().mockResolvedValue({ error: 'Server error' })
			});

			render(SearchField, {
				props: {
					value: 'test query',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const button = screen.getByRole('button');
			await user.click(button);

			// Should call handleSearchResults with error response
			await waitFor(() => {
				expect(mockHandleSearchResults).toHaveBeenCalledWith({ error: 'Server error' });
			});

			consoleSpy.mockRestore();
		});
	});

	describe('Component Props and Bindings', () => {
		test('accepts initial value prop', () => {
			render(SearchField, {
				props: {
					value: 'Initial Value',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const input = screen.getByRole('textbox');
			expect(input).toHaveValue('Initial Value');
		});

		test('allows typing in the input field', async () => {
			const user = userEvent.setup();

			render(SearchField, {
				props: {
					value: '',
					handleSearchResults: mockHandleSearchResults
				}
			});

			const input = screen.getByRole('textbox');
			await user.type(input, 'Capitol Hill');

			expect(input).toHaveValue('Capitol Hill');
		});
	});
});
