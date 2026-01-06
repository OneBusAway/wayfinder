import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseInitialCoordinates, cleanUrlParams } from '$lib/urlParams';

describe('parseInitialCoordinates', () => {
	// Puget Sound region center for testing
	const regionCenterLat = 47.60728155903877;
	const regionCenterLng = -122.3339240843084;

	describe('valid coordinates', () => {
		it('parses valid lat/lng parameters within region', () => {
			const params = new URLSearchParams('lat=47.6062&lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toEqual({ lat: 47.6062, lng: -122.3321 });
		});

		it('parses coordinates at exact region center', () => {
			const params = new URLSearchParams(`lat=${regionCenterLat}&lng=${regionCenterLng}`);
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toEqual({ lat: regionCenterLat, lng: regionCenterLng });
		});

		it('parses coordinates within 200km of region center', () => {
			// Tacoma is about 50km from Seattle
			const params = new URLSearchParams('lat=47.2529&lng=-122.4443');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toEqual({ lat: 47.2529, lng: -122.4443 });
		});

		it('parses coordinates with high precision', () => {
			const params = new URLSearchParams('lat=47.60728155903877&lng=-122.3339240843084');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result.lat).toBeCloseTo(47.60728155903877, 10);
			expect(result.lng).toBeCloseTo(-122.3339240843084, 10);
		});

		it('parses coordinates with minimal precision', () => {
			const params = new URLSearchParams('lat=47&lng=-122');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toEqual({ lat: 47, lng: -122 });
		});

		it('parses negative latitude coordinates', () => {
			// Testing with a region in southern hemisphere
			const params = new URLSearchParams('lat=-33.8688&lng=151.2093');
			// Sydney region center
			const result = parseInitialCoordinates(params, -33.8688, 151.2093);

			expect(result).toEqual({ lat: -33.8688, lng: 151.2093 });
		});

		it('parses positive longitude coordinates', () => {
			// Testing with a region in eastern hemisphere
			const params = new URLSearchParams('lat=51.5074&lng=0.1278');
			// London region center
			const result = parseInitialCoordinates(params, 51.5074, 0.1278);

			expect(result).toEqual({ lat: 51.5074, lng: 0.1278 });
		});
	});

	describe('missing parameters', () => {
		it('returns null when lat is missing', () => {
			const params = new URLSearchParams('lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when lng is missing', () => {
			const params = new URLSearchParams('lat=47.6062');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when both parameters are missing', () => {
			const params = new URLSearchParams('');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when only unrelated parameters exist', () => {
			const params = new URLSearchParams('zoom=15&stopId=123');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});
	});

	describe('invalid numeric values', () => {
		it('returns null when lat is not a number', () => {
			const params = new URLSearchParams('lat=abc&lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when lng is not a number', () => {
			const params = new URLSearchParams('lat=47.6062&lng=xyz');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when both are not numbers', () => {
			const params = new URLSearchParams('lat=foo&lng=bar');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when lat is empty string', () => {
			const params = new URLSearchParams('lat=&lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when lng is empty string', () => {
			const params = new URLSearchParams('lat=47.6062&lng=');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('parses numeric prefix when lat contains trailing special characters', () => {
			// parseFloat('47.60@62') returns 47.6 - this is valid JavaScript behavior
			const params = new URLSearchParams('lat=47.60@62&lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			// parseFloat extracts the numeric prefix, so this is a valid coordinate
			expect(result).toEqual({ lat: 47.6, lng: -122.3321 });
		});

		it('returns null for NaN values', () => {
			const params = new URLSearchParams('lat=NaN&lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null for Infinity values', () => {
			const params = new URLSearchParams('lat=Infinity&lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});
	});

	describe('out of range coordinates', () => {
		it('returns null when lat is greater than 90', () => {
			const params = new URLSearchParams('lat=91&lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when lat is less than -90', () => {
			const params = new URLSearchParams('lat=-91&lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when lng is greater than 180', () => {
			const params = new URLSearchParams('lat=47.6062&lng=181');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null when lng is less than -180', () => {
			const params = new URLSearchParams('lat=47.6062&lng=-181');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('accepts boundary values (lat=90)', () => {
			// This is at the pole, far from Seattle, so will be rejected for distance
			const params = new URLSearchParams('lat=90&lng=0');

			// Within 200km of (89, 0)
			expect(parseInitialCoordinates(params, 89, 0)).toEqual({ lat: 90, lng: 0 });
		});

		it('accepts boundary values (lat=-90)', () => {
			const params = new URLSearchParams('lat=-90&lng=0');
			const result = parseInitialCoordinates(params, -89, 0);

			expect(result).toEqual({ lat: -90, lng: 0 });
		});

		it('accepts boundary values (lng=180)', () => {
			const params = new URLSearchParams('lat=0&lng=180');
			const result = parseInitialCoordinates(params, 0, 179);

			expect(result).toEqual({ lat: 0, lng: 180 });
		});

		it('accepts boundary values (lng=-180)', () => {
			const params = new URLSearchParams('lat=0&lng=-180');
			const result = parseInitialCoordinates(params, 0, -179);

			expect(result).toEqual({ lat: 0, lng: -180 });
		});
	});

	describe('distance validation (200km limit)', () => {
		it('returns null for coordinates more than 200km from region center', () => {
			// Los Angeles is about 1,500km from Seattle
			const params = new URLSearchParams('lat=34.0522&lng=-118.2437');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('returns null for coordinates on the other side of the world', () => {
			// Sydney, Australia
			const params = new URLSearchParams('lat=-33.8688&lng=151.2093');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('accepts coordinates within 150km of region center', () => {
			// ~150km from Seattle
			const params = new URLSearchParams('lat=47.0&lng=-120.5');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toEqual({ lat: 47.0, lng: -120.5 });
		});

		it('rejects coordinates just over 200km', () => {
			// Portland, Oregon is about 280km from Seattle
			const params = new URLSearchParams('lat=45.5231&lng=-122.6765');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toBeNull();
		});

		it('accepts coordinates within 50km of region center', () => {
			// Bellevue is very close to Seattle
			const params = new URLSearchParams('lat=47.6101&lng=-122.2015');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toEqual({ lat: 47.6101, lng: -122.2015 });
		});
	});

	describe('edge cases', () => {
		it('handles zero coordinates', () => {
			const params = new URLSearchParams('lat=0&lng=0');
			const result = parseInitialCoordinates(params, 0, 0);

			expect(result).toEqual({ lat: 0, lng: 0 });
		});

		it('handles coordinates with leading zeros', () => {
			const params = new URLSearchParams('lat=047.6062&lng=-0122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toEqual({ lat: 47.6062, lng: -122.3321 });
		});

		it('handles coordinates with plus sign', () => {
			const params = new URLSearchParams('lat=+47.6062&lng=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result).toEqual({ lat: 47.6062, lng: -122.3321 });
		});

		it('handles scientific notation', () => {
			const params = new URLSearchParams('lat=4.76062e1&lng=-1.223321e2');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			expect(result.lat).toBeCloseTo(47.6062, 4);
			expect(result.lng).toBeCloseTo(-122.3321, 4);
		});

		it('handles multiple lat/lng params (uses first)', () => {
			const params = new URLSearchParams('lat=47.6062&lat=48.0&lng=-122.3321&lng=-121.0');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			// URLSearchParams.get() returns the first value
			expect(result).toEqual({ lat: 47.6062, lng: -122.3321 });
		});

		it('ignores case-different parameter names', () => {
			const params = new URLSearchParams('LAT=47.6062&LNG=-122.3321');
			const result = parseInitialCoordinates(params, regionCenterLat, regionCenterLng);

			// URLSearchParams is case-sensitive, so these won't match
			expect(result).toBeNull();
		});
	});
});

describe('cleanUrlParams', () => {
	let mockReplaceState;

	beforeEach(() => {
		mockReplaceState = vi.spyOn(window.history, 'replaceState');
	});

	afterEach(() => {
		// Restore mocks
		mockReplaceState.mockRestore();
	});

	it('removes lat and lng parameters from URL', () => {
		// Set up the URL with params
		const testUrl = 'http://localhost:3000/?lat=47.6062&lng=-122.3321';
		Object.defineProperty(window, 'location', {
			value: { href: testUrl },
			writable: true
		});

		cleanUrlParams();

		expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/');
	});

	it('preserves other query parameters', () => {
		const testUrl = 'http://localhost:3000/?lat=47.6062&lng=-122.3321&zoom=15&stopId=123';
		Object.defineProperty(window, 'location', {
			value: { href: testUrl },
			writable: true
		});

		cleanUrlParams();

		expect(mockReplaceState).toHaveBeenCalledWith(
			{},
			'',
			'http://localhost:3000/?zoom=15&stopId=123'
		);
	});

	it('handles URL with only lat parameter', () => {
		const testUrl = 'http://localhost:3000/?lat=47.6062';
		Object.defineProperty(window, 'location', {
			value: { href: testUrl },
			writable: true
		});

		cleanUrlParams();

		expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/');
	});

	it('handles URL with only lng parameter', () => {
		const testUrl = 'http://localhost:3000/?lng=-122.3321';
		Object.defineProperty(window, 'location', {
			value: { href: testUrl },
			writable: true
		});

		cleanUrlParams();

		expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/');
	});

	it('does not call replaceState when no lat/lng params exist', () => {
		const testUrl = 'http://localhost:3000/?zoom=15';
		Object.defineProperty(window, 'location', {
			value: { href: testUrl },
			writable: true
		});

		cleanUrlParams();

		expect(mockReplaceState).not.toHaveBeenCalled();
	});

	it('handles URL with no query parameters', () => {
		const testUrl = 'http://localhost:3000/';
		Object.defineProperty(window, 'location', {
			value: { href: testUrl },
			writable: true
		});

		cleanUrlParams();

		expect(mockReplaceState).not.toHaveBeenCalled();
	});

	it('preserves hash fragment', () => {
		const testUrl = 'http://localhost:3000/?lat=47.6062&lng=-122.3321#section';
		Object.defineProperty(window, 'location', {
			value: { href: testUrl },
			writable: true
		});

		cleanUrlParams();

		expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/#section');
	});

	it('preserves pathname', () => {
		const testUrl = 'http://localhost:3000/stops/123?lat=47.6062&lng=-122.3321';
		Object.defineProperty(window, 'location', {
			value: { href: testUrl },
			writable: true
		});

		cleanUrlParams();

		expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/stops/123');
	});
});
