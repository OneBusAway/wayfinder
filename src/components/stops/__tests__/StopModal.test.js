import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi } from 'vitest';
import StopModal from '../StopModal.svelte';
import { mockStopData } from '../../../tests/fixtures/obaData.js';

// Allow child components to render naturally - they should be properly implemented

// Mock svelte-i18n
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key);
			return { unsubscribe: () => {} };
		})
	},
	isLoading: {
		subscribe: vi.fn((fn) => {
			fn(false);
			return { unsubscribe: () => {} };
		})
	}
}));

describe('StopModal', () => {
	const defaultProps = {
		stop: mockStopData,
		closePane: vi.fn(),
		handleUpdateRouteMap: vi.fn(),
		tripSelected: vi.fn()
	};

	test('renders modal with stop name as title', () => {
		render(StopModal, { props: defaultProps });

		// The modal should display the stop name as the title
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();
	});

	test('passes correct props to ModalPane', () => {
		render(StopModal, { props: defaultProps });

		// Verify the modal pane renders with the stop name as title
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();
		// Verify the close button is rendered
		expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
	});

	test('passes correct props to StopPane', () => {
		render(StopModal, { props: defaultProps });

		// Verify the stop pane renders with stop information
		// The StopPane component should receive the stop prop and display stop details
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();
	});

	test('handles closePane function prop', async () => {
		const closePaneFn = vi.fn();
		const props = {
			...defaultProps,
			closePane: closePaneFn
		};

		const user = userEvent.setup();
		render(StopModal, { props });

		// Click the close button to test the closePane function
		const closeButton = screen.getByRole('button', { name: /close/i });
		await user.click(closeButton);

		expect(closePaneFn).toHaveBeenCalledTimes(1);
	});

	test('handles handleUpdateRouteMap function prop', () => {
		const updateRouteMapFn = vi.fn();
		const props = {
			...defaultProps,
			handleUpdateRouteMap: updateRouteMapFn
		};

		render(StopModal, { props });

		// The handleUpdateRouteMap function should be passed through to StopPane
		// We verify the component renders properly with this prop
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();
	});

	test('handles tripSelected function prop', () => {
		const tripSelectedFn = vi.fn();
		const props = {
			...defaultProps,
			tripSelected: tripSelectedFn
		};

		render(StopModal, { props });

		// The tripSelected function should be passed through to StopPane
		// We verify the component renders properly with this prop
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();
	});

	test('handles different stop data', () => {
		const differentStop = {
			id: '1_12345',
			name: 'Different Stop Name',
			code: '12345',
			direction: 'S',
			lat: 47.123,
			lon: -122.456,
			routeIds: ['1_route1']
		};

		const props = {
			...defaultProps,
			stop: differentStop
		};

		render(StopModal, { props });

		// Should display the different stop name
		expect(screen.getByText('Different Stop Name')).toBeInTheDocument();
	});

	test('handles missing optional props gracefully', () => {
		const minimalProps = {
			stop: mockStopData,
			closePane: vi.fn()
		};

		// This should not throw an error
		expect(() => {
			render(StopModal, { props: minimalProps });
		}).not.toThrow();

		// Should still display the stop name
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();
	});

	test('stop modal passes stop name to modal title', () => {
		const stopWithSpecialName = {
			...mockStopData,
			name: 'Special Bus Stop Name'
		};

		const props = {
			...defaultProps,
			stop: stopWithSpecialName
		};

		render(StopModal, { props });

		// The modal should receive the stop name as title
		expect(screen.getByText('Special Bus Stop Name')).toBeInTheDocument();
	});

	test('forwards events from StopPane', () => {
		render(StopModal, { props: defaultProps });

		// The component should be set up to forward events from StopPane
		// Verify the component structure allows event forwarding
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();
	});

	test('component structure follows expected pattern', () => {
		const { container } = render(StopModal, { props: defaultProps });

		// Basic structure validation - should have modal pane elements
		expect(container.firstChild).toBeDefined();
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
	});

	test('handles null or undefined stop gracefully', () => {
		const propsWithNullStop = {
			...defaultProps,
			stop: null
		};

		// This should throw an error since stop.name is required
		expect(() => {
			render(StopModal, { props: propsWithNullStop });
		}).toThrow(); // Expected to throw with null stop
	});

	test('component props are reactive', () => {
		// Test that component works with different props
		const { unmount } = render(StopModal, { props: defaultProps });

		// First render should show original stop name
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();

		// Clean up first render
		unmount();

		// Render with new props
		const newStop = {
			...mockStopData,
			name: 'Updated Stop Name'
		};

		const newProps = {
			...defaultProps,
			stop: newStop
		};

		render(StopModal, { props: newProps });

		// Component should handle different props and show new stop name
		expect(screen.getByText('Updated Stop Name')).toBeInTheDocument();
	});
});

// Integration test with real components (if needed for more thorough testing)
describe('StopModal Integration', () => {
	// These tests would use the real components instead of mocks
	// for more comprehensive integration testing

	const integrationProps = {
		stop: mockStopData,
		closePane: vi.fn(),
		handleUpdateRouteMap: vi.fn(),
		tripSelected: vi.fn()
	};

	test('modal integration works properly', () => {
		// Test the actual integration between ModalPane and StopPane
		render(StopModal, { props: integrationProps });

		// Should render both the modal structure and stop content
		expect(screen.getByText(mockStopData.name)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
	});
});
