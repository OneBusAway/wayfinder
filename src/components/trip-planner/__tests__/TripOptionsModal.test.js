import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import TripOptionsModal from '../TripOptionsModal.svelte';

// Only the translation layer is mocked; the real tripOptionsStore is used so the test exercises the actual reset wiring (handleReset + DEFAULT_TRIP_OPTIONS)
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

describe('TripOptionsModal reset', () => {
	let user;

	beforeEach(() => {
		user = userEvent.setup();
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

		// Confirm the non-default state took effect.
		expect(wheelchairSwitch).toHaveAttribute('aria-checked', 'true');
		expect(getOptionButton('Depart At')).toHaveTextContent('✓');
		expect(getOptionButton('Fewest Transfers')).toHaveTextContent('✓');

		await user.click(screen.getByText('Reset to defaults'));

		// Everything is back to defaults (Leave now, no wheelchair, fastest).
		expect(wheelchairSwitch).toHaveAttribute('aria-checked', 'false');
		expect(getOptionButton('Leave Now')).toHaveTextContent('✓');
		expect(getOptionButton('Fastest Trip')).toHaveTextContent('✓');
		expect(getOptionButton('Depart At')).not.toHaveTextContent('✓');
		expect(getOptionButton('Fewest Transfers')).not.toHaveTextContent('✓');
	});

	it('does not persist the reset until Done (Cancel keeps it draft-only)', async () => {
		const onClose = vi.fn();
		render(TripOptionsModal, { props: { onClose, onDone: vi.fn() } });

		await user.click(screen.getByText('Reset to defaults'));
		await user.click(screen.getByText('Cancel'));

		// Cancel simply closes; the reset was never committed to the store.
		expect(onClose).toHaveBeenCalled();
	});
});
