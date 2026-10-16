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
		expect(parseLocationQuery(query('lon=1'))).toHaveProperty('error');
		expect(parseLocationQuery(query('lat=91&lon=1'))).toHaveProperty('error');
		expect(parseLocationQuery(query('lat=1&lon=abc'))).toHaveProperty('error');
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
		expect(parseLocationQuery(query('lat=1&lon=2&latSpan=0.1'))).toHaveProperty('error');
		expect(parseLocationQuery(query('lat=1&lon=2&latSpan=-1&lonSpan=1'))).toHaveProperty('error');
	});
	it('ignores span validation errors when a valid radius is present', () => {
		expect(parseLocationQuery(query('lat=1&lon=2&radius=500&latSpan=bad'))).toEqual({
			params: { lat: 1, lon: 2, radius: 500 }
		});
	});
	it('rejects an invalid geometryDetail', () => {
		expect(parseLocationQuery(query('lat=1&lon=2&geometryDetail=x'))).toHaveProperty('error');
	});
});
