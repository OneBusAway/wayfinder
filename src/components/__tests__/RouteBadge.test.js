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

	test('grows short codes to the 24px ceiling to fill the box', () => {
		render(RouteBadge, { props: { shortName: '10' } });
		expect(screen.getByText('10')).toHaveStyle('font-size: 24px');
	});

	test('sizes a long single word by its width: "Waterfront Shuttle" fits the box', () => {
		render(RouteBadge, { props: { shortName: 'Waterfront Shuttle' } });
		// longest word "Waterfront" (10 chars) -> round(90/10) = 9px (width-bound)
		expect(screen.getByText('Waterfront Shuttle')).toHaveStyle('font-size: 9px');
	});

	test('constrains multi-word labels by line count, not just longest word', () => {
		// "Link Light Rail": width term round(90/5)=18, height term round(42/3)=14.
		// The height term wins, so removing it would wrongly render 18px.
		render(RouteBadge, { props: { shortName: 'Link Light Rail' } });
		expect(screen.getByText('Link Light Rail')).toHaveStyle('font-size: 14px');
	});

	test('keeps a two-word line name below the ceiling its longest word would allow', () => {
		// "C Line": longest word "Line" alone permits ~23px, but two lines cap it
		// at height term round(42/2)=21px.
		render(RouteBadge, { props: { shortName: 'C Line' } });
		expect(screen.getByText('C Line')).toHaveStyle('font-size: 21px');
	});

	test('clamps very long unbreakable words to the 8px floor', () => {
		// "Transportation" (14 chars) -> round(90/14)=6, raised to the 8px floor.
		render(RouteBadge, { props: { shortName: 'Transportation' } });
		expect(screen.getByText('Transportation')).toHaveStyle('font-size: 8px');
	});

	test.each([
		['empty', ''],
		['whitespace-only', '   '],
		['missing', undefined]
	])('resolves %s shortName to a finite size via the trim/filter/?? guards', (_label, value) => {
		// Without the guards these inputs would make lineCount/longestWord produce
		// NaN; all three should instead fall through to the 24px ceiling.
		const { container } = render(RouteBadge, { props: { shortName: value } });
		expect(container.firstChild).toHaveStyle('font-size: 24px');
	});
});
