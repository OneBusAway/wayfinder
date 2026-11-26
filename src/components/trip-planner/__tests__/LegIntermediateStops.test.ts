import { afterEach, describe, expect, test, vi } from 'vitest';
import { env } from '$env/dynamic/public';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import LegDetails from '../LegDetails.svelte';
import { msToTimeString } from '$lib/dateTimeFormat';
import type { ItineraryLeg } from '$lib/types';

const firstStopDeparture = new Date('2026-02-19T17:27:30-08:00').getTime();
const secondStopArrival = new Date('2026-02-19T17:33:00-08:00').getTime();

function busLeg(overrides: Partial<ItineraryLeg> = {}): ItineraryLeg {
	return {
		distance: 5200,
		duration: 1440,
		headsign: 'University District',
		intermediateStops: [
			{ arrival: firstStopDeparture - 30_000, departure: firstStopDeparture, name: 'Broadway' },
			{ arrival: secondStopArrival, name: '10th Ave E' }
		],
		mode: 'BUS',
		routeShortName: '10',
		...overrides
	};
}

function renderLeg(leg: ItineraryLeg, expanded = false) {
	const toggleSteps = vi.fn();
	render(LegDetails, {
		props: { expandedSteps: expanded ? { 2: true } : {}, index: 2, leg, toggleSteps }
	});
	// The i18n mock returns the message id, so the toggle is named by its key.
	const toggle = screen.queryByRole('button', { name: 'trip_details.collapsed_stops' });
	return { toggle, toggleSteps };
}

describe('LegDetails intermediate stops', () => {
	const originalTz = env.PUBLIC_OBA_TIMEZONE;
	afterEach(() => {
		env.PUBLIC_OBA_TIMEZONE = originalTz;
	});

	test('formats stop times in PUBLIC_OBA_TIMEZONE', () => {
		env.PUBLIC_OBA_TIMEZONE = 'America/Los_Angeles';
		renderLeg(busLeg(), true);

		const stops = screen.getAllByRole('listitem').map((item) => item.textContent?.trim());
		expect(stops[0]).toContain('5:27');
		expect(stops[1]).toContain('5:33');
	});

	test('offers a collapsed stop list on a transit leg that has intermediate stops', () => {
		const { toggle } = renderLeg(busLeg());

		expect(toggle).toBeInTheDocument();
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('list')).not.toBeInTheDocument();
	});

	test('asks the parent to expand this leg when the toggle is clicked', async () => {
		const { toggle, toggleSteps } = renderLeg(busLeg());

		await userEvent.click(toggle!);

		expect(toggleSteps).toHaveBeenCalledTimes(1);
		expect(toggleSteps).toHaveBeenCalledWith(2);
	});

	test('lists each stop in order with its time when expanded', () => {
		const { toggle } = renderLeg(busLeg(), true);

		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		const stops = screen.getAllByRole('listitem').map((item) => item.textContent?.trim());
		expect(stops).toHaveLength(2);
		// A stop's departure is shown when there is one, otherwise its arrival.
		expect(stops[0]).toMatch(/^Broadway\s+/);
		expect(stops[0]).toContain(msToTimeString(firstStopDeparture));
		expect(stops[1]).toMatch(/^10th Ave E\s+/);
		expect(stops[1]).toContain(msToTimeString(secondStopArrival));
	});

	test('shows a stop without a time or a name instead of dropping it', () => {
		renderLeg(busLeg({ intermediateStops: [{ name: 'Broadway' }, { arrival: null }] }), true);

		const stops = screen.getAllByRole('listitem').map((item) => item.textContent?.trim());
		expect(stops).toEqual(['Broadway', '—']);
	});

	test.each([
		['has no intermediate stops', busLeg({ intermediateStops: [] })],
		['has null intermediate stops', busLeg({ intermediateStops: null })],
		['does not report intermediate stops', busLeg({ intermediateStops: undefined })],
		['is a walking leg', busLeg({ mode: 'WALK' })]
	])('offers no stop list when the leg %s', (_, leg) => {
		const { toggle } = renderLeg(leg, true);

		expect(toggle).not.toBeInTheDocument();
		expect(screen.queryByRole('list')).not.toBeInTheDocument();
	});
});
