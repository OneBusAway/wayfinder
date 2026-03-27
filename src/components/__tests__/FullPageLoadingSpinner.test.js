import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import FullPageLoadingSpinner from '$components/FullPageLoadingSpinner.svelte';

describe('FullPageLoadingSpinner', () => {
	it('renders when visible', () => {
		const { container } = render(FullPageLoadingSpinner, { props: { visible: true } });

		expect(screen.getByText('loading...')).toBeInTheDocument();
		expect(container.querySelector('.animate-spin')).toBeInTheDocument();
	});

	it('does not render when not visible', () => {
		const { container } = render(FullPageLoadingSpinner, { props: { visible: false } });

		expect(screen.queryByText('loading...')).not.toBeInTheDocument();
		expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
	});
});
