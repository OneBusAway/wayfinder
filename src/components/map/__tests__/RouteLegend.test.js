import { render, screen } from '@testing-library/svelte';
import { describe, test, expect } from 'vitest';
import RouteLegend from '../RouteLegend.svelte';

const routes = [
	{ id: 'r_c', shortName: 'C Line', type: 3, tripId: 't_c', gtfsColor: 'b02a37' },
	{ id: 'r_22', shortName: '22', type: 3, tripId: 't_22', gtfsColor: 'e0a021' }
];
const colors = new Map([
	['r_c', { line: '#b02a37', badgeBg: 'b02a37', badgeFg: 'ffffff' }],
	['r_22', { line: '#e0a021', badgeBg: 'e0a021', badgeFg: '000000' }]
]);

describe('RouteLegend', () => {
	test('lists one row per drawn route', () => {
		render(RouteLegend, { props: { routes, routeColors: colors, liveCounts: new Map() } });
		expect(screen.getByText('C Line')).toBeInTheDocument();
		expect(screen.getByText('22')).toBeInTheDocument();
	});

	test('colors each swatch with its route color', () => {
		const { container } = render(RouteLegend, {
			props: { routes, routeColors: colors, liveCounts: new Map() }
		});
		const swatches = container.querySelectorAll('.legend-swatch');
		expect(swatches[0]).toHaveStyle('background-color: #b02a37');
	});

	test('shows the live vehicle count when there is one', () => {
		render(RouteLegend, {
			props: { routes, routeColors: colors, liveCounts: new Map([['r_c', 3]]) }
		});
		// The i18n mock echoes keys, so we expect to see the i18n key
		expect(screen.getByText('map.live_vehicle_count')).toBeInTheDocument();
	});

	test('renders nothing when no routes are drawn', () => {
		const { container } = render(RouteLegend, {
			props: { routes: [], routeColors: new Map(), liveCounts: new Map() }
		});
		expect(container.querySelector('.route-legend')).not.toBeInTheDocument();
	});
});
