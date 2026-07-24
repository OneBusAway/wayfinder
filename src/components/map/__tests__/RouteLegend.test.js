import { render, screen } from '@testing-library/svelte';
import { describe, test, expect, vi } from 'vitest';

// Local i18n mock that interpolates `values`.
//
// This appends each interpolated value to the key rather than substituting it
// into the key string. The key itself (e.g. "map.live_vehicle_count") never
// contains a literal placeholder to replace -- only a real translation
// message would -- so a mock that tries a `key.replace(...)` no-op would let
// an assertion pass even if the component never forwarded `values` to `$t()`
// at all. Appending the value instead means the test can only pass if the
// component actually forwards `values: { count }`.
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: (fn) => {
			fn((key, options) => {
				let str = key;
				if (options?.values) {
					for (const value of Object.values(options.values)) {
						str = `${str} ${value}`;
					}
				}
				return str;
			});
			return () => {};
		}
	},
	isLoading: {
		subscribe: (fn) => {
			fn(false);
			return () => {};
		}
	}
}));

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

	test('the swatch is decorative and hidden from assistive tech', () => {
		const { container } = render(RouteLegend, {
			props: { routes, routeColors: colors, liveCounts: new Map() }
		});
		const swatches = container.querySelectorAll('.legend-swatch');
		expect(swatches[0]).toHaveAttribute('aria-hidden', 'true');
	});

	test('shows the live vehicle count when there is a positive count', () => {
		render(RouteLegend, {
			props: { routes, routeColors: colors, liveCounts: new Map([['r_c', 3]]) }
		});
		expect(screen.getByText('map.live_vehicle_count 3')).toBeInTheDocument();
	});

	test('shows the live vehicle count when it is explicitly zero', () => {
		render(RouteLegend, {
			props: { routes, routeColors: colors, liveCounts: new Map([['r_c', 0]]) }
		});
		expect(screen.getByText('map.live_vehicle_count 0')).toBeInTheDocument();
	});

	test('shows nothing for a route absent from liveCounts (no data yet)', () => {
		// Only r_22 has polled successfully; r_c's fetch hasn't landed (or failed),
		// so it must render no count at all -- not even a blank/zero one.
		render(RouteLegend, {
			props: { routes, routeColors: colors, liveCounts: new Map([['r_22', 5]]) }
		});
		expect(screen.getByText('map.live_vehicle_count 5')).toBeInTheDocument();
		expect(screen.getAllByText(/map\.live_vehicle_count/)).toHaveLength(1);
	});

	test('renders nothing when no routes are drawn', () => {
		const { container } = render(RouteLegend, {
			props: { routes: [], routeColors: new Map(), liveCounts: new Map() }
		});
		expect(container.querySelector('.route-legend')).not.toBeInTheDocument();
	});
});
