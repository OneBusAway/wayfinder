import { describe, it, expect } from 'vitest';
import { finiteNumber, parseGeometryDetail, parseLocationQuery } from '$lib/onDemand/params.js';

const query = (s) => new URLSearchParams(s);

describe('finiteNumber', () => {
	it('accepts numeric strings and numbers, including zero', () => {
		expect(finiteNumber('12.5')).toBe(12.5);
		expect(finiteNumber(12.5)).toBe(12.5);
		expect(finiteNumber(0)).toBe(0);
	});
	it('returns null for whitespace-only, null, and non-finite inputs', () => {
		expect(finiteNumber('   ')).toBeNull();
		expect(finiteNumber(null)).toBeNull();
		expect(finiteNumber(Infinity)).toBeNull();
	});
});

describe('parseGeometryDetail', () => {
	it('accepts the three levels and absence', () => {
		expect(parseGeometryDetail(null)).toEqual({ value: null });
		for (const level of ['none', 'simplified', 'full']) {
			expect(parseGeometryDetail(level)).toEqual({ value: level });
		}
	});
	it('rejects anything else', () => {
		expect(parseGeometryDetail('bogus')).toHaveProperty('error');
	});
});

describe('parseLocationQuery', () => {
	it('requires finite lat and lon in range', () => {
		expect(parseLocationQuery(query('lon=1'))).toEqual({
			error: 'lat must be between -90 and 90'
		});
		expect(parseLocationQuery(query('lat=91&lon=1'))).toEqual({
			error: 'lat must be between -90 and 90'
		});
		expect(parseLocationQuery(query('lat=1&lon=abc'))).toEqual({
			error: 'lon must be between -180 and 180'
		});
	});
	it('accepts a radius in (0, 20000]', () => {
		expect(parseLocationQuery(query('lat=1&lon=2&radius=500'))).toEqual({
			params: { lat: 1, lon: 2, radius: 500 }
		});
		expect(parseLocationQuery(query('lat=1&lon=2&radius=0'))).toHaveProperty('error');
		expect(parseLocationQuery(query('lat=1&lon=2&radius=20001'))).toHaveProperty('error');
	});
	it('treats empty optional numeric parameters as absent', () => {
		expect(parseLocationQuery(query('lat=1&lon=2&radius=&latSpan=&lonSpan='))).toEqual({
			params: { lat: 1, lon: 2 }
		});
	});
	it('requires both spans, positive', () => {
		expect(
			parseLocationQuery(query('lat=1&lon=2&latSpan=0.1&lonSpan=0.2&geometryDetail=simplified'))
		).toEqual({
			params: { lat: 1, lon: 2, latSpan: 0.1, lonSpan: 0.2, geometryDetail: 'simplified' }
		});
		expect(parseLocationQuery(query('lat=1&lon=2&latSpan=0.1'))).toEqual({
			error: 'latSpan and lonSpan must both be positive numbers'
		});
		expect(parseLocationQuery(query('lat=1&lon=2&latSpan=-1&lonSpan=1'))).toEqual({
			error: 'latSpan and lonSpan must both be positive numbers'
		});
	});
	it('rejects malformed spans even when a valid radius is present by default', () => {
		expect(parseLocationQuery(query('lat=1&lon=2&radius=500&latSpan=bad'))).toEqual({
			error: 'latSpan and lonSpan must both be positive numbers'
		});
	});
	it('rejects half-specified spans even when radius is present', () => {
		expect(parseLocationQuery(query('lat=1&lon=2&radius=500&latSpan=0.1'))).toEqual({
			error: 'latSpan and lonSpan must both be positive numbers'
		});
	});
	it('uses client-facing lon/lonSpan param names in reads and errors', () => {
		expect(
			parseLocationQuery(query('lat=1&lng=abc'), { lonParam: 'lng', lonSpanParam: 'lngSpan' })
		).toEqual({
			error: 'lng must be between -180 and 180'
		});
		expect(
			parseLocationQuery(query('lat=1&lng=2&latSpan=0.1'), {
				lonParam: 'lng',
				lonSpanParam: 'lngSpan'
			})
		).toEqual({
			error: 'latSpan and lngSpan must both be positive numbers'
		});
		expect(
			parseLocationQuery(query('lat=1&lng=2&latSpan=0.1&lngSpan=0.2'), {
				lonParam: 'lng',
				lonSpanParam: 'lngSpan'
			})
		).toEqual({
			params: { lat: 1, lon: 2, latSpan: 0.1, lonSpan: 0.2 }
		});
	});
	it('rejects an invalid geometryDetail', () => {
		expect(parseLocationQuery(query('lat=1&lon=2&geometryDetail=x'))).toHaveProperty('error');
	});
	it('skips geometryDetail validation when the endpoint does not support it', () => {
		expect(
			parseLocationQuery(query('lat=1&lon=2&geometryDetail=bogus'), {
				supportsGeometryDetail: false
			})
		).toEqual({
			params: { lat: 1, lon: 2 }
		});
	});
});
