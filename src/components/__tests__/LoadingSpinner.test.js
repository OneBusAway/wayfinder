import { render, screen } from '@testing-library/svelte';
import { expect, test, describe } from 'vitest';
import LoadingSpinner from '../LoadingSpinner.svelte';

describe('LoadingSpinner', () => {
	test('displays loading spinner with localized text', () => {
		render(LoadingSpinner);

		// Check for the loading text (mocked to return the key)
		expect(screen.getByText('loading...')).toBeInTheDocument();

		// Check for the spinner SVG by class
		const { container } = render(LoadingSpinner);
		const spinner = container.querySelector('.animate-spin');
		expect(spinner).toBeInTheDocument();
	});

	test('has correct CSS classes for styling', () => {
		const { container } = render(LoadingSpinner);

		const outerDiv = container.firstChild;
		expect(outerDiv).toHaveClass(
			'absolute',
			'inset-0',
			'z-50',
			'flex',
			'items-center',
			'justify-center'
		);
		expect(outerDiv).toHaveClass('bg-neutral-800', 'bg-opacity-80', 'md:rounded-lg');
	});

	test('has proper structure for accessibility', () => {
		const { container } = render(LoadingSpinner);

		// The outer container should be accessible as a loading indicator
		const loadingContainer = container.firstChild;
		expect(loadingContainer).toBeInTheDocument();

		// Check for the loading text
		const loadingText = screen.getByText('loading...');
		expect(loadingText).toBeInTheDocument();
		expect(loadingText.closest('div')).toHaveClass('text-white');
	});

	test('spinner SVG has correct attributes', () => {
		const { container } = render(LoadingSpinner);

		const svg = container.querySelector('svg');
		expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
		expect(svg).toHaveAttribute('fill', 'none');
		expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
	});
});
