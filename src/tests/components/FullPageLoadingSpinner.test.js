import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import FullPageLoadingSpinner from '../../components/FullPageLoadingSpinner.svelte';

describe('FullPageLoadingSpinner', () => {
  	it('renders with role="status"', () => {
      		render(FullPageLoadingSpinner);
      		const spinner = screen.getByRole('status');
      		expect(spinner).toBeTruthy();
    });

         	it('has an aria-label attribute', () => {
            		render(FullPageLoadingSpinner);
            		const spinner = screen.getByRole('status');
            		expect(spinner).toHaveAttribute('aria-label');
          });

         	it('has aria-live="polite"', () => {
            		render(FullPageLoadingSpinner);
            		const spinner = screen.getByRole('status');
            		expect(spinner).toHaveAttribute('aria-live', 'polite');
          });

         	it('renders the loading text', () => {
            		render(FullPageLoadingSpinner);
            		// The i18n mock returns the key as the value, so 'loading' is the displayed text
             		const loadingText = screen.getByText('loading');
            		expect(loadingText).toBeTruthy();
          });
});
