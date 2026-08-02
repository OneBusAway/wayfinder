import { describe, it, expect } from 'vitest';
import {
	formatCoord,
	parseCoord,
	parseTripParams,
	applyTripParams,
	removeTripParams,
	hasTripParams
} from '../urlState';

describe('formatCoord', () => {
	it('rounds to 5 decimal places', () => {
		expect(formatCoord({ lat: 32.715739, lng: -117.161084 })).toBe('32.71574,-117.16108');
	});

	it('keeps the equator and prime meridian (0 values)', () => {
		expect(formatCoord({ lat: 0, lng: 0 })).toBe('0,0');
	});

	it('returns null for missing or invalid coords', () => {
		expect(formatCoord(null)).toBeNull();
		expect(formatCoord(undefined)).toBeNull();
		expect(formatCoord({ lat: 91, lng: 0 })).toBeNull();
		expect(formatCoord({ lat: 0, lng: 181 })).toBeNull();
		expect(formatCoord({ lat: NaN, lng: 0 })).toBeNull();
		expect(formatCoord({ lat: 'x', lng: 0 })).toBeNull();
	});
});

describe('parseCoord', () => {
	it('parses a valid "lat,lng" string', () => {
		expect(parseCoord('32.71574,-117.16108')).toEqual({ lat: 32.71574, lng: -117.16108 });
	});

	it('returns null for malformed input', () => {
		expect(parseCoord('')).toBeNull();
		expect(parseCoord(null)).toBeNull();
		expect(parseCoord('32.71574')).toBeNull();
		expect(parseCoord('32.71574,-117,5')).toBeNull();
		expect(parseCoord('abc,def')).toBeNull();
	});

	it('returns null for out-of-range coordinates', () => {
		expect(parseCoord('200,0')).toBeNull();
		expect(parseCoord('0,200')).toBeNull();
	});

	it('rejects trailing garbage instead of truncating it like parseFloat would', () => {
		// parseFloat('47.6xyz') === 47.6, which would silently reinterpret a
		// corrupted-but-in-range link as valid. Number() must reject it outright.
		expect(parseCoord('47.6xyz,-122.3junk')).toBeNull();
		expect(parseCoord('47.6,-122.3 ')).toEqual({ lat: 47.6, lng: -122.3 });
	});

	it('rejects a missing endpoint around the comma', () => {
		expect(parseCoord(',-117.1')).toBeNull();
		expect(parseCoord('32.7,')).toBeNull();
		expect(parseCoord(' , ')).toBeNull();
	});
});

describe('parseTripParams', () => {
	it('returns a restored trip when from and to are present', () => {
		const params = new URLSearchParams('from=32.7,-117.1&to=32.8,-117.2&fromName=Home&toName=Work');
		expect(parseTripParams(params)).toEqual({
			selectedFrom: { lat: 32.7, lng: -117.1 },
			selectedTo: { lat: 32.8, lng: -117.2 },
			fromPlace: 'Home',
			toPlace: 'Work'
		});
	});

	it('falls back to the formatted coord when names are missing', () => {
		const params = new URLSearchParams('from=32.7,-117.1&to=32.8,-117.2');
		const result = parseTripParams(params);
		expect(result.fromPlace).toBe('32.7,-117.1');
		expect(result.toPlace).toBe('32.8,-117.2');
	});

	it('returns null when either endpoint is missing or invalid', () => {
		expect(parseTripParams(new URLSearchParams('from=32.7,-117.1'))).toBeNull();
		expect(parseTripParams(new URLSearchParams('to=32.8,-117.2'))).toBeNull();
		expect(parseTripParams(new URLSearchParams('from=bad&to=32.8,-117.2'))).toBeNull();
		expect(parseTripParams(new URLSearchParams())).toBeNull();
		expect(parseTripParams(null)).toBeNull();
	});
});

describe('applyTripParams', () => {
	it('writes from, to, and names', () => {
		const url = new URL('https://example.com/');
		applyTripParams(url, {
			selectedFrom: { lat: 32.7, lng: -117.1 },
			selectedTo: { lat: 32.8, lng: -117.2 },
			fromPlace: 'Home',
			toPlace: 'Work'
		});
		expect(url.searchParams.get('from')).toBe('32.7,-117.1');
		expect(url.searchParams.get('to')).toBe('32.8,-117.2');
		expect(url.searchParams.get('fromName')).toBe('Home');
		expect(url.searchParams.get('toName')).toBe('Work');
	});

	it('round-trips through parseTripParams, rounding to 5 decimal places on write', () => {
		const url = new URL('https://example.com/');
		// Deliberately un-rounded (6+ decimal places) input, so this actually
		// exercises applyTripParams's rounding instead of asserting a
		// losslessness that only holds for already-rounded coordinates.
		applyTripParams(url, {
			selectedFrom: { lat: 32.715739, lng: -117.161084 },
			selectedTo: { lat: 32.800001, lng: -117.200009 },
			fromPlace: 'A',
			toPlace: 'B'
		});
		expect(parseTripParams(url.searchParams)).toEqual({
			selectedFrom: { lat: 32.71574, lng: -117.16108 },
			selectedTo: { lat: 32.8, lng: -117.20001 },
			fromPlace: 'A',
			toPlace: 'B'
		});
	});

	it('does not write anything when coordinates are invalid', () => {
		const url = new URL('https://example.com/');
		applyTripParams(url, { selectedFrom: null, selectedTo: { lat: 32.8, lng: -117.2 } });
		expect(url.searchParams.has('from')).toBe(false);
		expect(url.searchParams.has('to')).toBe(false);
	});

	it('clears name params when labels are absent', () => {
		const url = new URL('https://example.com/?fromName=Old&toName=Stale');
		applyTripParams(url, {
			selectedFrom: { lat: 32.7, lng: -117.1 },
			selectedTo: { lat: 32.8, lng: -117.2 }
		});
		expect(url.searchParams.has('fromName')).toBe(false);
		expect(url.searchParams.has('toName')).toBe(false);
	});
});

describe('removeTripParams', () => {
	it('strips every trip param but leaves others intact', () => {
		const url = new URL('https://example.com/?from=1,1&to=2,2&fromName=A&toName=B&lat=32&lng=-117');
		removeTripParams(url);
		expect(url.searchParams.has('from')).toBe(false);
		expect(url.searchParams.has('to')).toBe(false);
		expect(url.searchParams.has('fromName')).toBe(false);
		expect(url.searchParams.has('toName')).toBe(false);
		expect(url.searchParams.get('lat')).toBe('32');
		expect(url.searchParams.get('lng')).toBe('-117');
	});
});

describe('hasTripParams', () => {
	it('returns true when from or to is present, even if unparsable', () => {
		expect(hasTripParams(new URLSearchParams('from=bad&to=32.8,-117.2'))).toBe(true);
		expect(hasTripParams(new URLSearchParams('from=1,1'))).toBe(true);
		expect(hasTripParams(new URLSearchParams('to=1,1'))).toBe(true);
	});

	it('returns false when neither is present', () => {
		expect(hasTripParams(new URLSearchParams())).toBe(false);
		expect(hasTripParams(new URLSearchParams('lat=32&lng=-117'))).toBe(false);
		expect(hasTripParams(null)).toBe(false);
	});
});
