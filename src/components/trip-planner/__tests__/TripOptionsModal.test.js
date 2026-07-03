import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import TripOptionsModal from '../TripOptionsModal.svelte';
import { tripOptions, DEFAULT_TRIP_OPTIONS } from '$stores/tripOptionsStore';

// browser = true so the real store's setPersisted touches the (mocked)
// localStorage, letting us assert the commit/draft-only persistence behavior.
vi.mock('$app/environment', () => ({ browser: true }));

// Translation layer and browser env are mocked; the real tripOptionsStore is used
// so the test exercises the actual reset wiring (handleReset + DEFAULT_TRIP_OPTIONS).
vi.mock('svelte-i18n', () => {
	const translations = {
		'trip-planner.cancel': 'Cancel',
		'trip-planner.done': 'Done',
		'trip-planner.reset_to_defaults': 'Reset to defaults',
		'trip-planner.trip_options': 'Trip Options',
		'trip-planner.departure_time': 'Departure Time',
		'trip-planner.leave_now': 'Leave Now',
		'trip-planner.depart_at': 'Depart At',
		'trip-planner.arrive_by': 'Arrive By',
		'trip-planner.wheelchair_accessible': 'Wheelchair accessible',
		'trip-planner.wheelchair_desc': 'Wheelchair description',
		'trip-planner.route_optimization': 'Route Optimization',
		'trip-planner.fastest_trip': 'Fastest Trip',
		'trip-planner.fewest_transfers': 'Fewest Transfers',
		'trip-planner.walking_distance': 'Walking Distance',
		'trip-planner.max_walking_distance': 'Maximum walking distance',
		'trip-planner.distance_unit': 'Distance Unit',
		'trip-planner.unit_auto': 'Auto',
		'trip-planner.unit_metric': 'Metric',
		'trip-planner.unit_imperial': 'Imperial'
	};
	return {
		t: {
			subscribe: vi.fn((fn) => {
				fn((key) => translations[key] || key);
				return { unsubscribe: () => {} };
			})
		}
	};
});

function getOptionButton(label) {
	return screen.getByText(label).closest('button');
}

function getStoreValue() {
	let value;
	tripOptions.subscribe((v) => (value = v))();
	return value;
}

describe('TripOptionsModal reset', () => {
	let user;

	beforeEach(() => {
		user = userEvent.setup();
		// Start each test from a clean, default store and clear localStorage spies.
		tripOptions.set({ ...DEFAULT_TRIP_OPTIONS });
		localStorage.setItem.mockClear();
		localStorage.removeItem.mockClear();
		localStorage.getItem.mockClear();
	});

	it('resets all locally edited options back to defaults', async () => {
		render(TripOptionsModal, { props: { onClose: vi.fn(), onDone: vi.fn() } });

		const wheelchairSwitch = screen.getByRole('switch', { name: 'Wheelchair accessible' });

		// Move several options away from their defaults.
		if (wheelchairSwitch.getAttribute('aria-checked') === 'false') {
			await user.click(wheelchairSwitch);
		}
		await user.click(getOptionButton('Depart At'));
		await user.click(getOptionButton('Fewest Transfers'));

		// Walk distance + unit interact through handleUnitChange's snapping, so
		// exercise them together.
		const walkSelect = screen.getByRole('combobox');
		await user.selectOptions(walkSelect, '3219');
		await user.click(getOptionButton('Metric'));

		// Confirm the non-default state took effect.
		expect(wheelchairSwitch).toHaveAttribute('aria-checked', 'true');
		expect(getOptionButton('Depart At')).toHaveTextContent('✓');
		expect(getOptionButton('Fewest Transfers')).toHaveTextContent('✓');
		expect(getOptionButton('Metric')).toHaveTextContent('✓');

		await user.click(screen.getByText('Reset to defaults'));

		// Everything is back to defaults (Leave now, no wheelchair, fastest, auto unit).
		expect(wheelchairSwitch).toHaveAttribute('aria-checked', 'false');
		expect(getOptionButton('Leave Now')).toHaveTextContent('✓');
		expect(getOptionButton('Fastest Trip')).toHaveTextContent('✓');
		expect(getOptionButton('Depart At')).not.toHaveTextContent('✓');
		expect(getOptionButton('Fewest Transfers')).not.toHaveTextContent('✓');
		expect(getOptionButton('Auto')).toHaveTextContent('✓');
		expect(getOptionButton('Metric')).not.toHaveTextContent('✓');
		expect(screen.getByRole('combobox')).toHaveValue(String(DEFAULT_TRIP_OPTIONS.maxWalkDistance));
	});

	it('keeps the reset draft-only: Cancel leaves the saved store untouched', async () => {
		// Seed non-default saved preferences (set() does not touch localStorage).
		tripOptions.set({
			...DEFAULT_TRIP_OPTIONS,
			wheelchair: true,
			optimize: 'fewestTransfers'
		});

		const onClose = vi.fn();
		render(TripOptionsModal, { props: { onClose, onDone: vi.fn() } });

		await user.click(screen.getByText('Reset to defaults'));
		await user.click(screen.getByText('Cancel'));

		// Cancel only closes — the store still holds the saved non-default values
		// and nothing was written to or removed from localStorage.
		expect(onClose).toHaveBeenCalled();
		const value = getStoreValue();
		expect(value.wheelchair).toBe(true);
		expect(value.optimize).toBe('fewestTransfers');
		expect(localStorage.setItem).not.toHaveBeenCalled();
		expect(localStorage.removeItem).not.toHaveBeenCalled();
	});

	it('Reset then Done commits defaults and clears the persisted keys', async () => {
		// Seed non-default saved preferences, including fields that must be reset
		// before their localStorage keys are cleared.
		tripOptions.set({
			...DEFAULT_TRIP_OPTIONS,
			departureType: 'departAt',
			departureTime: '14:30',
			departureDate: '2026-08-01',
			wheelchair: true,
			optimize: 'fewestTransfers',
			maxWalkDistance: 4828,
			distanceUnit: 'metric'
		});

		const onDone = vi.fn();
		render(TripOptionsModal, { props: { onClose: vi.fn(), onDone } });

		await user.click(screen.getByText('Reset to defaults'));
		await user.click(screen.getByText('Done'));

		expect(onDone).toHaveBeenCalled();

		// Store is back to defaults, including session-only departure fields.
		const value = getStoreValue();
		expect(value.departureType).toBe('now');
		expect(value.departureTime).toBeNull();
		expect(value.departureDate).toBeNull();
		expect(value.wheelchair).toBe(false);
		expect(value.optimize).toBe('fastest');
		expect(value.maxWalkDistance).toBe(DEFAULT_TRIP_OPTIONS.maxWalkDistance);
		expect(value.distanceUnit).toBeNull();

		// Defaults are cleared from localStorage rather than written, so the user
		// tracks future default changes instead of freezing today's values.
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_wheelchair');
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_optimize');
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_maxWalkDistance');
		expect(localStorage.removeItem).toHaveBeenCalledWith('tripOptions_distanceUnit');
		expect(localStorage.setItem).not.toHaveBeenCalled();
	});
});
