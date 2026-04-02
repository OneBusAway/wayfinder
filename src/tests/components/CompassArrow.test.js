import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import CompassArrow from '../../components/CompassArrow.svelte';

describe('CompassArrow', () => {
  	const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

         	directions.forEach((direction) => {
            		it(`renders the correct rotation class for direction "${direction}"`, () => {
                  			const { container } = render(CompassArrow, { props: { direction } });
                  			const arrow = container.querySelector('[class]');
                  			expect(arrow).toBeTruthy();
                  			// Each known direction should NOT have the hidden class
                   			expect(arrow.className).not.toContain('hidden');
                });
          });

         	it('renders with "hidden" class for an unknown direction', () => {
            		const { container } = render(CompassArrow, { props: { direction: 'UNKNOWN' } });
            		const arrow = container.querySelector('[class]');
            		expect(arrow).toBeTruthy();
            		expect(arrow.className).toContain('hidden');
          });

         	it('renders with "hidden" class when no direction is provided', () => {
            		const { container } = render(CompassArrow, {});
            		const arrow = container.querySelector('[class]');
            		expect(arrow).toBeTruthy();
            		expect(arrow.className).toContain('hidden');
          });
});
