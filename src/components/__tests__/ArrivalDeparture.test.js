import { render, screen } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { msToLocalArrivalDepartureTimeString } from '$lib/dateTimeFormat';

// Local i18n mock that interpolates {name} values (the global setup mock returns keys).
// A small dictionary stands in for en.json's format strings so interpolated keys
// (like time.min_compact -> "{n}m") render real text instead of the raw key.
vi.mock('svelte-i18n', () => {
	const messages = {
		'time.now': 'now',
		'time.min_compact': '{n}m',
		'status.scheduled_arrival': 'Scheduled arriving at',
		'status.scheduled_departure': 'Scheduled departure',
		'status.arrived_at_time': 'Arrived at {time}',
		'status.departed_at_time': 'Departed at {time}',
		'status.arrived_ontime': 'Arrived on time',
		'status.arrived_delayed': 'Arrived {delay}m late',
		'status.arrived_early': 'Arrived {delay}m early',
		'status.departed_ontime': 'Departed on time',
		'status.depart_delayed': 'Departed {delay}m late',
		'status.depart_early': 'Departed {delay}m early',
		'status.canceled_arrival': 'Canceled',
		'status.frequency_until': 'Every {headway} min until {time}',
		'status.scheduled': 'Scheduled',
		'status.late_without_arrive_depart': '{delay}m late',
		'status.early_without_arrive_depart': '{delay}m early',
		'status.on_time': 'On time'
	};
	return {
		t: {
			subscribe: (fn) => {
				fn((key, options) => {
					let str = messages[key] ?? key;
					const values = options?.values;
					if (values && typeof values === 'object') {
						for (const [name, value] of Object.entries(values)) {
							if (name !== 'values') {
								str = str.replace(`{${name}}`, value);
							}
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
	// Freeze the clock so baseArrival() and the component derive their ETA from
	// the same "now" -- otherwise a minute rollover between the two Date.now()
	// calls could flip an exact assertion (e.g. "10m" -> "9m"). Only Date is
	// faked; real timers are left alone so async rendering still works.
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

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

	test('renders "Arrived at {time}" and suppresses negative ETA badge for a scheduled past arrival', () => {
		const scheduledTime = Date.now() - 4 * MIN;
		const { container } = render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: false,
					predictedArrivalTime: null,
					scheduledArrivalTime: scheduledTime,
					scheduledDepartureTime: scheduledTime
				})
			}
		});
		expect(
			screen.getByText(`Arrived at ${msToLocalArrivalDepartureTimeString(scheduledTime)}`)
		).toBeInTheDocument();
		expect(screen.queryByText('-4m')).not.toBeInTheDocument();
		expect(screen.queryByText(/Scheduled arriving at/)).not.toBeInTheDocument();
		expect(screen.queryByText('11:56 AM ·')).not.toBeInTheDocument();
		expect(container.querySelector('svg.lucide-clock')).not.toBeInTheDocument();
		expect(container.querySelector('svg.lucide-rss')).not.toBeInTheDocument();
	});

	test('renders "Departed at {time}" and suppresses negative ETA badge for a scheduled past departure (stopSequence 0)', () => {
		const scheduledTime = Date.now() - 5 * MIN;
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					stopSequence: 0,
					predicted: false,
					predictedArrivalTime: null,
					predictedDepartureTime: null,
					scheduledArrivalTime: scheduledTime,
					scheduledDepartureTime: scheduledTime
				})
			}
		});
		expect(
			screen.getByText(`Departed at ${msToLocalArrivalDepartureTimeString(scheduledTime)}`)
		).toBeInTheDocument();
		expect(screen.queryByText('-5m')).not.toBeInTheDocument();
		expect(screen.queryByText(/Scheduled departure/)).not.toBeInTheDocument();
	});

	test('renders future scheduled departure for stopSequence 0 when predictedArrivalTime is past and predictedDepartureTime is 0', () => {
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					stopSequence: 0,
					predicted: true,
					predictedArrivalTime: Date.now() - 5 * MIN,
					scheduledArrivalTime: Date.now() - 5 * MIN,
					predictedDepartureTime: 0,
					scheduledDepartureTime: Date.now() + 10 * MIN
				})
			}
		});
		expect(screen.getByText('Scheduled departure')).toBeInTheDocument();
		expect(screen.getByText('10m')).toBeInTheDocument();
		expect(screen.queryByText('-5m')).not.toBeInTheDocument();
		expect(screen.queryByText(/Departed at/)).not.toBeInTheDocument();
	});

	test('preserves time prefix and renders headway text for a frequency-based trip in the past', () => {
		const scheduledTime = Date.now() - 5 * MIN;
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: false,
					scheduledArrivalTime: scheduledTime,
					scheduledDepartureTime: scheduledTime,
					frequency: {
						startTime: Date.now() - 60 * MIN,
						endTime: Date.now() + 60 * MIN,
						headway: 600,
						exactTimes: false
					}
				})
			}
		});
		expect(
			screen.getByText(`${msToLocalArrivalDepartureTimeString(scheduledTime)} ·`)
		).toBeInTheDocument();
		expect(screen.getByText(/Every 10 min until/)).toBeInTheDocument();
	});

	test('falls back safely to "Scheduled" when scheduledTime is 0', () => {
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: false,
					scheduledArrivalTime: 0,
					scheduledDepartureTime: 0
				})
			}
		});
		expect(screen.getByText('Scheduled')).toBeInTheDocument();
		expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Arrived at/)).not.toBeInTheDocument();
		expect(screen.queryByText(/·/)).not.toBeInTheDocument();
	});

	test('renders "Scheduled arriving at" with positive ETA badge for future scheduled arrival', () => {
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: false,
					predictedArrivalTime: null,
					scheduledArrivalTime: Date.now() + 10 * MIN,
					scheduledDepartureTime: Date.now() + 10 * MIN
				})
			}
		});
		expect(screen.getByText('Scheduled arriving at')).toBeInTheDocument();
		expect(screen.getByText('10m')).toBeInTheDocument();
	});

	test('renders "Arrived on time" for predicted past arrival', () => {
		const { container } = render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: true,
					scheduledArrivalTime: Date.now() - 4 * MIN,
					predictedArrivalTime: Date.now() - 4 * MIN,
					scheduledDepartureTime: Date.now() - 4 * MIN,
					predictedDepartureTime: Date.now() - 4 * MIN
				})
			}
		});
		expect(screen.getByText('Arrived on time')).toBeInTheDocument();
		expect(screen.queryByText('-4m')).not.toBeInTheDocument();
		expect(screen.queryByText(/Arrived at/)).not.toBeInTheDocument();
		expect(container.querySelector('svg.lucide-rss')).toBeInTheDocument();
	});

	test('renders canceled status with scheduled time prefix for past canceled trip', () => {
		const scheduledTime = Date.now() - 4 * MIN;
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					tripStatus: { status: 'CANCELED' },
					predicted: false,
					predictedArrivalTime: null,
					scheduledArrivalTime: scheduledTime,
					scheduledDepartureTime: scheduledTime
				})
			}
		});
		expect(screen.getByText('Canceled')).toBeInTheDocument();
		expect(
			screen.getByText(`${msToLocalArrivalDepartureTimeString(scheduledTime)} ·`)
		).toBeInTheDocument();
	});

	test.each([
		['a differing live prediction', true, 10, 13, 13],
		['a live prediction equal to schedule', true, 10, 10, 10],
		['scheduled fallback without a prediction', false, 10, 13, 10],
		['scheduled fallback for an invalid prediction', true, 10, 13, 10, 0]
	])(
		'displays %s',
		(_label, predicted, scheduledMinutes, predictedMinutes, expectedMinutes, invalidPrediction) => {
			const scheduledTime = Date.now() + scheduledMinutes * MIN;
			const predictedTime = invalidPrediction ?? Date.now() + predictedMinutes * MIN;
			render(ArrivalDeparture, {
				props: {
					arrivalDeparture: baseArrival({
						predicted,
						scheduledArrivalTime: scheduledTime,
						predictedArrivalTime: predictedTime
					})
				}
			});

			expect(
				screen.getByText(
					`${msToLocalArrivalDepartureTimeString(Date.now() + expectedMinutes * MIN)} ·`
				)
			).toBeInTheDocument();
		}
	);

	test('replaces a stale 10:14 arrival with refreshed 10:34 data', async () => {
		vi.setSystemTime(new Date(2026, 6, 22, 10, 0));
		const firstArrivalTime = Date.now() + 14 * MIN;
		const refreshedArrivalTime = Date.now() + 34 * MIN;
		const { rerender } = render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: false,
					scheduledArrivalTime: firstArrivalTime,
					predictedArrivalTime: null
				})
			}
		});

		expect(
			screen.getByText(`${msToLocalArrivalDepartureTimeString(firstArrivalTime)} ·`)
		).toBeInTheDocument();
		expect(screen.getByText('14m')).toBeInTheDocument();

		await rerender({
			arrivalDeparture: baseArrival({
				predicted: false,
				scheduledArrivalTime: refreshedArrivalTime,
				predictedArrivalTime: null
			})
		});

		expect(
			screen.queryByText(`${msToLocalArrivalDepartureTimeString(firstArrivalTime)} ·`)
		).not.toBeInTheDocument();
		expect(
			screen.getByText(`${msToLocalArrivalDepartureTimeString(refreshedArrivalTime)} ·`)
		).toBeInTheDocument();
		expect(screen.queryByText('14m')).not.toBeInTheDocument();
		expect(screen.getByText('34m')).toBeInTheDocument();
	});

	test('refreshes a live prediction and continues calculating delay from schedule', async () => {
		const scheduledTime = Date.now() + 10 * MIN;
		const firstPrediction = Date.now() + 13 * MIN;
		const refreshedPrediction = Date.now() + 15 * MIN;
		const { rerender } = render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: true,
					scheduledArrivalTime: scheduledTime,
					predictedArrivalTime: firstPrediction
				})
			}
		});

		expect(
			screen.getByText(`${msToLocalArrivalDepartureTimeString(firstPrediction)} ·`)
		).toBeInTheDocument();
		expect(screen.getByText('3m late')).toBeInTheDocument();

		await rerender({
			arrivalDeparture: baseArrival({
				predicted: true,
				scheduledArrivalTime: scheduledTime,
				predictedArrivalTime: refreshedPrediction
			})
		});

		expect(
			screen.queryByText(`${msToLocalArrivalDepartureTimeString(firstPrediction)} ·`)
		).not.toBeInTheDocument();
		expect(
			screen.getByText(`${msToLocalArrivalDepartureTimeString(refreshedPrediction)} ·`)
		).toBeInTheDocument();
		expect(screen.getByText('5m late')).toBeInTheDocument();
	});

	test.each([
		['late', 60000, '1m late'],
		['early', -60000, '1m early'],
		['on time', 0, 'On time']
	])('calculates %s from the exact timestamp difference', (_label, difference, expectedLabel) => {
		const scheduledTime = Date.now() + 10 * MIN + 5000;
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: true,
					scheduledArrivalTime: scheduledTime,
					predictedArrivalTime: scheduledTime + difference
				})
			}
		});

		expect(screen.getByText(expectedLabel)).toBeInTheDocument();
	});

	test('shows on time instead of zero minutes late for a one-second difference', () => {
		const scheduledTime = Date.now() + 10 * MIN + 59500;
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: true,
					scheduledArrivalTime: scheduledTime,
					predictedArrivalTime: scheduledTime + 1000
				})
			}
		});

		expect(screen.getByText('On time')).toHaveClass('text-green-600');
		expect(screen.queryByText('0m late')).not.toBeInTheDocument();
	});

	test('shows on time instead of zero minutes early for a one-second difference', () => {
		const scheduledTime = Date.now() + 10 * MIN + 59500;
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: true,
					scheduledArrivalTime: scheduledTime,
					predictedArrivalTime: scheduledTime - 1000
				})
			}
		});

		expect(screen.getByText('On time')).toHaveClass('text-green-600');
		expect(screen.queryByText('0m early')).not.toBeInTheDocument();
	});

	test('rounds a 30-second deviation to one minute when both times show the same minute', () => {
		const scheduledTime = Date.now() + 10 * MIN + 5000;
		const predictedTime = scheduledTime + 30000;
		expect(msToLocalArrivalDepartureTimeString(predictedTime)).toBe(
			msToLocalArrivalDepartureTimeString(scheduledTime)
		);

		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({
					predicted: true,
					scheduledArrivalTime: scheduledTime,
					predictedArrivalTime: predictedTime
				})
			}
		});

		expect(screen.getByText('1m late')).toBeInTheDocument();
	});

	test.each([
		['arrival late', 1, 1000, 'Arrived on time'],
		['arrival early', 1, -1000, 'Arrived on time'],
		['departure late', 0, 1000, 'Departed on time'],
		['departure early', 0, -1000, 'Departed on time']
	])(
		'uses an on-time label for a sub-minute %s',
		(_label, stopSequence, difference, expectedLabel) => {
			const scheduledTime = Date.now() - 10 * MIN;
			render(ArrivalDeparture, {
				props: {
					arrivalDeparture: baseArrival({
						stopSequence,
						predicted: true,
						scheduledArrivalTime: scheduledTime,
						predictedArrivalTime: scheduledTime + difference,
						scheduledDepartureTime: scheduledTime,
						predictedDepartureTime: scheduledTime + difference
					})
				}
			});

			expect(screen.getByText(expectedLabel)).toHaveClass('text-green-600');
		}
	);

	test.each([
		['arrival late', 1, 60000, 'Arrived 1m late', 'text-violet-600'],
		['arrival early', 1, -60000, 'Arrived 1m early', 'text-red-600'],
		['departure late', 0, 60000, 'Departed 1m late', 'text-violet-600'],
		['departure early', 0, -60000, 'Departed 1m early', 'text-red-600']
	])(
		'preserves direction and color for a non-zero %s',
		(_label, stopSequence, difference, expectedLabel, expectedColor) => {
			const scheduledTime = Date.now() - 10 * MIN;
			render(ArrivalDeparture, {
				props: {
					arrivalDeparture: baseArrival({
						stopSequence,
						predicted: true,
						scheduledArrivalTime: scheduledTime,
						predictedArrivalTime: scheduledTime + difference,
						scheduledDepartureTime: scheduledTime,
						predictedDepartureTime: scheduledTime + difference
					})
				}
			});

			expect(screen.getByText(expectedLabel)).toHaveClass(expectedColor);
		}
	);

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

	test('renders its own chevron that rotates only when expanded', async () => {
		// the chevron is the plain svg with `transition-transform` (not the status icon)
		const chevronOf = (container) =>
			[...container.querySelectorAll('svg')].find((s) =>
				s.getAttribute('class')?.includes('transition-transform')
			);

		const { container, rerender } = render(ArrivalDeparture, {
			props: { arrivalDeparture: baseArrival(), expanded: false }
		});
		expect(chevronOf(container)).toBeTruthy();
		expect(chevronOf(container).getAttribute('class')).not.toContain('rotate-180');

		await rerender({ arrivalDeparture: baseArrival(), expanded: true });
		expect(chevronOf(container).getAttribute('class')).toContain('rotate-180');
	});

	describe('route colors', () => {
		const arrival = {
			routeId: 'r_c',
			routeShortName: 'C Line',
			tripHeadsign: 'Downtown Seattle',
			scheduledArrivalTime: Date.now() + 300000,
			predictedArrivalTime: Date.now() + 300000,
			predicted: true,
			stopSequence: 1
		};

		test('uses the resolved route color for the badge when provided', () => {
			render(ArrivalDeparture, {
				props: {
					arrivalDeparture: arrival,
					route: { id: 'r_c', shortName: 'C Line', color: 'b02a37', textColor: 'ffffff' },
					routeColors: { line: '#1565C0', badgeBg: '1565C0', badgeFg: 'ffffff' }
				}
			});
			expect(screen.getByText('C Line')).toHaveStyle('background-color: #1565C0');
			expect(screen.getByText('C Line')).toHaveStyle('color: #ffffff');
		});

		test('falls back to the GTFS color when no resolved color is given', () => {
			render(ArrivalDeparture, {
				props: {
					arrivalDeparture: arrival,
					route: { id: 'r_c', shortName: 'C Line', color: 'b02a37', textColor: 'ffffff' }
				}
			});
			expect(screen.getByText('C Line')).toHaveStyle('background-color: #b02a37');
		});
	});
});
