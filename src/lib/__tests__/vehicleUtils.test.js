import { describe, it, expect } from 'vitest';
import { buildVehiclePopupData } from '$lib/vehicleUtils.js';

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
