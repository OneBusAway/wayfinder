import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import TripPlan from '../TripPlan.svelte';
import * as navigation from '$app/navigation';
import { recentTrips } from '$stores/recentTripsStore';

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

	it('preserves trip URL query parameters when unmounted (e.g. responsive viewport switch)', async () => {
		const tripUrl = '/?from=47.6%2C-122.3&to=47.7%2C-122.4&fromName=FromPlace&toName=ToPlace';
		window.history.pushState({}, '', tripUrl);
		vi.mocked(navigation.replaceState).mockClear();

		const { unmount } = render(TripPlan, { props });
		unmount();
		await tick();

		expect(navigation.replaceState).not.toHaveBeenCalled();
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

	it('keeps each field loading until its own request completes', async () => {
		vi.useFakeTimers();
		const resolveSuggestions = [];
		global.fetch = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveSuggestions.push(() =>
						resolve({
							ok: true,
							json: () => Promise.resolve({ suggestions: [] })
						})
					);
				})
		);
		const { container, unmount } = render(TripPlan, { props });
		const fromInput = container.querySelector('#from-location-input');
		const toInput = container.querySelector('#to-location-input');

		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		await fireEvent.input(toInput, { target: { value: 'University' } });
		await vi.advanceTimersByTimeAsync(500);

		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(screen.getAllByRole('status')).toHaveLength(2);

		resolveSuggestions[0]();
		await vi.advanceTimersByTimeAsync(0);
		for (let i = 0; i < 4; i += 1) {
			await Promise.resolve();
		}
		await tick();

		expect(screen.getAllByRole('status')).toHaveLength(1);

		resolveSuggestions[1]();
		await vi.advanceTimersByTimeAsync(0);
		for (let i = 0; i < 4; i += 1) {
			await Promise.resolve();
		}
		await tick();

		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		unmount();
	});

	it('drops a pending lookup when the locations are swapped', async () => {
		vi.useFakeTimers();
		let resolveSuggestions;
		global.fetch = vi.fn((url) => {
			if (url.startsWith('/api/oba/place-suggestions')) {
				return new Promise((resolve) => {
					resolveSuggestions = () =>
						resolve({
							ok: true,
							json: () =>
								Promise.resolve({
									suggestions: [{ displayText: 'Capitol Hill', name: 'Capitol Hill' }]
								})
						});
				});
			}
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ plan: { itineraries: [] } })
			});
		});
		const { unmount } = render(TripPlan, { props });
		await selectFromAndTo(mapProvider);

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		expect(global.fetch).toHaveBeenCalledOnce();

		await fireEvent.click(screen.getByRole('button', { name: 'trip-planner.swap_locations' }));
		expect(screen.queryByRole('status')).not.toBeInTheDocument();

		resolveSuggestions();
		await vi.advanceTimersByTimeAsync(0);
		for (let i = 0; i < 4; i += 1) {
			await Promise.resolve();
		}
		await tick();

		expect(fromInput).toHaveValue('47.70000, -122.40000');
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
		unmount();
	});

	it('stops loading when a map point replaces a field with a pending lookup', async () => {
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
		const { unmount } = render(TripPlan, { props });

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		expect(global.fetch).toHaveBeenCalledOnce();
		expect(screen.getByRole('status')).toBeInTheDocument();

		window.dispatchEvent(
			new CustomEvent('setTripPlanLocation', { detail: { type: 'from', lat: 47.6, lng: -122.3 } })
		);
		await tick();
		expect(screen.queryByRole('status')).not.toBeInTheDocument();

		resolveSuggestions();
		await vi.advanceTimersByTimeAsync(0);
		for (let i = 0; i < 4; i += 1) {
			await Promise.resolve();
		}
		await tick();

		expect(fromInput).toHaveValue('47.60000, -122.30000');
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
		unmount();
	});

	it('does not strand a loading field when the other field is typed during its debounce', async () => {
		vi.useFakeTimers();
		const resolveSuggestions = [];
		global.fetch = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveSuggestions.push(() =>
						resolve({
							ok: true,
							json: () => Promise.resolve({ suggestions: [] })
						})
					);
				})
		);
		const { container, unmount } = render(TripPlan, { props });
		const fromInput = container.querySelector('#from-location-input');
		const toInput = container.querySelector('#to-location-input');

		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		expect(global.fetch).toHaveBeenCalledOnce();

		await fireEvent.input(fromInput, { target: { value: 'Capitol Hill' } });
		await vi.advanceTimersByTimeAsync(250);
		await fireEvent.input(toInput, { target: { value: 'University' } });
		await vi.advanceTimersByTimeAsync(500);

		// The To debounce must not cancel the superseding From lookup.
		expect(global.fetch).toHaveBeenCalledTimes(3);

		for (const resolveSuggestion of resolveSuggestions) {
			resolveSuggestion();
		}
		await vi.advanceTimersByTimeAsync(0);
		for (let i = 0; i < 4; i += 1) {
			await Promise.resolve();
		}
		await tick();

		expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

	it('ignores an older plan response that resolves after a newer one', async () => {
		const resolvePlans = [];
		global.fetch = vi.fn(
			() =>
				new Promise((resolve) => {
					resolvePlans.push((itineraryId) =>
						resolve({
							ok: true,
							json: () => Promise.resolve({ plan: { itineraries: [{ id: itineraryId }] } })
						})
					);
				})
		);
		const { unmount } = render(TripPlan, { props });

		window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: sharedTrip }));
		window.dispatchEvent(
			new CustomEvent('loadSharedTrip', {
				detail: { ...sharedTrip, fromPlace: 'Work', toPlace: 'Home' }
			})
		);
		await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

		resolvePlans[1]('newer');
		await waitFor(() => expect(props.handleTripPlan).toHaveBeenCalledOnce());
		expect(screen.getByRole('button', { name: 'trip-planner.plan_your_trip' })).toBeEnabled();

		resolvePlans[0]('older');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(props.handleTripPlan).toHaveBeenCalledOnce();
		expect(props.handleTripPlan).toHaveBeenCalledWith({
			data: { plan: { itineraries: [{ id: 'newer' }] } }
		});
		unmount();
	});

	it('ignores a plan response that resolves after an input is cleared', async () => {
		let resolvePlan;
		global.fetch = vi.fn(
			() =>
				new Promise((resolve) => {
					resolvePlan = () =>
						resolve({
							ok: true,
							json: () => Promise.resolve({ plan: { itineraries: [{ id: 'itin-1' }] } })
						});
				})
		);
		const { unmount } = render(TripPlan, { props });

		window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: sharedTrip }));
		await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());

		await fireEvent.click(screen.getAllByRole('button', { name: 'search.clear' })[0]);
		expect(screen.getByRole('button', { name: 'trip-planner.plan_your_trip' })).toBeDisabled();

		resolvePlan();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(props.handleTripPlan).not.toHaveBeenCalled();
		const url = new URL(navigation.replaceState.mock.calls.at(-1)[0]);
		expect(url.searchParams.has('from')).toBe(false);
		unmount();
	});

	it('re-plans when a location is picked on the map mid-plan and ignores the older response', async () => {
		const resolvePlans = [];
		global.fetch = vi.fn(
			() =>
				new Promise((resolve) => {
					resolvePlans.push((itineraryId) =>
						resolve({
							ok: true,
							json: () => Promise.resolve({ plan: { itineraries: [{ id: itineraryId }] } })
						})
					);
				})
		);
		const { unmount } = render(TripPlan, { props });

		window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: sharedTrip }));
		await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());

		window.dispatchEvent(
			new CustomEvent('setTripPlanLocation', { detail: { type: 'from', lat: 47.5, lng: -122.2 } })
		);
		await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
		expect(global.fetch.mock.lastCall[0]).toMatch(/fromPlace=47\.50*%2C-122\.20*/);

		resolvePlans[0]('older');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(props.handleTripPlan).not.toHaveBeenCalled();

		resolvePlans[1]('newer');
		await waitFor(() => expect(props.handleTripPlan).toHaveBeenCalledOnce());
		expect(props.handleTripPlan).toHaveBeenCalledWith({
			data: { plan: { itineraries: [{ id: 'newer' }] } }
		});
		unmount();
	});

	it('keeps the route and a pending plan while an input is retyped', async () => {
		let resolvePlan;
		global.fetch = vi.fn(
			() =>
				new Promise((resolve) => {
					resolvePlan = () =>
						resolve({
							ok: true,
							json: () => Promise.resolve({ plan: { itineraries: [{ id: 'itin-1' }] } })
						});
				})
		);
		const { unmount } = render(TripPlan, { props });

		window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: sharedTrip }));
		await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });

		expect(props.clearTripItineraries).not.toHaveBeenCalled();

		resolvePlan();
		await waitFor(() => expect(props.handleTripPlan).toHaveBeenCalledOnce());
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

describe('TripPlan pending location selection', () => {
	let mapProvider;
	let props;
	let resolveGeocode;

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
		global.fetch = vi.fn((url) => {
			if (url.startsWith('/api/oba/place-suggestions')) {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							suggestions: [{ displayText: 'Capitol Hill', name: 'Capitol Hill' }]
						})
				});
			}
			if (url.startsWith('/api/oba/geocode-location')) {
				return new Promise((resolve) => {
					resolveGeocode = () =>
						resolve({
							ok: true,
							json: () =>
								Promise.resolve({
									location: { geometry: { location: { lat: 47.62, lng: -122.32 } } }
								})
						});
				});
			}
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ plan: { itineraries: [] } })
			});
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
		delete global.fetch;
	});

	it('disables Plan until the picked suggestion finishes geocoding', async () => {
		vi.useFakeTimers();
		const { unmount } = render(TripPlan, { props });
		await selectFromAndTo(mapProvider);

		const planButton = screen.getByRole('button', { name: 'trip-planner.plan_your_trip' });
		expect(planButton).toBeEnabled();

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		await fireEvent.click(await screen.findByRole('option', { name: 'Capitol Hill' }));

		expect(planButton).toBeDisabled();

		resolveGeocode();
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		expect(planButton).toBeEnabled();
		expect(mapProvider.addPinMarker).toHaveBeenLastCalledWith(
			{ lat: 47.62, lng: -122.32 },
			'trip-planner.from'
		);
		unmount();
	});

	it('shows the picked suggestion when it matches the current location', async () => {
		vi.useFakeTimers();
		const { unmount } = render(TripPlan, { props });

		const [fromInput] = screen.getAllByRole('combobox');
		for (let pass = 0; pass < 2; pass += 1) {
			await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
			await vi.advanceTimersByTimeAsync(500);
			await fireEvent.click(await screen.findByRole('option', { name: 'Capitol Hill' }));
			resolveGeocode();
			await vi.advanceTimersByTimeAsync(0);
			await tick();

			expect(fromInput).toHaveValue('Capitol Hill');
		}
		unmount();
	});

	it('ignores a pending geocode when the field is cleared', async () => {
		vi.useFakeTimers();
		const { unmount } = render(TripPlan, { props });
		await selectFromAndTo(mapProvider);

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		await fireEvent.click(await screen.findByRole('option', { name: 'Capitol Hill' }));

		await fireEvent.click(screen.getAllByRole('button', { name: 'search.clear' })[0]);

		resolveGeocode();
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		// The superseded geocode must not repopulate the cleared field.
		expect(fromInput).toHaveValue('');
		unmount();
	});

	it('keeps Swap enabled mid-geocode and ignores the pending geocode once swapped', async () => {
		vi.useFakeTimers();
		const { unmount } = render(TripPlan, { props });
		await selectFromAndTo(mapProvider);

		const [fromInput, toInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		await fireEvent.click(await screen.findByRole('option', { name: 'Capitol Hill' }));

		const swapButton = screen.getByRole('button', { name: 'trip-planner.swap_locations' });
		expect(swapButton).toBeEnabled();
		await fireEvent.click(swapButton);
		expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/otp/plan'));

		resolveGeocode();
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		// Text typed but not picked is dropped, and the geocode for it must not
		// resolve into either field.
		expect(fromInput).toHaveValue('47.70000, -122.40000');
		expect(toInput).toHaveValue('47.60000, -122.30000');
		expect(mapProvider.addPinMarker).not.toHaveBeenCalledWith(
			{ lat: 47.62, lng: -122.32 },
			expect.anything()
		);
		unmount();
	});

	it('does not plan when a suggestion is picked before the trip was planned', async () => {
		vi.useFakeTimers();
		const { unmount } = render(TripPlan, { props });
		await selectFromAndTo(mapProvider);

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		await fireEvent.click(await screen.findByRole('option', { name: 'Capitol Hill' }));
		resolveGeocode();
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		expect(fromInput).toHaveValue('Capitol Hill');
		expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/otp/plan'));
		unmount();
	});

	it('re-plans when a suggestion is picked once the trip has been planned', async () => {
		vi.useFakeTimers();
		const { unmount } = render(TripPlan, { props: { ...props, tripPlanAttempted: true } });
		await selectFromAndTo(mapProvider);
		// Setting the locations on the map already re-planned the trip.
		global.fetch.mockClear();

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		await fireEvent.click(await screen.findByRole('option', { name: 'Capitol Hill' }));
		expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/otp/plan'));

		resolveGeocode();
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		expect(global.fetch.mock.lastCall[0]).toMatch(
			/^\/api\/otp\/plan\?.*fromPlace=47\.620*%2C-122\.320*/
		);
		unmount();
	});

	it('disables Plan while a field has text that was not picked', async () => {
		vi.useFakeTimers();
		const { unmount } = render(TripPlan, { props });
		await selectFromAndTo(mapProvider);

		const planButton = screen.getByRole('button', { name: 'trip-planner.plan_your_trip' });
		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		expect(planButton).toBeDisabled();

		await vi.advanceTimersByTimeAsync(500);
		await fireEvent.click(await screen.findByRole('option', { name: 'Capitol Hill' }));
		resolveGeocode();
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		expect(planButton).toBeEnabled();
		unmount();
	});

	it('clears the location when a field is erased, like the clear button', async () => {
		const { unmount } = render(TripPlan, { props });
		const { fromMarker } = await selectFromAndTo(mapProvider);

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: '' } });

		expect(mapProvider.removePinMarker).toHaveBeenCalledWith(fromMarker);
		expect(props.clearTripItineraries).toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'trip-planner.plan_your_trip' })).toBeDisabled();
		unmount();
	});

	it('re-plans when a location is picked on the map once the trip has been planned', async () => {
		const { unmount } = render(TripPlan, { props: { ...props, tripPlanAttempted: true } });

		await selectFromAndTo(mapProvider);

		expect(global.fetch).toHaveBeenCalledOnce();
		expect(global.fetch.mock.lastCall[0]).toMatch(
			/^\/api\/otp\/plan\?.*fromPlace=47\.60*%2C-122\.30*/
		);
		expect(props.clearTripItineraries).not.toHaveBeenCalled();
		unmount();
	});

	it('waits to re-plan while the other field has text that was not picked', async () => {
		const { unmount } = render(TripPlan, { props: { ...props, tripPlanAttempted: true } });
		await selectFromAndTo(mapProvider);
		// Setting the locations on the map already re-planned the trip.
		global.fetch.mockClear();

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		window.dispatchEvent(
			new CustomEvent('setTripPlanLocation', { detail: { type: 'to', lat: 47.8, lng: -122.5 } })
		);
		await tick();

		expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/otp/plan'));
		unmount();
	});

	it('does not plan when a location is picked on the map before the trip was planned', async () => {
		const { unmount } = render(TripPlan, { props });

		await selectFromAndTo(mapProvider);

		expect(global.fetch).not.toHaveBeenCalled();
		unmount();
	});

	it('does not plan on Swap when the trip was never planned', async () => {
		const { unmount } = render(TripPlan, { props });
		await selectFromAndTo(mapProvider);

		await fireEvent.click(screen.getByRole('button', { name: 'trip-planner.swap_locations' }));

		expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/otp/plan'));
		unmount();
	});

	it('re-plans on Swap once the trip has been planned', async () => {
		const { unmount } = render(TripPlan, { props: { ...props, tripPlanAttempted: true } });
		await selectFromAndTo(mapProvider);
		// Setting the locations on the map already re-planned the trip.
		global.fetch.mockClear();

		await fireEvent.click(screen.getByRole('button', { name: 'trip-planner.swap_locations' }));

		expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/otp/plan'));
		unmount();
	});

	it('enables Plan and ignores the pending geocode once the location is picked on the map', async () => {
		vi.useFakeTimers();
		const { unmount } = render(TripPlan, { props });
		await selectFromAndTo(mapProvider);

		const [fromInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		await fireEvent.click(await screen.findByRole('option', { name: 'Capitol Hill' }));

		const planButton = screen.getByRole('button', { name: 'trip-planner.plan_your_trip' });
		expect(planButton).toBeDisabled();

		window.dispatchEvent(
			new CustomEvent('setTripPlanLocation', { detail: { type: 'from', lat: 47.5, lng: -122.2 } })
		);
		await tick();
		expect(planButton).toBeEnabled();

		resolveGeocode();
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		expect(fromInput).toHaveValue('47.50000, -122.20000');
		expect(mapProvider.addPinMarker).not.toHaveBeenCalledWith(
			{ lat: 47.62, lng: -122.32 },
			expect.anything()
		);
		unmount();
	});

	it('plans a recent trip picked mid-geocode and ignores the pending geocode', async () => {
		vi.useFakeTimers();
		recentTrips.clearAll();
		recentTrips.addTrip({
			fromPlace: 'Home',
			toPlace: 'Work',
			selectedFrom: { lat: 47.5, lng: -122.2 },
			selectedTo: { lat: 47.8, lng: -122.5 }
		});
		const { unmount } = render(TripPlan, { props });
		await selectFromAndTo(mapProvider);

		const [fromInput, toInput] = screen.getAllByRole('combobox');
		await fireEvent.input(fromInput, { target: { value: 'Capitol' } });
		await vi.advanceTimersByTimeAsync(500);
		await fireEvent.click(await screen.findByRole('option', { name: 'Capitol Hill' }));

		await fireEvent.click(screen.getByRole('button', { name: /trip-planner\.recents/ }));
		await fireEvent.click(screen.getByRole('button', { name: 'trip-planner.recent_trip' }));
		expect(global.fetch).toHaveBeenLastCalledWith(expect.stringContaining('/api/otp/plan'));

		resolveGeocode();
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		expect(fromInput).toHaveValue('Home');
		expect(toInput).toHaveValue('Work');
		expect(mapProvider.addPinMarker).not.toHaveBeenCalledWith(
			{ lat: 47.62, lng: -122.32 },
			expect.anything()
		);
		recentTrips.clearAll();
		unmount();
	});
});
