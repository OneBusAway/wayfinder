import { render, screen } from '@testing-library/svelte';
import { describe, test, expect, vi } from 'vitest';
import { BusFront } from '@lucide/svelte';
import StopMarker from '../StopMarker.svelte';

const stop = {
	id: 'stop_1',
	name: 'California Ave SW & Fauntleroy Way SW',
	direction: 'N',
	routes: []
};

function renderMarker(props = {}) {
	return render(StopMarker, {
		props: { stop, icon: BusFront, onClick: vi.fn(), ...props }
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

	// jsdom doesn't load component <style> blocks (no `css: true` in the vitest
	// config), so @apply-generated Tailwind utilities never resolve here and a
	// getComputedStyle assertion would be meaningless either way. What actually
	// makes `:global(.dark) .highlight .direction-arrow { @apply text-brand; }`
	// win is the caret's <svg> staying classless: an element's own directly
	// matching class (e.g. a `dark:text-white` class landing on
	// the rendered <svg>) always beats a rule inherited from an ancestor,
	// regardless of the ancestor's specificity. Lock down that markup contract.
	test('highlighted caret svg has no color class of its own, so it inherits from .direction-arrow', () => {
		const { container } = renderMarker({ isHighlighted: true });
		const directionArrow = container.querySelector('.direction-arrow');
		expect(directionArrow).toHaveClass('dark:text-white');
		const caretSvg = directionArrow.querySelector('svg');
		expect(caretSvg).not.toHaveClass('dark:text-white');
		expect(caretSvg.getAttribute('class') ?? '').not.toMatch(/text-/);
	});

	test.each(['full', 'routeDot', 'muted'])(
		'keeps an accessible 32px button in the %s tier',
		(emphasis) => {
			renderMarker({ emphasis, dotColor: '#b02a37' });
			const button = screen.getByRole('button', { name: stop.name });
			expect(button).toHaveClass('marker-hit-area', 'h-8', 'w-8');
		}
	);

	test.each(['routeDot', 'muted'])('hides the routes label in the %s tier', (emphasis) => {
		const withRoutes = { ...stop, routes: [{ shortName: 'C' }, { shortName: '22' }] };
		render(StopMarker, {
			props: { stop: withRoutes, icon: BusFront, onClick: vi.fn(), showRoutesLabel: true, emphasis }
		});
		expect(screen.queryByText('C, 22')).not.toBeInTheDocument();
	});

	test('shows the routes label in the full tier', () => {
		const withRoutes = { ...stop, routes: [{ shortName: 'C' }, { shortName: '22' }] };
		render(StopMarker, {
			props: {
				stop: withRoutes,
				icon: BusFront,
				onClick: vi.fn(),
				showRoutesLabel: true,
				emphasis: 'full'
			}
		});
		expect(screen.getByText('C, 22')).toBeInTheDocument();
	});
});
