import { describe, test, expect } from 'vitest';
import { mapStopPath } from '$lib/mapStopUrl.js';

describe('mapStopPath', () => {
	test('builds the map stop path with an encoded id', () => {
		expect(mapStopPath('1_75403')).toBe('/map/stops/1_75403');
		// agency-prefixed ids can contain characters worth encoding
		expect(mapStopPath('40_100 200')).toBe('/map/stops/40_100%20200');
	});
});
