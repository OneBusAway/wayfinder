import { render, screen } from '@testing-library/svelte';
import { describe, test, expect, vi } from 'vitest';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import StopMarker from '../StopMarker.svelte';

const stop = {
	id: 'stop_1',
	name: 'California Ave SW & Fauntleroy Way SW',
	direction: 'N',
	routes: []
};

function renderMarker(props = {}) {
	return render(StopMarker, {
		props: { stop, icon: faBus, onClick: vi.fn(), ...props }
	});
}

describe('StopMarker emphasis', () => {
	test('renders the full pin by default', () => {
		const { container } = renderMarker();
		expect(container.querySelector('.custom-marker')).toBeInTheDocument();
		expect(container.querySelector('.emphasis-dot')).not.toBeInTheDocument();
	});

	test('renders a route-colored ring dot for routeDot', () => {
		const { container } = renderMarker({ emphasis: 'routeDot', dotColor: '#b02a37' });
		const dot = container.querySelector('.emphasis-dot.route-dot');
		expect(dot).toBeInTheDocument();
		expect(dot).toHaveStyle('border-color: #b02a37');
		expect(container.querySelector('.bus-icon')).not.toBeInTheDocument();
	});

	test('renders a quiet gray dot for muted', () => {
		const { container } = renderMarker({ emphasis: 'muted' });
		expect(container.querySelector('.emphasis-dot.muted-dot')).toBeInTheDocument();
		expect(container.querySelector('.bus-icon')).not.toBeInTheDocument();
	});

	// The selected stop is always in the ring-dot set (those are the trips that
	// serve it), so these two props WILL collide. isHighlighted has to win, or the
	// rider's selected stop becomes the least distinguishable thing on the map.
	test('isHighlighted wins over routeDot', () => {
		const { container } = renderMarker({
			emphasis: 'routeDot',
			dotColor: '#b02a37',
			isHighlighted: true
		});
		expect(container.querySelector('.custom-marker.highlight')).toBeInTheDocument();
		expect(container.querySelector('.emphasis-dot')).not.toBeInTheDocument();
	});

	test.each(['full', 'routeDot', 'muted'])(
		'keeps an accessible 32px button in the %s tier',
		(emphasis) => {
			const { container } = renderMarker({ emphasis, dotColor: '#b02a37' });
			const button = screen.getByRole('button', { name: stop.name });
			expect(button).toBeInTheDocument();
			expect(container.querySelector('.marker-hit-area')).toBeInTheDocument();
		}
	);

	test.each(['routeDot', 'muted'])('hides the routes label in the %s tier', (emphasis) => {
		const withRoutes = { ...stop, routes: [{ shortName: 'C' }, { shortName: '22' }] };
		render(StopMarker, {
			props: { stop: withRoutes, icon: faBus, onClick: vi.fn(), showRoutesLabel: true, emphasis }
		});
		expect(screen.queryByText('C, 22')).not.toBeInTheDocument();
	});

	test('shows the routes label in the full tier', () => {
		const withRoutes = { ...stop, routes: [{ shortName: 'C' }, { shortName: '22' }] };
		render(StopMarker, {
			props: {
				stop: withRoutes,
				icon: faBus,
				onClick: vi.fn(),
				showRoutesLabel: true,
				emphasis: 'full'
			}
		});
		expect(screen.getByText('C, 22')).toBeInTheDocument();
	});
});
