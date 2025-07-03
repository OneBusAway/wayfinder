import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi } from 'vitest';
import RouteItem from '../RouteItem.svelte';
import { mockRoutesListData } from '../../tests/fixtures/obaData.js';

describe('RouteItem', () => {
	// Use enhanced fixtures with proper route types and agency info
	const mockRouteWithShortAndLong = mockRoutesListData[0]; // Bus route 44
	const mockLightRailRoute = mockRoutesListData[2]; // 1 Line Light Rail
	const mockFerryRoute = mockRoutesListData[3]; // Ferry route
	const mockRailRoute = mockRoutesListData[4]; // Sounder North Line

	const mockRouteWithShortAndDescription = {
		id: 'route_8',
		shortName: '8',
		description: 'Capitol Hill - South Lake Union',
		color: '008080',
		type: 3,
		agencyInfo: {
			id: '1',
			name: 'King County Metro'
		}
	};

	const mockRouteWithLongNameOnly = {
		id: 'route_express',
		longName: 'Express Service',
		color: 'FF6600',
		type: 3,
		agencyInfo: {
			name: 'Metro Transit'
		}
	};

	const mockRouteWithDescriptionOnly = {
		id: 'route_local',
		description: 'Local Service',
		color: '333333',
		type: 3,
		agencyInfo: {
			name: 'Sound Transit'
		}
	};

	test('displays route with short name and long name', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndLong,
				handleModalRouteClick
			}
		});

		expect(screen.getByText('44 - Ballard - University District')).toBeInTheDocument();
	});

	test('displays route with short name and description when no long name', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndDescription,
				handleModalRouteClick
			}
		});

		expect(screen.getByText('8 - Capitol Hill - South Lake Union')).toBeInTheDocument();
	});

	test('displays route with agency name when no short name but has long name', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithLongNameOnly,
				handleModalRouteClick
			}
		});

		expect(screen.getByText('Metro Transit - Express Service')).toBeInTheDocument();
	});

	test('displays route with agency name when no short name but has description', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithDescriptionOnly,
				handleModalRouteClick
			}
		});

		expect(screen.getByText('Sound Transit - Local Service')).toBeInTheDocument();
	});

	test('applies route color as text color', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndLong,
				handleModalRouteClick
			}
		});

		const routeNameElement = screen.getByText('44 - Ballard - University District');
		expect(routeNameElement).toHaveStyle('color: #0066CC');
	});

	test('calls handleModalRouteClick when clicked', async () => {
		const user = userEvent.setup();
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndLong,
				handleModalRouteClick
			}
		});

		const button = screen.getByRole('button');
		await user.click(button);

		expect(handleModalRouteClick).toHaveBeenCalledWith(mockRouteWithShortAndLong);
		expect(handleModalRouteClick).toHaveBeenCalledTimes(1);
	});

	test('has proper button attributes and classes', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndLong,
				handleModalRouteClick
			}
		});

		const button = screen.getByRole('button');
		expect(button).toHaveAttribute('type', 'button');
		expect(button).toHaveClass('route-item');
		expect(button).toHaveClass('flex', 'w-full', 'items-center', 'justify-between');
		expect(button).toHaveClass('border-b', 'border-gray-200', 'bg-[#f9f9f9]');
		expect(button).toHaveClass('p-4', 'text-left');
		expect(button).toHaveClass('hover:bg-[#e9e9e9]', 'focus:outline-none');
	});

	test('route name has proper styling classes', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndLong,
				handleModalRouteClick
			}
		});

		const routeNameElement = screen.getByText('44 - Ballard - University District');
		expect(routeNameElement).toHaveClass('text-lg', 'font-semibold');
	});

	test('handles route with empty or missing properties gracefully', () => {
		const handleModalRouteClick = vi.fn();
		const emptyRoute = {
			id: 'empty_route',
			color: '000000'
		};

		// This should not throw an error
		expect(() => {
			render(RouteItem, {
				props: {
					route: emptyRoute,
					handleModalRouteClick
				}
			});
		}).not.toThrow();
	});

	test('is keyboard accessible', async () => {
		const user = userEvent.setup();
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndLong,
				handleModalRouteClick
			}
		});

		const button = screen.getByRole('button');

		// Focus the button
		button.focus();
		expect(button).toHaveFocus();

		// Activate with Enter key
		await user.keyboard('{Enter}');
		expect(handleModalRouteClick).toHaveBeenCalledWith(mockRouteWithShortAndLong);

		// Reset the mock
		handleModalRouteClick.mockClear();

		// Activate with Space key
		await user.keyboard(' ');
		expect(handleModalRouteClick).toHaveBeenCalledWith(mockRouteWithShortAndLong);
	});

	test('displays light rail route correctly', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockLightRailRoute,
				handleModalRouteClick
			}
		});

		expect(screen.getByText('1 Line - Seattle - University of Washington')).toBeInTheDocument();

		const routeNameElement = screen.getByText('1 Line - Seattle - University of Washington');
		expect(routeNameElement).toHaveStyle('color: #0077C0');
	});

	test('displays ferry route with agency name when no short name', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockFerryRoute,
				handleModalRouteClick
			}
		});

		expect(
			screen.getByText('Washington State Ferries - Fauntleroy - Vashon Island')
		).toBeInTheDocument();

		const routeNameElement = screen.getByText(
			'Washington State Ferries - Fauntleroy - Vashon Island'
		);
		expect(routeNameElement).toHaveStyle('color: #018571');
	});

	test('displays rail route correctly', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRailRoute,
				handleModalRouteClick
			}
		});

		expect(screen.getByText('N Line - Seattle - Everett')).toBeInTheDocument();

		const routeNameElement = screen.getByText('N Line - Seattle - Everett');
		expect(routeNameElement).toHaveStyle('color: #8CC8A0');
	});

	test('handles missing or invalid route colors gracefully', () => {
		const handleModalRouteClick = vi.fn();
		const routeWithoutColor = {
			...mockRouteWithShortAndLong,
			color: null
		};

		render(RouteItem, {
			props: {
				route: routeWithoutColor,
				handleModalRouteClick
			}
		});

		const routeNameElement = screen.getByText('44 - Ballard - University District');
		// Should still render without crashing
		expect(routeNameElement).toBeInTheDocument();
	});

	test('has proper ARIA attributes for accessibility', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndLong,
				handleModalRouteClick
			}
		});

		const button = screen.getByRole('button');

		// Button should be focusable and have proper role
		expect(button).toHaveAttribute('type', 'button');
		expect(button).not.toHaveAttribute('aria-hidden', 'true');

		// Should be accessible to screen readers
		expect(button).toBeVisible();
		expect(button).not.toHaveAttribute('tabindex', '-1');
	});

	test('provides meaningful accessible text for screen readers', () => {
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockLightRailRoute,
				handleModalRouteClick
			}
		});

		const button = screen.getByRole('button');
		const accessibleText = button.textContent;

		// Should contain route information that's meaningful to screen readers
		expect(accessibleText).toContain('1 Line');
		expect(accessibleText).toContain('Seattle - University of Washington');
	});

	test('handles extremely long route names without breaking layout', () => {
		const handleModalRouteClick = vi.fn();
		const routeWithLongName = {
			...mockRouteWithShortAndLong,
			shortName: 'VeryLongRouteNameThatCouldPotentiallyBreakLayout',
			longName:
				'This is an extremely long route name that could potentially cause layout issues if not handled properly in the component'
		};

		render(RouteItem, {
			props: {
				route: routeWithLongName,
				handleModalRouteClick
			}
		});

		// Should render without crashing
		expect(screen.getByRole('button')).toBeInTheDocument();
		expect(
			screen.getByText(/VeryLongRouteNameThatCouldPotentiallyBreakLayout/)
		).toBeInTheDocument();
	});

	test('maintains proper focus management', async () => {
		const user = userEvent.setup();
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndLong,
				handleModalRouteClick
			}
		});

		const button = screen.getByRole('button');

		// Should be able to receive focus
		await user.tab();
		expect(button).toHaveFocus();

		// Should be able to lose focus
		await user.tab();
		expect(button).not.toHaveFocus();
	});

	test('handles click and keyboard events properly', async () => {
		const user = userEvent.setup();
		const handleModalRouteClick = vi.fn();

		render(RouteItem, {
			props: {
				route: mockRouteWithShortAndLong,
				handleModalRouteClick
			}
		});

		const button = screen.getByRole('button');

		// Test mouse click
		await user.click(button);
		expect(handleModalRouteClick).toHaveBeenCalledTimes(1);
		expect(handleModalRouteClick).toHaveBeenCalledWith(mockRouteWithShortAndLong);

		handleModalRouteClick.mockClear();

		// Test Enter key
		button.focus();
		await user.keyboard('{Enter}');
		expect(handleModalRouteClick).toHaveBeenCalledTimes(1);
		expect(handleModalRouteClick).toHaveBeenCalledWith(mockRouteWithShortAndLong);

		handleModalRouteClick.mockClear();

		// Test Space key
		await user.keyboard(' ');
		expect(handleModalRouteClick).toHaveBeenCalledTimes(1);
		expect(handleModalRouteClick).toHaveBeenCalledWith(mockRouteWithShortAndLong);
	});

	test('displays route colors correctly', () => {
		const handleModalRouteClick = vi.fn();

		// Test dark color route
		const darkRoute = {
			...mockRouteWithShortAndLong,
			color: '000000'
		};

		render(RouteItem, {
			props: {
				route: darkRoute,
				handleModalRouteClick
			}
		});

		const darkRouteElement = screen.getByText('44 - Ballard - University District');
		expect(darkRouteElement).toHaveStyle('color: #000000');
	});

	test('handles various route color formats', () => {
		const handleModalRouteClick = vi.fn();

		// Test with different color format (no # prefix)
		const redRoute = {
			...mockRouteWithShortAndLong,
			color: 'FF0000'
		};

		render(RouteItem, {
			props: {
				route: redRoute,
				handleModalRouteClick
			}
		});

		const redRouteElement = screen.getByText('44 - Ballard - University District');
		expect(redRouteElement).toHaveStyle('color: #FF0000');
	});
});
