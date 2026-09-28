import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';
import CompassArrow from '../CompassArrow.svelte';

function getArrowSpan(container) {
	return container.querySelector('[data-testid="compass-arrow"]');
}

describe('CompassArrow', () => {
	const cases = [
		['N', '-rotate-90'],
		['NE', '-rotate-45'],
		['E', 'rotate-0'],
		['SE', 'rotate-45'],
		['S', 'rotate-90'],
		['SW', 'rotate-135'],
		['W', 'rotate-180'],
		['NW', 'rotate-225']
	];

	test.each(cases)('applies %s rotation class', (direction, expectedClass) => {
		const { container } = render(CompassArrow, { props: { stopDirection: direction } });
		const span = getArrowSpan(container);

		expect(span).toBeInTheDocument();
		expect(span).toHaveClass(expectedClass);
		expect(span).not.toHaveClass('hidden');
	});

	test('hides the arrow when direction is missing', () => {
		const { container } = render(CompassArrow);
		const span = getArrowSpan(container);

		expect(span).toHaveClass('hidden');
	});

	test('hides the arrow when direction is empty', () => {
		const { container } = render(CompassArrow, { props: { stopDirection: '' } });

		expect(getArrowSpan(container)).toHaveClass('hidden');
	});

	test('hides the arrow when direction is unrecognized', () => {
		const { container } = render(CompassArrow, { props: { stopDirection: 'X' } });
		const span = getArrowSpan(container);

		expect(span).toHaveClass('hidden');
	});

	// Regression: verifies the rotation class is applied to the wrapper
	// span we control and updates reactively when `stopDirection` changes,
	// preventing stale icon rotation in `StopPageHeader`.
	test('updates the rotation class when stopDirection changes', async () => {
		const { container, rerender } = render(CompassArrow, {
			props: { stopDirection: '' }
		});

		expect(getArrowSpan(container)).toHaveClass('hidden');

		await rerender({ stopDirection: 'S' });

		const updatedSpan = getArrowSpan(container);
		expect(updatedSpan).toHaveClass('rotate-90');
		expect(updatedSpan).not.toHaveClass('hidden');
	});

	test('renders the FontAwesome arrow SVG inside the wrapper', () => {
		const { container } = render(CompassArrow, { props: { stopDirection: 'N' } });
		const span = getArrowSpan(container);

		expect(span.querySelector('svg')).toBeInTheDocument();
	});

	test('replaces the previous rotation when changing between valid directions', async () => {
		const { container, rerender } = render(CompassArrow, { props: { stopDirection: 'N' } });

		await rerender({ stopDirection: 'W' });

		const span = getArrowSpan(container);
		expect(span).toHaveClass('rotate-180');
		expect(span).not.toHaveClass('-rotate-90');
		expect(span).not.toHaveClass('hidden');
	});

	test.each(['', 'X'])(
		'hides a previously visible arrow when direction becomes "%s"',
		async (direction) => {
			const { container, rerender } = render(CompassArrow, { props: { stopDirection: 'N' } });

			await rerender({ stopDirection: direction });

			const span = getArrowSpan(container);
			expect(span).toHaveClass('hidden');
			expect(span).not.toHaveClass('-rotate-90');
		}
	);
});
