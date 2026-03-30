import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import TripPlanPinMarker from '../tripPlanPinMarker.svelte';

describe('TripPlanPinMarker', () => {
	it('renders the label text', () => {
		const { getByText } = render(TripPlanPinMarker, { props: { text: 'From' } });
		expect(getByText('From')).toBeInTheDocument();
	});

	it('uses brand-accent background and brand-foreground text on the bubble', () => {
		const { getByText } = render(TripPlanPinMarker, { props: { text: 'From' } });
		const bubble = getByText('From');
		expect(bubble).toHaveClass('bg-brand-accent', 'text-brand-foreground');
	});

	it('uses brand-accent fill on the pin SVG path', () => {
		const { container } = render(TripPlanPinMarker, { props: { text: 'To' } });
		const path = container.querySelector('svg path');
		expect(path).toHaveClass('fill-brand-accent');
	});

	it('does not contain hardcoded green color #79aa38', () => {
		const { container } = render(TripPlanPinMarker, { props: { text: 'From' } });
		const html = container.innerHTML;
		expect(html).not.toContain('#79aa38');
	});

	it('defaults text to "From"', () => {
		const { getByText } = render(TripPlanPinMarker);
		expect(getByText('From')).toBeInTheDocument();
	});
});
