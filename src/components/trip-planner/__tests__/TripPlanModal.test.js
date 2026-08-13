import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import userEvent from '@testing-library/user-event';
import { notifications } from '$stores/notificationStore';
import TripPlanModal from '../TripPlanModal.svelte';

vi.mock('$app/environment', () => ({
	browser: true,
	dev: false,
	building: false,
	version: '1.0.0'
}));

function makeLeg(overrides = {}) {
	return {
		mode: 'BUS',
		routeColor: 'ff0000',
		from: { name: 'Origin', lat: 47.6, lon: -122.3 },
		to: { name: 'Destination', lat: 47.7, lon: -122.4 },
		legGeometry: { points: 'encoded_shape' },
		...overrides
	};
}

function makeItinerary(legs, duration = 1200) {
	return { duration, legs };
}

function makeMapProvider() {
	let polylineId = 0;
	return {
		createPolyline: vi.fn(async () => ({ id: `line-${++polylineId}` })),
		removePolyline: vi.fn(),
		fitToPolylines: vi.fn().mockResolvedValue(true),
		flyTo: vi.fn()
	};
}

describe('TripPlanModal map fit', () => {
	let mapProvider;

	beforeEach(() => {
		mapProvider = makeMapProvider();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('fits the map after itinerary results arrive', async () => {
		const itineraries = [makeItinerary([makeLeg()])];
		const { unmount } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries,
				closePane: vi.fn()
			}
		});

		await vi.waitFor(() => {
			expect(mapProvider.createPolyline).toHaveBeenCalled();
			expect(mapProvider.fitToPolylines).toHaveBeenCalled();
		});

		expect(mapProvider.fitToPolylines).toHaveBeenCalledWith(
			expect.objectContaining({
				padding: expect.objectContaining({
					top: expect.any(Number),
					right: expect.any(Number),
					bottom: expect.any(Number),
					left: expect.any(Number)
				})
			})
		);
		expect(mapProvider.flyTo).not.toHaveBeenCalled();

		unmount();
	});

	it('re-fits when switching itinerary tabs', async () => {
		const user = userEvent.setup();
		const itineraries = [
			makeItinerary([makeLeg({ legGeometry: { points: 'shape_a' } })], 600),
			makeItinerary([makeLeg({ mode: 'WALK', legGeometry: { points: 'shape_b' } })], 900)
		];
		const { unmount } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries,
				closePane: vi.fn()
			}
		});

		await vi.waitFor(() => expect(mapProvider.fitToPolylines).toHaveBeenCalledTimes(1));

		const tabs = screen.getAllByRole('button', { name: /min/i });
		// First button is the close control; itinerary tabs follow.
		const itineraryTabs = tabs.filter((btn) => btn.classList.contains('itinerary-tab'));
		expect(itineraryTabs.length).toBe(2);

		await user.click(itineraryTabs[1]);
		await tick();

		await vi.waitFor(() => expect(mapProvider.fitToPolylines).toHaveBeenCalledTimes(2));
		expect(mapProvider.createPolyline).toHaveBeenCalledWith(
			'shape_b',
			expect.objectContaining({ dashArray: '8, 12' })
		);

		unmount();
	});

	it('removes orphan polylines when a tab switch supersedes an in-flight draw', async () => {
		let releaseFirst;
		const firstCreate = new Promise((resolve) => {
			releaseFirst = resolve;
		});
		let call = 0;
		mapProvider.createPolyline = vi.fn(() => {
			call += 1;
			if (call === 1) {
				return firstCreate.then(() => ({ id: 'stale-line' }));
			}
			return Promise.resolve({ id: `line-${call}` });
		});

		const itineraries = [
			makeItinerary([makeLeg({ legGeometry: { points: 'shape_a' } })], 600),
			makeItinerary([makeLeg({ legGeometry: { points: 'shape_b' } })], 900)
		];
		const { unmount } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries,
				closePane: vi.fn()
			}
		});

		// Wait until the first draw is blocked on createPolyline.
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1));

		const itineraryTabs = screen
			.getAllByRole('button')
			.filter((btn) => btn.classList.contains('itinerary-tab'));
		await userEvent.click(itineraryTabs[1]);

		// Second draw starts and completes while the first is still pending.
		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2));
		await vi.waitFor(() => expect(mapProvider.fitToPolylines).toHaveBeenCalled());

		releaseFirst({ id: 'stale-line' });

		await vi.waitFor(() =>
			expect(mapProvider.removePolyline).toHaveBeenCalledWith({ id: 'stale-line' })
		);

		unmount();
	});

	it('falls back to flyTo when fitToPolylines returns false', async () => {
		mapProvider.fitToPolylines = vi.fn().mockResolvedValue(false);
		mapProvider.createPolyline = vi.fn().mockResolvedValue(null);

		const itineraries = [
			makeItinerary([
				makeLeg({
					from: { name: 'A', lat: 47.6, lon: -122.3 },
					to: { name: 'B', lat: 47.8, lon: -122.5 },
					legGeometry: { points: '' }
				})
			])
		];
		const { unmount } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries,
				closePane: vi.fn()
			}
		});

		await vi.waitFor(() => expect(mapProvider.flyTo).toHaveBeenCalled());

		expect(mapProvider.flyTo).toHaveBeenCalledWith(47.7, -122.4, 13);

		unmount();
	});

	it('does not throw on an itinerary with no legs', async () => {
		mapProvider.fitToPolylines = vi.fn().mockResolvedValue(false);
		// drawRoute is fired and forgotten from an $effect, so a throw inside it
		// surfaces as an unobserved rejection on the process, not as a test failure.
		const rejections = [];
		const onRejection = (reason) => rejections.push(reason);
		process.on('unhandledRejection', onRejection);

		const { unmount } = render(TripPlanModal, {
			props: { mapProvider, itineraries: [makeItinerary([])], closePane: vi.fn() }
		});

		await vi.waitFor(() => expect(mapProvider.fitToPolylines).toHaveBeenCalled());
		// Give Node a turn to surface any unobserved rejection.
		await new Promise((resolve) => setTimeout(resolve, 50));
		process.off('unhandledRejection', onRejection);

		expect(rejections.map((r) => String(r?.message ?? r))).toEqual([]);
		// Nothing to frame, so the camera is left where it was.
		expect(mapProvider.flyTo).not.toHaveBeenCalled();

		unmount();
	});

	it('skips the flyTo fallback when leg endpoints have no coordinates', async () => {
		mapProvider.fitToPolylines = vi.fn().mockResolvedValue(false);
		mapProvider.createPolyline = vi.fn().mockResolvedValue(null);

		const { unmount } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries: [makeItinerary([makeLeg({ from: {}, to: {}, legGeometry: { points: '' } })])],
				closePane: vi.fn()
			}
		});

		await vi.waitFor(() => expect(mapProvider.fitToPolylines).toHaveBeenCalled());
		await tick();
		await Promise.resolve();

		// Averaging absent coordinates yields NaN; panning there would break the map.
		expect(mapProvider.flyTo).not.toHaveBeenCalled();

		unmount();
	});

	it('still frames the endpoints when only one of them has coordinates', async () => {
		mapProvider.fitToPolylines = vi.fn().mockResolvedValue(false);
		mapProvider.createPolyline = vi.fn().mockResolvedValue(null);

		const { unmount } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries: [
					makeItinerary([
						makeLeg({
							from: { name: 'A', lat: 47.6, lon: -122.3 },
							to: {},
							legGeometry: { points: '' }
						})
					])
				],
				closePane: vi.fn()
			}
		});

		await vi.waitFor(() => expect(mapProvider.flyTo).toHaveBeenCalled());

		expect(mapProvider.flyTo).toHaveBeenCalledWith(47.6, -122.3, 13);

		unmount();
	});

	it('survives a provider whose createPolyline throws', async () => {
		mapProvider.fitToPolylines = vi.fn().mockResolvedValue(false);
		mapProvider.createPolyline = vi.fn(async () => {
			throw new Error('provider blew up');
		});
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const rejections = [];
		const onRejection = (reason) => rejections.push(reason);
		process.on('unhandledRejection', onRejection);

		const { unmount } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries: [makeItinerary([makeLeg()])],
				closePane: vi.fn()
			}
		});

		// A throw must not abort the draw: the fallback still has to run.
		await vi.waitFor(() => expect(mapProvider.flyTo).toHaveBeenCalled());
		await new Promise((resolve) => setTimeout(resolve, 50));
		process.off('unhandledRejection', onRejection);

		expect(rejections.map((r) => String(r?.message ?? r))).toEqual([]);
		expect(consoleError).toHaveBeenCalledWith(
			'Error creating itinerary leg polyline:',
			expect.any(Error)
		);
		expect(mapProvider.flyTo).toHaveBeenCalledWith(
			expect.closeTo(47.65, 5),
			expect.closeTo(-122.35, 5),
			13
		);

		consoleError.mockRestore();
		unmount();
	});
});

// The partial-shape toast and the fit-to-itinerary camera work live in the same
// drawRoute pass, so they are exercised together here: a leg can go missing from
// the map while the remaining legs still need framing.
describe('TripPlanModal partial-shape warnings', () => {
	let mapProvider;

	beforeEach(() => {
		notifications.dismiss();
		mapProvider = makeMapProvider();
	});

	afterEach(() => {
		notifications.dismiss();
		vi.clearAllMocks();
	});

	function renderWith(itineraries) {
		return render(TripPlanModal, {
			props: { mapProvider, itineraries, closePane: vi.fn() }
		});
	}

	it('warns and still fits the map when only some legs draw', async () => {
		mapProvider.createPolyline = vi.fn(async (shape) =>
			shape === 'bad_shape' ? null : { id: 'line-ok' }
		);

		const { unmount } = renderWith([
			makeItinerary([
				makeLeg({ legGeometry: { points: 'good_shape' } }),
				makeLeg({ legGeometry: { points: 'bad_shape' } })
			])
		]);

		await vi.waitFor(() => expect(mapProvider.fitToPolylines).toHaveBeenCalled());

		const active = get(notifications);
		expect(active?.variant).toBe('warning');
		expect(active?.message).toBe('notifications.route_shape_partial');
		// The legs that did draw are still worth framing.
		expect(mapProvider.flyTo).not.toHaveBeenCalled();

		unmount();
	});

	it('counts a leg with no geometry at all toward the gap', async () => {
		const { unmount } = renderWith([
			makeItinerary([
				makeLeg({ legGeometry: { points: 'shape_a' } }),
				makeLeg({ legGeometry: undefined })
			])
		]);

		await vi.waitFor(() => expect(mapProvider.fitToPolylines).toHaveBeenCalled());

		// The geometry-less leg is skipped before createPolyline, but still counted.
		expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1);
		expect(get(notifications)?.variant).toBe('warning');

		unmount();
	});

	it('stays quiet when every leg draws', async () => {
		const { unmount } = renderWith([
			makeItinerary([
				makeLeg({ legGeometry: { points: 'shape_a' } }),
				makeLeg({ legGeometry: { points: 'shape_b' } })
			])
		]);

		await vi.waitFor(() => expect(mapProvider.fitToPolylines).toHaveBeenCalled());

		expect(get(notifications)).toBeNull();

		unmount();
	});

	it('raises no stale warning from a draw that was superseded mid-flight', async () => {
		let releaseFirst;
		const firstCreate = new Promise((resolve) => {
			releaseFirst = resolve;
		});
		let call = 0;
		mapProvider.createPolyline = vi.fn(() => {
			call += 1;
			// The first itinerary's only leg fails to decode — but not until after
			// the user has already switched to the second tab.
			if (call === 1) return firstCreate.then(() => null);
			return Promise.resolve({ id: `line-${call}` });
		});

		const { unmount } = renderWith([
			makeItinerary([makeLeg({ legGeometry: { points: 'shape_a' } })], 600),
			makeItinerary([makeLeg({ legGeometry: { points: 'shape_b' } })], 900)
		]);

		await vi.waitFor(() => expect(mapProvider.createPolyline).toHaveBeenCalledTimes(1));

		const itineraryTabs = screen
			.getAllByRole('button')
			.filter((btn) => btn.classList.contains('itinerary-tab'));
		await userEvent.click(itineraryTabs[1]);

		await vi.waitFor(() => expect(mapProvider.fitToPolylines).toHaveBeenCalled());

		releaseFirst();
		await tick();
		await Promise.resolve();

		// The abandoned draw must not warn about an itinerary no longer on screen.
		expect(get(notifications)).toBeNull();

		unmount();
	});

	it('clears its own warning when the modal closes', async () => {
		mapProvider.createPolyline = vi.fn().mockResolvedValue(null);

		const { unmount } = renderWith([
			makeItinerary([makeLeg({ legGeometry: { points: 'bad_shape' } })])
		]);

		await vi.waitFor(() => expect(get(notifications)?.variant).toBe('warning'));

		unmount();

		expect(get(notifications)).toBeNull();
	});

	it('leaves a newer notification alone when the modal closes', async () => {
		mapProvider.createPolyline = vi.fn().mockResolvedValue(null);

		const { unmount } = renderWith([
			makeItinerary([makeLeg({ legGeometry: { points: 'bad_shape' } })])
		]);

		await vi.waitFor(() => expect(get(notifications)?.variant).toBe('warning'));

		// Something else takes over the toast slot before the modal is dismissed.
		const otherId = notifications.show({ message: 'unrelated', variant: 'error' });
		unmount();

		expect(get(notifications)?.id).toBe(otherId);
	});
});

describe('TripPlanModal showForm embedding', () => {
	it('embeds the plan form when showForm is true and skips empty state before planning', async () => {
		const mapProvider = makeMapProvider();
		const { queryByText, unmount } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries: [],
				closePane: vi.fn(),
				snap: 'half',
				showForm: true,
				handleTripPlan: vi.fn(),
				clearTripItineraries: vi.fn()
			}
		});

		await vi.waitFor(() => {
			expect(document.querySelector('#from-location-input')).toBeInTheDocument();
		});
		expect(document.querySelector('#to-location-input')).toBeInTheDocument();
		expect(queryByText('trip-planner.no_itineraries_found')).toBeNull();
		expect(mapProvider.fitToPolylines).not.toHaveBeenCalled();

		unmount();
	});

	it('shows the empty state on mobile after a plan returns zero itineraries', async () => {
		const mapProvider = makeMapProvider();
		const { getByText, unmount } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries: [],
				closePane: vi.fn(),
				snap: 'half',
				showForm: true,
				hasPlanned: true,
				handleTripPlan: vi.fn(),
				clearTripItineraries: vi.fn()
			}
		});

		let message;
		await vi.waitFor(() => {
			message = getByText('trip-planner.no_itineraries_found');
			expect(message).toBeInTheDocument();
		});

		// On the mobile sheet the empty state sits below the form, so it must size
		// to its content — h-full would center it past the visible body.
		expect(message.closest('div').className).not.toContain('h-full');

		unmount();
	});
});
