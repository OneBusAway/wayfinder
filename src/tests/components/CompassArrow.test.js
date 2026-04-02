import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import CompassArrow from '../../components/controls/CompassArrow.svelte';

describe('CompassArrow', () => {
  	const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

         	directions.forEach((stopDirection) => {
            		it(`renders without the "hidden" class for direction "${stopDirection}"`, () => {
                  			const { container } = render(CompassArrow, { props: { stopDirection } });
                  			// FontAwesomeIcon renders an SVG — check that element exists
                   			const svg = container.querySelector('svg');
                  			expect(svg).toBeTruthy();
                  			// Known directions should not render with 'hidden' class
                   			expect(svg.getAttribute('class') || '').not.toContain('hidden');
                });
          });

         	it('renders with "hidden" class for an unknown direction', () => {
            		const { container } = render(CompassArrow, { props: { stopDirection: 'UNKNOWN' } });
            		const svg = container.querySelector('svg');
            		expect(svg).toBeTruthy();
            		expect(svg.getAttribute('class') || '').toContain('hidden');
          });

         	it('renders with "hidden" class when no direction is provided', () => {
            		const { container } = render(CompassArrow, {});
            		const svg = container.querySelector('svg');
            		expect(svg).toBeTruthy();
            		expect(svg.getAttribute('class') || '').toContain('hidden');
          });
});
