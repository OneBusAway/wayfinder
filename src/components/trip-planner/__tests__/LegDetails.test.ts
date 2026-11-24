import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import LegDetails from '../LegDetails.svelte';
import type { ItineraryLeg } from '$lib/types';

function renderLeg(mode: string) {
	const leg: ItineraryLeg = {
		distance: 1200,
		duration: 300,
		headsign: 'Downtown',
		mode,
		routeShortName: 'A'
	};
	const { container } = render(LegDetails, {
		props: { expandedSteps: {}, index: 0, leg, toggleSteps: vi.fn() }
	});
	// The mode icon sits in the round badge at the start of the leg's timeline row.
	return container.querySelector('.rounded-full.shadow-md')!;
}

describe('LegDetails', () => {
	test.each([
		['BUS', 'bus'],
		['RAIL', 'train'],
		['FERRY', 'ferry'],
		['TRAM', 'train-subway'],
		['SUBWAY', 'train-subway'],
		['CABLE_CAR', 'cable-car'],
		['GONDOLA', 'cable-car'],
		['FUNICULAR', 'cable-car']
	])('shows the mode icon for a %s leg', (mode, iconName) => {
		const badge = renderLeg(mode);

		expect(badge.querySelector('svg')).toHaveAttribute('data-icon', iconName);
	});

	test('shows the walking icon for a WALK leg', () => {
		const badge = renderLeg('WALK');

		expect(badge.querySelector('svg')).toBeInTheDocument();
		expect(badge.querySelector('svg')).not.toHaveAttribute('data-icon');
	});

	test('leaves the badge empty for a mode it does not know', () => {
		const badge = renderLeg('AIRPLANE');

		expect(badge.querySelector('svg')).not.toBeInTheDocument();
	});
});
