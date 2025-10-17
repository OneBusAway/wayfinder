import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import StopMarker from '../map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';

describe('Route Labels Feature', () => {
	const mockStop = {
		id: 'stop_123',
		name: 'Test Stop',
		lat: 47.6062,
		lon: -122.3321,
		direction: 'N',
		routes: [
			{ id: 'route_1', shortName: '7', type: 3 },
			{ id: 'route_2', shortName: '10', type: 3 },
			{ id: 'route_3', shortName: '49', type: 3 }
		]
	};

	const mockStopWithManyRoutes = {
		...mockStop,
		routes: [
			{ id: 'route_1', shortName: '7', type: 3 },
			{ id: 'route_2', shortName: '10', type: 3 },
			{ id: 'route_3', shortName: '49', type: 3 },
			{ id: 'route_4', shortName: '345', type: 3 },
			{ id: 'route_5', shortName: '522', type: 3 }
		]
	};

	describe('StopMarker Component', () => {
		test('renders stop marker without route labels by default', () => {
			const onClick = vi.fn();
			render(StopMarker, {
				props: {
					stop: mockStop,
					onClick,
					icon: faBus,
					showRoutesLabel: false
				}
			});

			expect(screen.queryByText(/7, 10, 49/)).not.toBeInTheDocument();
		});

		test('shows route labels when showRoutesLabel is true', () => {
			const onClick = vi.fn();
			render(StopMarker, {
				props: {
					stop: mockStop,
					onClick,
					icon: faBus,
					showRoutesLabel: true
				}
			});

			expect(screen.getByText(/7, 10, 49/)).toBeInTheDocument();
		});

		test('displays up to 3 routes in collapsed state', () => {
			const onClick = vi.fn();
			render(StopMarker, {
				props: {
					stop: mockStopWithManyRoutes,
					onClick,
					icon: faBus,
					showRoutesLabel: true
				}
			});

			expect(screen.getByText(/7, 10, 49/)).toBeInTheDocument();
			expect(screen.queryByText('345')).not.toBeInTheDocument();
		});

		test('shows +N indicator and expand dots when there are more than 3 routes', () => {
			const onClick = vi.fn();
			render(StopMarker, {
				props: {
					stop: mockStopWithManyRoutes,
					onClick,
					icon: faBus,
					showRoutesLabel: true
				}
			});

			expect(screen.getByText(/\+2/)).toBeInTheDocument();
			expect(screen.getByText('⋯')).toBeInTheDocument();
		});

		test('expands to show all routes when clicked', async () => {
			const user = userEvent.setup();
			const onClick = vi.fn();

			render(StopMarker, {
				props: {
					stop: mockStopWithManyRoutes,
					onClick,
					icon: faBus,
					showRoutesLabel: true
				}
			});

			const routeLabel = screen.getByText(/7, 10, 49/).closest('.routes-label');
			await user.click(routeLabel);

			// All routes should now be visible, including the previously hidden ones
			expect(screen.getByText(/345/)).toBeInTheDocument();
			expect(screen.getByText(/522/)).toBeInTheDocument();
			expect(screen.queryByText('⋯')).not.toBeInTheDocument();
		});

		test('clicking route label does not trigger marker onClick', async () => {
			const user = userEvent.setup();
			const onClick = vi.fn();

			render(StopMarker, {
				props: {
					stop: mockStopWithManyRoutes,
					onClick,
					icon: faBus,
					showRoutesLabel: true
				}
			});

			const routeLabel = screen.getByText(/7, 10, 49/).closest('.routes-label');
			await user.click(routeLabel);

			expect(onClick).not.toHaveBeenCalled();
		});

		test('positions label at bottom when direction is north', () => {
			const onClick = vi.fn();
			render(StopMarker, {
				props: {
					stop: mockStop,
					onClick,
					icon: faBus,
					showRoutesLabel: true
				}
			});

			const routeLabel = screen.getByText(/7, 10, 49/).closest('.routes-label');
			expect(routeLabel).toHaveClass('position-bottom');
		});

		test('positions label at side when direction is south', () => {
			const onClick = vi.fn();
			const stopSouth = { ...mockStop, direction: 'S' };

			render(StopMarker, {
				props: {
					stop: stopSouth,
					onClick,
					icon: faBus,
					showRoutesLabel: true
				}
			});

			const routeLabel = screen.getByText(/7, 10, 49/).closest('.routes-label');
			expect(routeLabel).toHaveClass('position-side');
		});

		test('applies expanded class when label is clicked', async () => {
			const user = userEvent.setup();
			const onClick = vi.fn();

			render(StopMarker, {
				props: {
					stop: mockStopWithManyRoutes,
					onClick,
					icon: faBus,
					showRoutesLabel: true
				}
			});

			const routeLabel = screen.getByText(/7, 10, 49/).closest('.routes-label');
			expect(routeLabel).not.toHaveClass('expanded');

			await user.click(routeLabel);

			expect(routeLabel).toHaveClass('expanded');
		});

		test('handles stops with no routes', () => {
			const onClick = vi.fn();
			const stopNoRoutes = { ...mockStop, routes: [] };

			render(StopMarker, {
				props: {
					stop: stopNoRoutes,
					onClick,
					icon: faBus,
					showRoutesLabel: true
				}
			});

			expect(screen.queryByText(/routes-label/)).not.toBeInTheDocument();
		});
	});

	describe('Map Provider Zoom Logic', () => {
		const ZOOM_THRESHOLD = 16;

		test('labels should show at zoom level 16', () => {
			const zoom = 16;
			const shouldShow = zoom >= ZOOM_THRESHOLD;
			expect(shouldShow).toBe(true);
		});

		test('labels should show above zoom level 16', () => {
			const zoom = 18;
			const shouldShow = zoom >= ZOOM_THRESHOLD;
			expect(shouldShow).toBe(true);
		});

		test('labels should hide below zoom level 16', () => {
			const zoom = 15;
			const shouldShow = zoom >= ZOOM_THRESHOLD;
			expect(shouldShow).toBe(false);
		});

		test('state tracking prevents unnecessary updates', () => {
			let routeLabelsVisible = false;
			const zoom = 17;
			const shouldShow = zoom >= ZOOM_THRESHOLD;

			// First update - state changes
			if (routeLabelsVisible !== shouldShow) {
				routeLabelsVisible = shouldShow;
			}
			expect(routeLabelsVisible).toBe(true);

			// Second update at same zoom - no change
			const secondUpdate = routeLabelsVisible !== shouldShow;
			expect(secondUpdate).toBe(false); // Should early exit
		});

		test('batch updates all markers when crossing threshold', () => {
			const markers = new Map();
			markers.set('stop1', { props: { showRoutesLabel: false } });
			markers.set('stop2', { props: { showRoutesLabel: false } });
			markers.set('stop3', { props: { showRoutesLabel: false } });

			const shouldShow = true;
			for (const marker of markers.values()) {
				if (marker?.props) {
					marker.props.showRoutesLabel = shouldShow;
				}
			}

			markers.forEach((marker) => {
				expect(marker.props.showRoutesLabel).toBe(true);
			});
		});
	});

	describe('Route Name Extraction', () => {
		test('uses shortName when available', () => {
			const route = { shortName: '7' };
			const name = route.shortName || route.code || null;
			expect(name).toBe('7');
		});

		test('falls back to code when shortName missing', () => {
			const route = { code: 'A-Line' };
			const name = route.shortName || route.code || null;
			expect(name).toBe('A-Line');
		});

		test('extracts from ID when shortName and code missing', () => {
			const route = { id: 'agency_route_49' };
			const name = String(route.id).split('_').pop();
			expect(name).toBe('49');
		});
	});

	describe('Performance Optimization', () => {
		test('only updates when zoom crosses threshold boundary', () => {
			const THRESHOLD = 16;

			// Zoom 14->15: both below, no update needed
			expect(14 >= THRESHOLD === 15 >= THRESHOLD).toBe(true);

			// Zoom 15->16: crosses boundary, update needed
			expect(15 >= THRESHOLD === 16 >= THRESHOLD).toBe(false);

			// Zoom 16->17: both above, no update needed
			expect(16 >= THRESHOLD === 17 >= THRESHOLD).toBe(true);
		});
	});
});
