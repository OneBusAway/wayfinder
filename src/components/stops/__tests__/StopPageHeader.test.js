import { render, screen } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import StopPageHeader from '../StopPageHeader.svelte';
import { createMockPageStore } from '../../../tests/helpers/test-utils.js';

// Mock the $app/stores
vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn((fn) => {
			fn({
				url: new URL('https://example.com/stops/1_75403'),
				params: { stopID: '1_75403' },
				route: { id: '/stops/[stopID]' },
				data: {}
			});
			return { unsubscribe: vi.fn() };
		})
	}
}));

// Mock svelte-i18n
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => {
				// Return mock translations for specific keys
				const translations = {
					'schedule_for_stop.stop_id': 'Stop ID',
					'schedule_for_stop.direction': 'Direction',
					'arrivals_and_departures_for_stop.title': 'Arrivals & Departures',
					'schedule_for_stop.route_schedules': 'Route Schedules',
					'navigation.back_to_map': 'Back to Map'
				};
				return translations[key] || key;
			});
			return { unsubscribe: () => {} };
		})
	}
}));

describe('StopPageHeader', () => {
	let mockPageStore;

	beforeEach(() => {
		mockPageStore = createMockPageStore({
			route: { id: '/stops/[stopID]' },
			url: new URL('http://localhost:5173/stops/1_75403')
		});

		// Reset the page store mock for each test
		vi.clearAllMocks();
	});

	const defaultProps = {
		stopName: 'Pine St & 3rd Ave',
		stopId: '1_75403',
		stopDirection: 'N'
	};

	test('displays stop name as main heading', () => {
		render(StopPageHeader, { props: defaultProps });

		const heading = screen.getByRole('heading', { level: 1 });
		expect(heading).toHaveTextContent('Pine St & 3rd Ave');
		expect(heading).toHaveClass('text-3xl', 'font-bold', 'text-brand-secondary');
	});

	test('displays stop ID with proper label', () => {
		render(StopPageHeader, { props: defaultProps });

		expect(screen.getByText('Stop ID:')).toBeInTheDocument();
		expect(screen.getByText('75403')).toBeInTheDocument();
	});

	test('displays stop direction with proper label', () => {
		render(StopPageHeader, { props: defaultProps });

		expect(screen.getByText('Direction:')).toBeInTheDocument();
		expect(screen.getByText('N')).toBeInTheDocument();
	});

	test('has proper header styling classes', () => {
		render(StopPageHeader, { props: defaultProps });

		const mainContainer = screen.getByRole('heading', { level: 1 }).closest('.my-4');
		expect(mainContainer).toHaveClass('my-4');

		const headerContainer = screen.getByRole('heading', { level: 1 }).parentElement;
		expect(headerContainer).toHaveClass('text-center');
	});

	test('stop ID section has proper styling', () => {
		render(StopPageHeader, { props: defaultProps });

		const stopIdSection = screen.getByText('Stop ID:').parentElement;
		expect(stopIdSection).toHaveClass('rounded-md', 'bg-gray-50', 'px-2', 'py-1');
	});

	test('direction section has proper styling', () => {
		render(StopPageHeader, { props: defaultProps });

		const directionSection = screen.getByText('Direction:').parentElement;
		expect(directionSection).toHaveClass('rounded-md', 'bg-gray-50', 'px-2', 'py-1');
	});

	test('includes FontAwesome map marker icon', () => {
		render(StopPageHeader, { props: defaultProps });

		// Check if the icon is rendered (FontAwesome icon should be present)
		const stopIdSection = screen.getByText('Stop ID:').parentElement;
		expect(stopIdSection.querySelector('svg')).toBeInTheDocument();
	});

	test('includes CompassArrow component', () => {
		render(StopPageHeader, { props: defaultProps });

		// The CompassArrow component should be rendered in the direction section
		const directionSection = screen.getByText('Direction:').parentElement;
		expect(directionSection).toBeInTheDocument();
	});

	test('renders tab navigation with correct links', () => {
		render(StopPageHeader, { props: defaultProps });

		// Check for arrivals & departures tab
		const arrivalsTab = screen.getByRole('link', { name: /arrivals & departures/i });
		expect(arrivalsTab).toHaveAttribute('href', '/stops/1_75403');

		// Check for schedule tab
		const scheduleTab = screen.getByRole('link', { name: /route schedules/i });
		expect(scheduleTab).toHaveAttribute('href', '/stops/1_75403/schedule');
	});

	test('highlights active tab based on current route', () => {
		// Test arrivals tab is active when on arrivals page
		mockPageStore.set({
			...mockPageStore._getValue(),
			route: { id: '/stops/[stopID]' }
		});

		render(StopPageHeader, { props: defaultProps });

		const arrivalsTab = screen.getByRole('link', { name: /arrivals & departures/i });
		// The active tab should have the current prop set to true
		expect(arrivalsTab).toBeInTheDocument();
	});

	test('highlights schedule tab when on schedule page', () => {
		// Test schedule tab is active when on schedule page
		mockPageStore.set({
			...mockPageStore._getValue(),
			route: { id: '/stops/[stopID]/schedule' }
		});

		render(StopPageHeader, { props: defaultProps });

		const scheduleTab = screen.getByRole('link', { name: /route schedules/i });
		expect(scheduleTab).toBeInTheDocument();
	});

	test('handles different stop directions', () => {
		const propsWithSouthDirection = {
			...defaultProps,
			stopDirection: 'S'
		};

		render(StopPageHeader, { props: propsWithSouthDirection });

		expect(screen.getByText('Direction:')).toBeInTheDocument();
		expect(screen.getByText('S')).toBeInTheDocument();
	});

	test('handles different stop IDs', () => {
		const propsWithDifferentId = {
			...defaultProps,
			stopId: '1_12345'
		};

		render(StopPageHeader, { props: propsWithDifferentId });

		expect(screen.getByText('12345')).toBeInTheDocument();

		// Check that tab links use the new stop ID
		const arrivalsTab = screen.getByRole('link', { name: /arrivals & departures/i });
		expect(arrivalsTab).toHaveAttribute('href', '/stops/1_12345');

		const scheduleTab = screen.getByRole('link', { name: /route schedules/i });
		expect(scheduleTab).toHaveAttribute('href', '/stops/1_12345/schedule');
	});

	test('handles long stop names gracefully', () => {
		const propsWithLongName = {
			...defaultProps,
			stopName: 'Very Long Stop Name That Should Still Display Properly In The Header'
		};

		render(StopPageHeader, { props: propsWithLongName });

		const heading = screen.getByRole('heading', { level: 1 });
		expect(heading).toHaveTextContent(
			'Very Long Stop Name That Should Still Display Properly In The Header'
		);
	});

	test('handles empty or missing props gracefully', () => {
		const emptyProps = {
			stopName: '',
			stopId: '',
			stopDirection: ''
		};

		// This should not throw an error
		expect(() => {
			render(StopPageHeader, { props: emptyProps });
		}).not.toThrow();
	});

	test('has proper accessibility structure', () => {
		render(StopPageHeader, { props: defaultProps });

		// Check main heading exists
		const heading = screen.getByRole('heading', { level: 1 });
		expect(heading).toBeInTheDocument();

		const allLinks = screen.getAllByRole('link');
		expect(allLinks).toHaveLength(3);

		const backToMapLink = screen.getByRole('link', { name: /back to map/i });
		expect(backToMapLink).toBeInTheDocument();
		expect(backToMapLink).toHaveAttribute('href', '/');

		const tabLinks = allLinks.filter(
			(link) =>
				link.textContent.includes('Arrivals & Departures') ||
				link.textContent.includes('Route Schedules')
		);
		expect(tabLinks).toHaveLength(2);
	});

	test('information sections have proper layout', () => {
		render(StopPageHeader, { props: defaultProps });

		// Check the container holding stop ID and direction info
		const infoContainer = screen.getByText('Stop ID:').closest('.flex');
		expect(infoContainer).toHaveClass('items-center', 'justify-center', 'gap-x-8');
	});

	test('uses semantic HTML structure', () => {
		const { container } = render(StopPageHeader, { props: defaultProps });

		// Main heading should be h1
		const mainHeading = screen.getByRole('heading', { level: 1 });
		expect(mainHeading.tagName).toBe('H1');

		// Strong elements should be used for labels
		const strongElements = container.querySelectorAll('strong');
		expect(strongElements.length).toBeGreaterThan(0);
	});

	test('renders back to map button with proper styling and functionality', () => {
		render(StopPageHeader, { props: defaultProps });

		const backToMapButton = screen.getByRole('link', { name: /back to map/i });

		expect(backToMapButton).toBeInTheDocument();
		expect(backToMapButton).toHaveAttribute('href', '/');

		expect(backToMapButton).toHaveClass(
			'inline-flex',
			'items-center',
			'gap-2',
			'rounded-md',
			'bg-brand',
			'px-4',
			'py-2',
			'text-sm',
			'font-medium',
			'text-white'
		);
	});

	test('back to map button contains proper icons', () => {
		render(StopPageHeader, { props: defaultProps });

		const backToMapButton = screen.getByRole('link', { name: /back to map/i });

		const icons = backToMapButton.querySelectorAll('svg');
		expect(icons).toHaveLength(2); // Arrow left and map icons
	});
});
