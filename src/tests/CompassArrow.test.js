import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CompassArrow from '$components/controls/CompassArrow.svelte';

vi.mock('@fortawesome/svelte-fontawesome', async () => {
	const { default: FontAwesomeIcon } = await import('./mocks/FontAwesomeIconMock.svelte');
	return { FontAwesomeIcon };
});

describe('CompassArrow', () => {
	it('renders', () => {
		const { container } = render(CompassArrow, { props: { heading: 0 } });

		expect(container.querySelector('[data-testid="fontawesome-mock"]')).toBeInTheDocument();
	});

	it('sets transform rotate(Ndeg) from the heading prop', () => {
		const { container } = render(CompassArrow, { props: { heading: 47.5 } });

		const rotator = container.querySelector('span.inline-block');
		expect(rotator).toBeTruthy();
		expect(rotator).toHaveStyle({ transform: 'rotate(47.5deg)' });
	});
});
