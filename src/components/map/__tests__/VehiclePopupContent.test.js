import { render, screen } from '@testing-library/svelte';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import VehiclePopupContent from '../VehiclePopupContent.svelte';

const NOW = new Date('2026-10-20T12:00:00Z').getTime();

const liveVehicle = {
	nextDestination: 'Lynnwood City Center',
	vehicleId: '40_404.084822',
	lastUpdateTime: NOW - 28_000,
	nextStopName: 'Beacon Hill',
	predicted: true,
	routeShortName: '1 Line',
	routeColor: '28813F',
	routeTextColor: 'FFFFFF',
	routeType: 0,
	scheduleDeviation: 0,
	nextStopTimeOffset: 120
};

function renderPopup(props = {}) {
	return render(VehiclePopupContent, { props: { ...liveVehicle, ...props } });
}

describe('VehiclePopupContent', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('shows the route badge in the route colors', () => {
		renderPopup();
		const badge = screen.getByText('1 Line');
		expect(badge).toHaveStyle({ backgroundColor: '#28813F', color: '#FFFFFF' });
	});

	test('picks a readable badge text color when the route has none', () => {
		renderPopup({ routeColor: 'FFD700', routeTextColor: undefined });
		expect(screen.getByText('1 Line')).toHaveStyle({ color: '#000000' });
	});

	test('hides the route badge without a route name', () => {
		renderPopup({ routeShortName: undefined });
		expect(screen.queryByText('1 Line')).not.toBeInTheDocument();
	});

	test('shows destination, next stop, ETA and on-time status for a live vehicle', () => {
		renderPopup();
		expect(screen.getByText(/vehicle\.live/)).toBeInTheDocument();
		expect(screen.getByText('Lynnwood City Center')).toBeInTheDocument();
		expect(screen.getByText('Beacon Hill')).toBeInTheDocument();
		expect(screen.getByText('2 time.mins')).toBeInTheDocument();
		expect(screen.getByText('vehicle.on_time')).toBeInTheDocument();
	});

	test('shows arriving when the vehicle is about to reach the next stop', () => {
		renderPopup({ nextStopTimeOffset: 20 });
		expect(screen.getByText('vehicle.arriving')).toBeInTheDocument();
	});

	test('uses the singular minute label for a one minute ETA', () => {
		renderPopup({ nextStopTimeOffset: 60 });
		expect(screen.getByText('1 time.min')).toBeInTheDocument();
	});

	test.each([
		[240, 'vehicle.min_late'],
		[-180, 'vehicle.min_early']
	])('labels a %i second deviation as %s', (scheduleDeviation, label) => {
		renderPopup({ scheduleDeviation });
		expect(screen.getByText(label)).toBeInTheDocument();
	});

	test('shows last seen and hides the ETA when the data is stale', () => {
		renderPopup({ lastUpdateTime: NOW - 4 * 60_000 });
		expect(screen.getByText('vehicle.last_seen')).toBeInTheDocument();
		expect(screen.queryByText(/vehicle\.live/)).not.toBeInTheDocument();
		expect(screen.queryByText('2 time.mins')).not.toBeInTheDocument();
		expect(screen.queryByText('vehicle.on_time')).not.toBeInTheDocument();
		expect(screen.getByText('Beacon Hill')).toBeInTheDocument();
	});

	test('switches to last seen while open when no new data arrives', async () => {
		renderPopup();
		expect(screen.getByText(/vehicle\.live/)).toBeInTheDocument();

		await vi.advanceTimersByTimeAsync(3 * 60_000);

		expect(screen.getByText('vehicle.last_seen')).toBeInTheDocument();
		expect(screen.queryByText(/vehicle\.live/)).not.toBeInTheDocument();
		expect(screen.queryByText('vehicle.on_time')).not.toBeInTheDocument();
	});

	test('stops the clock when unmounted', () => {
		const { unmount } = renderPopup();
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('shows the scheduled state without the next stop row', () => {
		renderPopup({ predicted: false });
		expect(screen.getByText('vehicle.scheduled')).toBeInTheDocument();
		expect(screen.getByText('vehicle.no_real_time_data')).toBeInTheDocument();
		expect(screen.queryByText('vehicle.next_stop_label')).not.toBeInTheDocument();
		expect(screen.queryByText(/vehicle\.live/)).not.toBeInTheDocument();
	});

	test('falls back to N/A when the next stop is unknown', () => {
		renderPopup({ nextStopName: undefined });
		expect(screen.getByText('NA')).toBeInTheDocument();
	});

	test('shows the vehicle footer only when there is a vehicle id', () => {
		const { container, unmount } = renderPopup();
		expect(screen.getByText('vehicle.id')).toBeInTheDocument();
		expect(container.querySelector('.border-t')).toBeInTheDocument();
		unmount();

		renderPopup({ vehicleId: undefined });
		expect(screen.queryByText('vehicle.id')).not.toBeInTheDocument();
	});
});
