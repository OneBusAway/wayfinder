import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	buildVehiclePopupData,
	updateVehicleMarkers,
	clearVehicleMarkersMap
} from '$lib/vehicleUtils.js';

describe('buildVehiclePopupData', () => {
	it('returns popup data with stop name when stopsMap has the nextStop', () => {
		const vehicle = {
			vehicleId: 'v-123',
			lastUpdateTime: 1600000000,
			nextStop: 'stop-abc',
			predicted: true
		};
		const activeTrip = {
			tripHeadsign: 'Downtown'
		};
		const stopsMap = new Map();
		stopsMap.set('stop-abc', { name: 'Main St & 1st Ave' });

		const result = buildVehiclePopupData(vehicle, activeTrip, stopsMap);

		expect(result).toEqual({
			nextDestination: 'Downtown',
			vehicleId: 'v-123',
			lastUpdateTime: 1600000000,
			nextStopName: 'Main St & 1st Ave',
			predicted: true
		});
	});

	it('returns popup data with nextStopName as undefined when stopsMap lacks the nextStop', () => {
		const vehicle = {
			vehicleId: 'v-456',
			lastUpdateTime: 1600000100,
			nextStop: 'stop-unknown',
			predicted: false
		};
		const activeTrip = {
			tripHeadsign: 'Uptown'
		};
		const stopsMap = new Map();

		const result = buildVehiclePopupData(vehicle, activeTrip, stopsMap);

		expect(result).toEqual({
			nextDestination: 'Uptown',
			vehicleId: 'v-456',
			lastUpdateTime: 1600000100,
			nextStopName: undefined,
			predicted: false
		});
	});
});

describe('updateVehicleMarkers highlighting', () => {
	function makeProvider() {
		return {
			addVehicleMarker: vi.fn(() => ({})),
			updateVehicleMarker: vi.fn(),
			removeVehicleMarker: vi.fn()
		};
	}

	function mockFetchTwoVehicles() {
		const data = {
			references: {
				trips: [
					{ id: 'trip-1', routeId: 'route-1' },
					{ id: 'trip-2', routeId: 'route-1' }
				]
			},
			list: [
				{ status: { activeTripId: 'trip-1', status: 'SCHEDULED', orientation: 0 } },
				{ status: { activeTripId: 'trip-2', status: 'SCHEDULED', orientation: 0 } }
			]
		};
		global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) });
	}

	beforeEach(() => {
		clearVehicleMarkersMap();
		mockFetchTwoVehicles();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// addVehicleMarker(vehicleStatus, activeTrip, routeType, isHighlighted)
	const highlightArg = (call) => call[3];
	const tripOf = (call) => call[1].id;

	it('marks only the matching trip as highlighted', async () => {
		const provider = makeProvider();

		await updateVehicleMarkers('route-1', provider, undefined, 'trip-1');

		const calls = provider.addVehicleMarker.mock.calls;
		expect(highlightArg(calls.find((c) => tripOf(c) === 'trip-1'))).toBe(true);
		expect(highlightArg(calls.find((c) => tripOf(c) === 'trip-2'))).toBe(false);
	});

	it('highlights no vehicle when highlightedTripId is null', async () => {
		const provider = makeProvider();

		await updateVehicleMarkers('route-1', provider, undefined, null);

		for (const call of provider.addVehicleMarker.mock.calls) {
			expect(highlightArg(call)).toBe(false);
		}
	});

	it('passes the highlight flag through to updates on subsequent refreshes', async () => {
		const provider = makeProvider();

		// First pass creates the markers.
		await updateVehicleMarkers('route-1', provider, undefined, 'trip-2');
		// Second pass should update the existing markers, still highlighting trip-2.
		await updateVehicleMarkers('route-1', provider, undefined, 'trip-2');

		const calls = provider.updateVehicleMarker.mock.calls;
		// updateVehicleMarker(marker, vehicleStatus, activeTrip, routeType, isHighlighted)
		const trip2 = calls.find((c) => c[2].id === 'trip-2');
		const trip1 = calls.find((c) => c[2].id === 'trip-1');
		expect(trip2[4]).toBe(true);
		expect(trip1[4]).toBe(false);
	});
});
