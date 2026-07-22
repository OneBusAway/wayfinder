import { render, screen } from '@testing-library/svelte';
import { expect, test, describe, vi } from 'vitest';

// Local i18n mock that interpolates {name} values (the global setup mock returns keys).
// A small dictionary stands in for en.json's format strings so interpolated keys
// (like time.min_compact -> "{n}m") render real text instead of the raw key.
vi.mock('svelte-i18n', () => {
	const messages = {
		'time.now': 'now',
		'time.min_compact': '{n}m'
	};
	return {
		t: {
			subscribe: (fn) => {
				fn((key, options) => {
					let str = messages[key] ?? key;
					if (options?.values) {
						for (const [name, value] of Object.entries(options.values)) {
							str = str.replace(`{${name}}`, value);
						}
					}
					return str;
				});
				return () => {};
			}
		}
	};
});

import ArrivalDeparture from '../ArrivalDeparture.svelte';

const MIN = 60000;

function baseArrival(overrides = {}) {
	return {
		routeShortName: '10',
		tripHeadsign: 'Downtown Seattle',
		stopSequence: 1,
		predicted: true,
		scheduledArrivalTime: Date.now() + 10 * MIN,
		predictedArrivalTime: Date.now() + 10 * MIN,
		scheduledDepartureTime: Date.now() + 10 * MIN,
		predictedDepartureTime: Date.now() + 10 * MIN,
		tripStatus: null,
		frequency: null,
		...overrides
	};
}

describe('ArrivalDeparture', () => {
	test('renders the headsign and a route badge with the short name', () => {
		render(ArrivalDeparture, {
			props: { arrivalDeparture: baseArrival(), route: { color: 'FF0000', textColor: 'FFFFFF' } }
		});
		expect(screen.getByText('Downtown Seattle')).toBeInTheDocument();
		const badge = screen.getByText('10');
		expect(badge).toHaveStyle('background-color: #FF0000');
	});

	test('renders a compact ETA like "10m"', () => {
		render(ArrivalDeparture, { props: { arrivalDeparture: baseArrival() } });
		expect(screen.getByText('10m')).toBeInTheDocument();
	});

	test('uses gray for scheduled (not predicted) arrivals', () => {
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({ predicted: false, predictedArrivalTime: null })
			}
		});
		const eta = screen.getByText('10m');
		expect(eta.className).toContain('text-gray-500');
	});

	// Regression guard for the overflow bug: a long headsign must wrap to a
	// second line (and clamp/shrink after) rather than push the ETA off the
	// container. The row must fill its flex parent (w-full) and be shrinkable
	// (min-w-0) so the layout can't overflow.
	test('fills width and clamps a long headsign so content cannot overflow', () => {
		render(ArrivalDeparture, {
			props: { arrivalDeparture: baseArrival({ tripHeadsign: 'Aurora Village Transit Center' }) }
		});
		const headsign = screen.getByText('Aurora Village Transit Center');
		// headsign wraps to a second line then clamps, and its column can shrink
		expect(headsign.className).toContain('line-clamp-2');
		expect(headsign.parentElement.className).toContain('min-w-0');
		// the card row fills the available width and is itself shrinkable
		const row = headsign.closest('div.flex');
		expect(row.className).toContain('w-full');
		expect(row.className).toContain('min-w-0');
	});

	test('renders the ETA at text-xl (not the oversized text-3xl)', () => {
		render(ArrivalDeparture, { props: { arrivalDeparture: baseArrival() } });
		const eta = screen.getByText('10m');
		expect(eta.className).toContain('text-xl');
		expect(eta.className).not.toContain('text-3xl');
	});
});
