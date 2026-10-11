import { describe, it, expect } from 'vitest';
import {
	assignZoneColors,
	normalizeHexColor,
	ZONE_BRAND_COLOR,
	ZONE_FALLBACK_PALETTE
} from '$lib/onDemand/colors.js';
import { zoneLevel, zoneStyle } from '$lib/onDemand/zones.js';

describe('zoneLevel', () => {
	it('uses the visible height in km', () => {
		expect(zoneLevel({ north: 0.03, south: 0 })).toBe('street'); // ~3.3 km
		expect(zoneLevel({ north: 0.5, south: 0 })).toBe('region'); // ~55.7 km
		expect(zoneLevel({ north: 1, south: 0 })).toBe('hidden'); // ~111 km
	});
});

describe('zoneStyle', () => {
	it('fills region zones and strokes street zones with a halo', () => {
		expect(zoneStyle({ level: 'region', color: '#111111', highlight: 'none' })).toEqual({
			color: '#111111',
			fillOpacity: 0.2,
			weight: 2,
			opacity: 1,
			halo: null,
			interactive: true
		});
		expect(zoneStyle({ level: 'street', color: '#111111', highlight: 'none' })).toEqual({
			color: '#111111',
			fillOpacity: 0,
			weight: 4,
			opacity: 1,
			halo: { weight: 10, opacity: 0.25 },
			interactive: false
		});
	});
	it('thickens the selected zone and dims the others', () => {
		expect(zoneStyle({ level: 'region', color: '#111111', highlight: 'selected' }).weight).toBe(4);
		const dimmed = zoneStyle({ level: 'region', color: '#111111', highlight: 'dimmed' });
		expect(dimmed.opacity).toBe(0.6);
		expect(dimmed.fillOpacity).toBeCloseTo(0.12);
	});
});

describe('colors', () => {
	it('normalizes GTFS hex colours', () => {
		expect(normalizeHexColor('0072CE')).toBe('#0072ce');
		expect(normalizeHexColor('#ABCDEF')).toBe('#abcdef');
		expect(normalizeHexColor('red')).toBeNull();
		expect(normalizeHexColor(null)).toBeNull();
	});
	it('assigns route colours, the brand colour, and palette colours on collision in id order', () => {
		const colors = assignZoneColors([
			{ id: 'b', route: null },
			{ id: 'a', route: null },
			{ id: 'c', route: { color: '0072CE' } }
		]);
		expect(colors.get('a')).toBe(ZONE_BRAND_COLOR);
		expect(colors.get('b')).toBe(ZONE_FALLBACK_PALETTE[0]);
		expect(colors.get('c')).toBe('#0072ce');
	});
});
