import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import TripPlan from '../TripPlan.svelte';
import * as navigation from '$app/navigation';

vi.mock('$app/environment', () => ({
	browser: true,
	dev: false,
	building: false,
	version: '1.0.0'
}));

vi.mock('$app/navigation', () => ({
	replaceState: vi.fn(),
	pushState: vi.fn(),
	goto: vi.fn()
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

describe('TripPlan autocomplete dismissal', () => {
	let mapProvider;
	let props;

	beforeEach(() => {
		mapProvider = {
			addPinMarker: vi.fn(),
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
		vi.useRealTimers();
		delete global.fetch;
	});

	it('does not reopen results when a pending response resolves after Escape', async () => {
		vi.useFakeTimers();
		let resolveSuggestions;
		global.fetch = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveSuggestions = () =>
						resolve({
							ok: true,
							json: () =>
								Promise.resolve({
									suggestions: [{ displayText: 'Capitol Hill', name: 'Capitol Hill' }]
								})
						});
				})
		);
		const { container, unmount } = render(TripPlan, { props });
		const input = container.querySelector('#from-location-input');

		await fireEvent.input(input, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		expect(global.fetch).toHaveBeenCalledOnce();

		await fireEvent.keyDown(input, { key: 'Escape' });
		await tick();
		expect(screen.queryByRole('status')).not.toBeInTheDocument();

		resolveSuggestions();
		await vi.advanceTimersByTimeAsync(0);
		for (let i = 0; i < 4; i += 1) {
			await Promise.resolve();
		}
		await tick();

		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
		unmount();
	});
});

describe('TripPlan shared URL round trip', () => {
	let mapProvider;
	let props;
	const sharedTrip = {
		selectedFrom: { lat: 47.6, lng: -122.3 },
		selectedTo: { lat: 47.7, lng: -122.4 },
		fromPlace: 'Home',
		toPlace: 'Work'
	};

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
		delete global.fetch;
	});

	function mockPlanSuccess() {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ plan: { itineraries: [{ id: 'itin-1' }] } })
		});
	}

	function mockPlanNetworkFailure() {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
	}

	it('restores a shared trip and re-syncs the URL once the itinerary loads', async () => {
		mockPlanSuccess();
		const { unmount } = render(TripPlan, { props });

		window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: sharedTrip }));

		await waitFor(() => expect(props.handleTripPlan).toHaveBeenCalled());

		expect(props.handleTripPlan).toHaveBeenCalledWith({
			data: { plan: { itineraries: [{ id: 'itin-1' }] } }
		});

		expect(navigation.replaceState).toHaveBeenCalled();
		const url = navigation.replaceState.mock.calls.at(-1)[0];
		expect(url.searchParams.get('from')).toBe('47.6,-122.3');
		expect(url.searchParams.get('to')).toBe('47.7,-122.4');
		expect(url.searchParams.get('fromName')).toBe('Home');
		expect(url.searchParams.get('toName')).toBe('Work');

		unmount();
	});

	it('clears trip params from the URL when an input is cleared', async () => {
		mockPlanSuccess();
		const { container, unmount } = render(TripPlan, { props });

		window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: sharedTrip }));
		await waitFor(() => expect(navigation.replaceState).toHaveBeenCalled());

		const user = userEvent.setup();
		const clearButtons = container.querySelectorAll('#from-location-input ~ button');
		await user.click(clearButtons[0]);

		await waitFor(() => {
			const url = navigation.replaceState.mock.calls.at(-1)[0];
			expect(url.searchParams.has('from')).toBe(false);
			expect(url.searchParams.has('to')).toBe(false);
		});

		unmount();
	});

	it('surfaces an error via handleTripPlan instead of a blank state when the request fails outright', async () => {
		mockPlanNetworkFailure();
		const { unmount } = render(TripPlan, { props });

		window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: sharedTrip }));

		await waitFor(() => expect(props.handleTripPlan).toHaveBeenCalled());

		expect(props.handleTripPlan).toHaveBeenCalledWith({
			data: { error: { id: 'REQUEST_FAILED', msg: expect.any(String) } }
		});
		// A failed plan must not be treated as shareable/recent
		expect(navigation.replaceState).not.toHaveBeenCalled();

		unmount();
	});

	it('surfaces an error via handleTripPlan when a shared link has broken/invalid params', async () => {
		const { unmount } = render(TripPlan, { props });

		window.dispatchEvent(new CustomEvent('invalidSharedTrip'));
		await tick();

		expect(props.handleTripPlan).toHaveBeenCalledWith({
			data: { error: { id: 'INVALID_SHARED_LINK', msg: expect.any(String) } }
		});

		unmount();
	});

	it('does not throw when a loadSharedTrip event has a malformed detail payload', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { unmount } = render(TripPlan, { props });

		expect(() => {
			window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: null }));
		}).not.toThrow();
		await tick();

		expect(props.handleTripPlan).not.toHaveBeenCalled();
		consoleSpy.mockRestore();
		unmount();
	});

	it('still saves the trip when replaceState throws before the router is initialized', async () => {
		mockPlanSuccess();
		const setItemSpy = vi.spyOn(global.localStorage, 'setItem');
		vi.mocked(navigation.replaceState).mockImplementationOnce(() => {
			throw new Error('Cannot call replaceState(...) before the router is initialized');
		});
		const { unmount } = render(TripPlan, { props });

		window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: sharedTrip }));

		await waitFor(() => expect(props.handleTripPlan).toHaveBeenCalled());
		await waitFor(() => expect(setItemSpy).toHaveBeenCalled());

		setItemSpy.mockRestore();
		unmount();
	});
});
