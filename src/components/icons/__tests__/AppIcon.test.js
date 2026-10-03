import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { MapPin } from '@lucide/svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import AppIcon from '../AppIcon.svelte';

describe('AppIcon', () => {
	test('renders a Font Awesome icon definition with FontAwesomeIcon', () => {
		const { container } = render(AppIcon, { props: { icon: faBus, class: 'text-lg' } });

		const svg = container.querySelector('svg');
		expect(svg).toBeInTheDocument();
		expect(svg).toHaveAttribute('data-icon', 'bus');
		expect(svg).toHaveClass('text-lg');
	});

	test('renders a Lucide component', () => {
		const { container } = render(AppIcon, { props: { icon: MapPin, class: 'h-5 w-5' } });

		const svg = container.querySelector('svg');
		expect(svg).toBeInTheDocument();
		expect(svg).not.toHaveAttribute('data-icon');
		expect(svg).toHaveClass('h-5');
	});

	test('renders nothing when icon is null', () => {
		const { container } = render(AppIcon, { props: { icon: null } });

		expect(container.querySelector('svg')).not.toBeInTheDocument();
	});
});
