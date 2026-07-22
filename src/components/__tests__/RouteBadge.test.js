import { render, screen } from '@testing-library/svelte';
import { expect, test, describe } from 'vitest';
import RouteBadge from '../RouteBadge.svelte';

describe('RouteBadge', () => {
	test('renders the route short name', () => {
		render(RouteBadge, { props: { shortName: 'C Line' } });
		expect(screen.getByText('C Line')).toBeInTheDocument();
	});

	test('uses the route color as background and text color when provided', () => {
		render(RouteBadge, { props: { shortName: '10', color: 'FF0000', textColor: '00FF00' } });
		const badge = screen.getByText('10');
		expect(badge).toHaveStyle('background-color: #FF0000');
		expect(badge).toHaveStyle('color: #00FF00');
	});

	test('falls back to dark slate background and white text when color is absent', () => {
		render(RouteBadge, { props: { shortName: '21' } });
		const badge = screen.getByText('21');
		expect(badge).toHaveStyle('background-color: #374151');
		expect(badge).toHaveStyle('color: #ffffff');
	});
});
