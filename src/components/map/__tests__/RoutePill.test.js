import { render, screen } from '@testing-library/svelte';
import { describe, test, expect } from 'vitest';
import RoutePill from '../RoutePill.svelte';

describe('RoutePill', () => {
	test('uses the route colors when both are given', () => {
		render(RoutePill, { props: { shortName: '1 Line', color: '28813F', textColor: 'FFFFFF' } });

		expect(screen.getByText('1 Line')).toHaveStyle({
			backgroundColor: '#28813F',
			color: '#FFFFFF'
		});
	});

	test.each([
		['FFD700', '#000000'],
		['28813F', '#ffffff']
	])('picks readable text for %s when the route has no text color', (color, expected) => {
		render(RoutePill, { props: { shortName: '36', color } });

		expect(screen.getByText('36')).toHaveStyle({ color: expected });
	});

	test('falls back to a neutral background without a route color', () => {
		render(RoutePill, { props: { shortName: '36' } });

		expect(screen.getByText('36')).toHaveStyle({ backgroundColor: '#374151' });
	});
});
