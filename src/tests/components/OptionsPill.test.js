import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import OptionsPill from '../../components/trip-planner/OptionsPill.svelte';

describe('OptionsPill', () => {
  	it('renders the label text', () => {
      		render(OptionsPill, { props: { label: 'Walk', icon: '🚶' } });
      		expect(screen.getByText('🚶')).toBeTruthy();
      		expect(screen.getByText('Walk')).toBeTruthy();
    });

         	it('renders with only a label when no icon is provided', () => {
            		render(OptionsPill, { props: { label: 'No transfers' } });
            		expect(screen.getByText('No transfers')).toBeTruthy();
          });

         	it('renders a span element', () => {
            		const { container } = render(OptionsPill, { props: { label: 'Test', icon: '⭐' } });
            		const span = container.querySelector('span');
            		expect(span).toBeTruthy();
          });

         	it('renders with default empty values when no props are given', () => {
            		const { container } = render(OptionsPill, {});
            		const span = container.querySelector('span');
            		expect(span).toBeTruthy();
          });
});
