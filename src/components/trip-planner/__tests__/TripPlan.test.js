import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import TripPlan from '../TripPlan.svelte';

vi.mock('$app/environment', () => ({
	browser: true,
	dev: false,
	building: false,
	version: '1.0.0'
}));

vi.mock('@fortawesome/svelte-fontawesome', () => ({
	FontAwesomeIcon: vi.fn(() => ({ $$: { component: 'div' } }))
}));

/**
 * Populate the From and To pins by dispatching the same setTripPlanLocation event
 * the map context menu uses. This avoids mocking the geocode fetch and exercises
 * the real marker-creation path. Returns the two markers addPinMarker produced.
 */
async function selectFromAndTo(mapProvider) {
	window.dispatchEvent(
		new CustomEvent('setTripPlanLocation', { detail: { type: 'from', lat: 47.6, lng: -122.3 } })
	);
	window.dispatchEvent(
		new CustomEvent('setTripPlanLocation', { detail: { type: 'to', lat: 47.7, lng: -122.4 } })
	);
	await tick();

	const markers = mapProvider.addPinMarker.mock.results.map((r) => r.value);
	return { fromMarker: markers[0], toMarker: markers[1] };
}

describe('TripPlan pin cleanup', () => {
	let mapProvider;
	let props;

	beforeEach(() => {
		let markerId = 0;
		mapProvider = {
			addPinMarker: vi.fn(() => ({ id: `marker-${++markerId}` })),
			removePinMarker: vi.fn(),
			clearAllPolylines: vi.fn()
		};
		props = {
			handleTripPlan: vi.fn(),
			clearTripItineraries: vi.fn(),
			mapProvider
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('removes both pins when the itineraries modal closes, but keeps the form inputs', async () => {
		const { container, unmount } = render(TripPlan, { props });

		const { fromMarker, toMarker } = await selectFromAndTo(mapProvider);
		expect(mapProvider.addPinMarker).toHaveBeenCalledTimes(2);

		window.dispatchEvent(new CustomEvent('tripPlanModalClosed'));
		await tick();

		expect(mapProvider.removePinMarker).toHaveBeenCalledTimes(2);
		expect(mapProvider.removePinMarker).toHaveBeenCalledWith(fromMarker);
		expect(mapProvider.removePinMarker).toHaveBeenCalledWith(toMarker);

		expect(container.querySelector('#from-location-input').value).toBe('47.60000, -122.30000');
		expect(container.querySelector('#to-location-input').value).toBe('47.70000, -122.40000');

		expect(mapProvider.addPinMarker).toHaveBeenCalledTimes(2);

		unmount();
	});

	it('removes any active pins when the component unmounts (tab switch safety net)', async () => {
		const { unmount } = render(TripPlan, { props });

		const { fromMarker, toMarker } = await selectFromAndTo(mapProvider);
		expect(mapProvider.addPinMarker).toHaveBeenCalledTimes(2);

		unmount();
		await tick();

		expect(mapProvider.removePinMarker).toHaveBeenCalledTimes(2);
		expect(mapProvider.removePinMarker).toHaveBeenCalledWith(fromMarker);
		expect(mapProvider.removePinMarker).toHaveBeenCalledWith(toMarker);
	});
});
