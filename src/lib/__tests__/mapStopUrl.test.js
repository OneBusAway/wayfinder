import { describe, test, expect } from 'vitest';
import { mapStopPath, stopIdFromPath } from '$lib/mapStopUrl.js';

describe('mapStopPath', () => {
	test('builds the map stop path with an encoded id', () => {
		expect(mapStopPath('1_75403')).toBe('/map/stops/1_75403');
		// agency-prefixed ids can contain characters worth encoding
		expect(mapStopPath('40_100 200')).toBe('/map/stops/40_100%20200');
	});
});

describe('stopIdFromPath', () => {
	test('extracts and decodes the id from a map stop path', () => {
		expect(stopIdFromPath('/map/stops/1_75403')).toBe('1_75403');
		expect(stopIdFromPath('/map/stops/40_100%20200')).toBe('40_100 200');
	});

	test('returns null for non-map-stop paths', () => {
		expect(stopIdFromPath('/')).toBeNull();
		expect(stopIdFromPath('/stops/1_75403')).toBeNull(); // standalone page, not ours
		expect(stopIdFromPath('/map/stops')).toBeNull();
		expect(stopIdFromPath('/map/stops/')).toBeNull();
		expect(stopIdFromPath('/map/stops/1_75403/extra')).toBeNull();
	});
});
