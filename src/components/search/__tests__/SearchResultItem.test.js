import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { BusFront, MapPin, Signpost } from '@lucide/svelte';
import SearchResultItem from '../SearchResultItem.svelte';

describe('SearchResultItem', () => {
	let mockClickHandler;

	beforeEach(() => {
		mockClickHandler = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Component Rendering', () => {
		test('renders with basic props', () => {
			render(SearchResultItem, {
				props: {
					icon: MapPin,
					title: 'Test Location',
					subtitle: 'Test Description'
				}
			});

			expect(screen.getByText('Test Location')).toBeInTheDocument();
			expect(screen.getByText('Test Description')).toBeInTheDocument();
		});

		test('renders without optional props', () => {
			render(SearchResultItem);

			// Should not crash and should render a button
			expect(screen.getByRole('button')).toBeInTheDocument();
		});

		test('renders with null values gracefully', () => {
			render(SearchResultItem, {
				props: {
					icon: null,
					title: null,
					subtitle: null
				}
			});

			const button = screen.getByRole('button');
			expect(button).toBeInTheDocument();
		});

		test('displays Lucide icon correctly', () => {
			const { container } = render(SearchResultItem, {
				props: {
					icon: MapPin,
					title: 'Test Location',
					subtitle: 'Test Description'
				}
			});

			const iconElement = container.querySelector('svg');
			expect(iconElement).toBeInTheDocument();
		});
	});

	describe('Button Interaction', () => {
		test('handles click events', async () => {
			const user = userEvent.setup();

			const { container } = render(SearchResultItem, {
				props: {
					icon: MapPin,
					title: 'Test Location',
					subtitle: 'Test Description'
				}
			});

			// Add event listener to the container
			container.addEventListener('click', mockClickHandler);

			const button = screen.getByRole('button');
			await user.click(button);

			expect(mockClickHandler).toHaveBeenCalledTimes(1);
		});

		test('is keyboard accessible', async () => {
			const user = userEvent.setup();

			const { container } = render(SearchResultItem, {
				props: {
					icon: Signpost,
					title: 'Bus Stop',
					subtitle: 'Route 44'
				}
			});

			container.addEventListener('click', mockClickHandler);

			const button = screen.getByRole('button');

			// Focus the button
			button.focus();
			expect(button).toHaveFocus();

			// Press Enter
			await user.keyboard('{Enter}');
			expect(mockClickHandler).toHaveBeenCalledTimes(1);

			// Press Space
			await user.keyboard(' ');
			expect(mockClickHandler).toHaveBeenCalledTimes(2);
		});

		test('supports rapid successive clicks', async () => {
			const user = userEvent.setup();

			const { container } = render(SearchResultItem, {
				props: {
					icon: BusFront,
					title: 'Route 44',
					subtitle: 'University District'
				}
			});

			container.addEventListener('click', mockClickHandler);

			const button = screen.getByRole('button');

			// Click multiple times rapidly
			await user.click(button);
			await user.click(button);
			await user.click(button);

			expect(mockClickHandler).toHaveBeenCalledTimes(3);
		});
	});

	describe('Accessibility Features', () => {
		test('has proper button role and semantics', () => {
			render(SearchResultItem, {
				props: {
					icon: MapPin,
					title: 'Transit Center',
					subtitle: 'Downtown Hub'
				}
			});

			const button = screen.getByRole('button');
			expect(button).toHaveAttribute('type', 'button');
		});

		test('provides accessible name from title and subtitle', () => {
			render(SearchResultItem, {
				props: {
					icon: Signpost,
					title: 'Pine Street Station',
					subtitle: 'Westbound; Code: 12345'
				}
			});

			const button = screen.getByRole('button');

			// Button should contain both title and subtitle text
			expect(button).toHaveTextContent('Pine Street Station');
			expect(button).toHaveTextContent('Westbound; Code: 12345');
		});

		test('supports screen reader navigation', () => {
			const { container } = render(SearchResultItem, {
				props: {
					icon: BusFront,
					title: 'Route 8',
					subtitle: 'Capitol Hill - South Lake Union'
				}
			});

			const button = screen.getByRole('button');

			// Should be focusable
			expect(button).toHaveAttribute('type', 'button');

			// Content should be structured for screen readers
			const heading = container.querySelector('h3');
			expect(heading).toBeInTheDocument();
			expect(heading).toHaveTextContent('Route 8');
		});

		test('handles long text content gracefully', () => {
			const longTitle =
				'This is a very long title that might wrap to multiple lines in the interface';
			const longSubtitle =
				'This is also a very long subtitle with lots of details about the transit stop or route that might wrap';

			render(SearchResultItem, {
				props: {
					icon: MapPin,
					title: longTitle,
					subtitle: longSubtitle
				}
			});

			expect(screen.getByText(longTitle)).toBeInTheDocument();
			expect(screen.getByText(longSubtitle)).toBeInTheDocument();
		});
	});

	describe('Visual Styling and Layout', () => {
		test('applies correct CSS classes for layout', () => {
			const { container } = render(SearchResultItem, {
				props: {
					icon: MapPin,
					title: 'Test Location',
					subtitle: 'Test Description'
				}
			});

			const button = container.querySelector('button');
			expect(button).toHaveClass('flex', 'w-full', 'items-center', 'gap-x-4');
		});

		test('renders icon container with proper dimensions', () => {
			const { container } = render(SearchResultItem, {
				props: {
					icon: Signpost,
					title: 'Stop Name',
					subtitle: 'Stop Details'
				}
			});

			const iconContainer = container.querySelector('.h-12.w-12');
			expect(iconContainer).toBeInTheDocument();
			expect(iconContainer).toHaveClass(
				'min-w-12',
				'max-w-12',
				'items-center',
				'justify-center',
				'rounded-full',
				'bg-gray-200'
			);
		});

		test('applies hover styles correctly', () => {
			const { container } = render(SearchResultItem, {
				props: {
					icon: BusFront,
					title: 'Route Info',
					subtitle: 'Route Details'
				}
			});

			const button = container.querySelector('button');
			expect(button).toHaveClass('hover:bg-gray-200');
		});

		test('uses semantic heading tags for title', () => {
			const { container } = render(SearchResultItem, {
				props: {
					icon: MapPin,
					title: 'Important Transit Hub',
					subtitle: 'Major Transfer Point'
				}
			});

			const heading = container.querySelector('h3');
			expect(heading).toBeInTheDocument();
			expect(heading).toHaveTextContent('Important Transit Hub');
			expect(heading).toHaveClass('text-lg', 'font-semibold', 'text-gray-700');
		});

		test('styles subtitle as paragraph', () => {
			const { container } = render(SearchResultItem, {
				props: {
					icon: Signpost,
					title: 'Stop Name',
					subtitle: 'Direction and Code Info'
				}
			});

			const paragraph = container.querySelector('p');
			expect(paragraph).toBeInTheDocument();
			expect(paragraph).toHaveTextContent('Direction and Code Info');
			expect(paragraph).toHaveClass('text-gray-700');
		});
	});

	describe('Icon Handling', () => {
		test('handles different Lucide icons', () => {
			const icons = [MapPin, Signpost, BusFront];

			icons.forEach((icon) => {
				const { container, unmount } = render(SearchResultItem, {
					props: {
						icon: icon,
						title: 'Test',
						subtitle: 'Test'
					}
				});

				const iconElement = container.querySelector('svg');
				expect(iconElement).toBeInTheDocument();

				unmount();
			});
		});

		test('renders without icon when null', () => {
			const { container } = render(SearchResultItem, {
				props: {
					icon: null,
					title: 'No Icon Item',
					subtitle: 'This item has no icon'
				}
			});

			// Should still render the icon container
			const iconContainer = container.querySelector('.h-12.w-12');
			expect(iconContainer).toBeInTheDocument();
		});

		test('handles undefined icon gracefully', () => {
			render(SearchResultItem, {
				props: {
					icon: undefined,
					title: 'Undefined Icon',
					subtitle: 'Testing undefined icon'
				}
			});

			// Should not crash and should render a button
			const button = screen.getByRole('button');
			expect(button).toBeInTheDocument();
		});
	});

	describe('Event Bubbling and Propagation', () => {
		test('properly bubbles click events', async () => {
			const user = userEvent.setup();

			const { container } = render(SearchResultItem, {
				props: {
					icon: MapPin,
					title: 'Test Item',
					subtitle: 'Test Description'
				}
			});

			container.addEventListener('click', mockClickHandler);

			const button = screen.getByRole('button');
			await user.click(button);

			expect(mockClickHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'click',
					target: button
				})
			);
		});

		test('handles event with custom detail', async () => {
			const user = userEvent.setup();

			const { container } = render(SearchResultItem, {
				props: {
					icon: BusFront,
					title: 'Route Item',
					subtitle: 'Route Description'
				}
			});

			container.addEventListener('click', (event) => {
				mockClickHandler(event);
			});

			const button = screen.getByRole('button');
			await user.click(button);

			expect(mockClickHandler).toHaveBeenCalled();
		});
	});

	describe('Component Integration', () => {
		test('works with different data types for props', () => {
			// Test with various data types that might come from API
			const testCases = [
				{
					title: 'String Title',
					subtitle: 'String Subtitle'
				},
				{
					title: 123,
					subtitle: 456
				},
				{
					title: '',
					subtitle: ''
				}
			];

			testCases.forEach((testCase) => {
				const { unmount } = render(SearchResultItem, {
					props: {
						icon: MapPin,
						...testCase
					}
				});

				// Should render without errors
				expect(screen.getByRole('button')).toBeInTheDocument();

				unmount();
			});
		});

		test('maintains consistent layout with different content lengths', () => {
			const shortProps = {
				icon: MapPin,
				title: 'A',
				subtitle: 'B'
			};

			const longProps = {
				icon: MapPin,
				title: 'This is a very long title that contains many words and might wrap',
				subtitle:
					'This is also a very long subtitle with extensive details about the location or transit route'
			};

			const { container: shortContainer, unmount: unmountShort } = render(SearchResultItem, {
				props: shortProps
			});

			const { container: longContainer, unmount: unmountLong } = render(SearchResultItem, {
				props: longProps
			});

			// Both should have the same structural layout
			const shortIconContainer = shortContainer.querySelector('.h-12.w-12');
			const longIconContainer = longContainer.querySelector('.h-12.w-12');

			expect(shortIconContainer).toBeInTheDocument();
			expect(longIconContainer).toBeInTheDocument();

			unmountShort();
			unmountLong();
		});
	});

	describe('Performance and Optimization', () => {
		test('handles multiple rapid renders without issues', () => {
			// Test that component can handle different props without crashing
			const { unmount } = render(SearchResultItem, {
				props: {
					icon: MapPin,
					title: 'Initial Title',
					subtitle: 'Initial Subtitle'
				}
			});

			expect(screen.getByText('Initial Title')).toBeInTheDocument();
			expect(screen.getByText('Initial Subtitle')).toBeInTheDocument();

			unmount();

			// Render with different props
			render(SearchResultItem, {
				props: {
					icon: Signpost,
					title: 'Final Title',
					subtitle: 'Final Subtitle'
				}
			});

			expect(screen.getByText('Final Title')).toBeInTheDocument();
			expect(screen.getByText('Final Subtitle')).toBeInTheDocument();
		});

		test('cleans up event listeners properly', () => {
			const { container, unmount } = render(SearchResultItem, {
				props: {
					icon: BusFront,
					title: 'Test Component',
					subtitle: 'Test Description'
				}
			});

			container.addEventListener('click', mockClickHandler);

			// Component should be functional
			expect(screen.getByRole('button')).toBeInTheDocument();

			// Unmount should not cause errors
			unmount();

			// Verify cleanup
			expect(screen.queryByRole('button')).not.toBeInTheDocument();
		});
	});
});
