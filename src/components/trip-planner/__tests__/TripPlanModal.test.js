import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import TripPlanModal from '../TripPlanModal.svelte';

vi.mock('$app/environment', () => ({
	browser: true,
	dev: false,
	building: false,
	version: '1.0.0'
}));

vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
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

describe('TripPlanModal map fit', () => {
	let mapProvider;
	let polylineId;

	beforeEach(() => {
		polylineId = 0;
		mapProvider = {
			createPolyline: vi.fn(async () => ({ id: `line-${++polylineId}` })),
			removePolyline: vi.fn(),
			fitToPolylines: vi.fn().mockResolvedValue(true),
			flyTo: vi.fn()
		};
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
		await tick();
		await Promise.resolve();

		expect(mapProvider.removePolyline).toHaveBeenCalledWith({ id: 'stale-line' });

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
});
