import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
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

const sampleItineraries = [
	{
		duration: 1500,
		startTime: 1_700_000_000_000,
		endTime: 1_700_000_001_500,
		legs: [
			{
				mode: 'WALK',
				from: { name: 'Origin' },
				to: { name: 'Stop A' },
				distance: 400,
				duration: 300,
				startTime: 1_700_000_000_000,
				endTime: 1_700_000_000_300,
				legGeometry: { points: 'walk-shape' }
			},
			{
				mode: 'BUS',
				routeColor: '00AA00',
				routeShortName: '101',
				from: { name: 'Stop A' },
				to: { name: 'Stop B' },
				distance: 5000,
				duration: 1200,
				startTime: 1_700_000_000_300,
				endTime: 1_700_000_001_500,
				legGeometry: { points: 'bus-shape' }
			}
		]
	},
	{
		duration: 1200,
		startTime: 1_700_000_000_000,
		endTime: 1_700_000_001_200,
		legs: [
			{
				mode: 'BUS',
				routeColor: '0000FF',
				routeShortName: '202',
				from: { name: 'Origin' },
				to: { name: 'Destination' },
				distance: 8000,
				duration: 1200,
				startTime: 1_700_000_000_000,
				endTime: 1_700_000_001_200,
				legGeometry: { points: 'alt-bus-shape' }
			}
		]
	}
];

describe('TripPlanModal map framing', () => {
	let mapProvider;

	beforeEach(() => {
		let polylineId = 0;
		mapProvider = {
			createPolyline: vi.fn(async () => ({ id: `polyline-${++polylineId}` })),
			removePolyline: vi.fn(),
			fitToPolylines: vi.fn().mockResolvedValue(true)
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('draws legs and fits the map when itineraries load', async () => {
		render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries: sampleItineraries,
				closePane: vi.fn(),
				snap: 'half'
			}
		});

		await waitFor(() => {
			expect(mapProvider.createPolyline).toHaveBeenCalledTimes(2);
		});
		expect(mapProvider.createPolyline).toHaveBeenCalledWith(
			'walk-shape',
			expect.objectContaining({ dashArray: '8, 12' })
		);
		expect(mapProvider.createPolyline).toHaveBeenCalledWith(
			'bus-shape',
			expect.objectContaining({ color: '#00AA00' })
		);

		await waitFor(() => {
			expect(mapProvider.fitToPolylines).toHaveBeenCalledTimes(1);
		});
		expect(mapProvider.fitToPolylines).toHaveBeenCalledWith({
			padding: expect.objectContaining({
				top: expect.any(Number),
				right: expect.any(Number),
				bottom: expect.any(Number),
				left: expect.any(Number)
			})
		});
	});

	it('refits the map when the active itinerary tab changes', async () => {
		const { getAllByRole } = render(TripPlanModal, {
			props: {
				mapProvider,
				itineraries: sampleItineraries,
				closePane: vi.fn(),
				snap: 'half'
			}
		});

		await waitFor(() => {
			expect(mapProvider.fitToPolylines).toHaveBeenCalledTimes(1);
		});

		const tabs = getAllByRole('button').filter((btn) =>
			btn.classList.contains('itinerary-tab')
		);
		expect(tabs).toHaveLength(2);
		tabs[1].click();
		await tick();

		await waitFor(() => {
			expect(mapProvider.createPolyline).toHaveBeenCalledWith(
				'alt-bus-shape',
				expect.objectContaining({ color: '#0000FF' })
			);
			expect(mapProvider.fitToPolylines).toHaveBeenCalledTimes(2);
		});
	});
});
