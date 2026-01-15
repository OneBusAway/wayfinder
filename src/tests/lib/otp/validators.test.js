import { describe, it, expect } from 'vitest';
import {
	validateCoordinates,
	validateTimeInput,
	validateDateInput,
	validateWalkDistance
} from '$lib/otp/validators.js';

describe('validateCoordinates', () => {
	// Valid coordinates
	it('accepts valid Seattle coordinates', () => {
		const result = validateCoordinates({ lat: 47.6062, lng: -122.3321 });
		expect(result.valid).toBe(true);
	});

	it('accepts valid edge case: lat=90, lng=180', () => {
		const result = validateCoordinates({ lat: 90, lng: 180 });
		expect(result.valid).toBe(true);
	});

	it('accepts valid edge case: lat=-90, lng=-180', () => {
		const result = validateCoordinates({ lat: -90, lng: -180 });
		expect(result.valid).toBe(true);
	});

	it('accepts valid edge case: lat=0, lng=0 (equator/prime meridian)', () => {
		const result = validateCoordinates({ lat: 0, lng: 0 });
		expect(result.valid).toBe(true);
	});

	// Invalid coordinates
	it('rejects latitude > 90', () => {
		const result = validateCoordinates({ lat: 91, lng: 0 });
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Latitude');
	});

	it('rejects latitude < -90', () => {
		const result = validateCoordinates({ lat: -91, lng: 0 });
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Latitude');
	});

	it('rejects longitude > 180', () => {
		const result = validateCoordinates({ lat: 0, lng: 181 });
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Longitude');
	});

	it('rejects longitude < -180', () => {
		const result = validateCoordinates({ lat: 0, lng: -181 });
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Longitude');
	});

	it('rejects non-numeric latitude', () => {
		const result = validateCoordinates({ lat: 'invalid', lng: 0 });
		expect(result.valid).toBe(false);
	});

	it('rejects non-numeric longitude', () => {
		const result = validateCoordinates({ lat: 0, lng: 'invalid' });
		expect(result.valid).toBe(false);
	});

	it('rejects null coordinates', () => {
		const result = validateCoordinates(null);
		expect(result.valid).toBe(false);
	});

	it('rejects undefined coordinates', () => {
		const result = validateCoordinates(undefined);
		expect(result.valid).toBe(false);
	});

	it('rejects missing lat', () => {
		const result = validateCoordinates({ lng: 0 });
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Latitude');
	});

	it('rejects missing lng', () => {
		const result = validateCoordinates({ lat: 0 });
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Longitude');
	});

	it('rejects NaN values', () => {
		const result = validateCoordinates({ lat: NaN, lng: 0 });
		expect(result.valid).toBe(false);
	});

	it('rejects Infinity values', () => {
		const result = validateCoordinates({ lat: Infinity, lng: 0 });
		expect(result.valid).toBe(false);
	});
});

describe('validateTimeInput', () => {
	// Valid times
	it('accepts valid time 00:00 (midnight)', () => {
		const result = validateTimeInput('00:00');
		expect(result.valid).toBe(true);
	});

	it('accepts valid time 23:59', () => {
		const result = validateTimeInput('23:59');
		expect(result.valid).toBe(true);
	});

	it('accepts valid time 12:30', () => {
		const result = validateTimeInput('12:30');
		expect(result.valid).toBe(true);
	});

	it('accepts valid time 09:05', () => {
		const result = validateTimeInput('09:05');
		expect(result.valid).toBe(true);
	});

	// Invalid times
	it('rejects hour 24', () => {
		const result = validateTimeInput('24:00');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Hours');
	});

	it('rejects hour 25', () => {
		const result = validateTimeInput('25:00');
		expect(result.valid).toBe(false);
	});

	it('rejects minute 60', () => {
		const result = validateTimeInput('12:60');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Minutes');
	});

	it('rejects negative hour', () => {
		const result = validateTimeInput('-01:00');
		expect(result.valid).toBe(false);
	});

	it('rejects negative minute', () => {
		const result = validateTimeInput('12:-05');
		expect(result.valid).toBe(false);
	});

	it('rejects non-numeric values', () => {
		const result = validateTimeInput('ab:cd');
		expect(result.valid).toBe(false);
	});

	it('rejects empty string', () => {
		const result = validateTimeInput('');
		expect(result.valid).toBe(false);
	});

	it('rejects null', () => {
		const result = validateTimeInput(null);
		expect(result.valid).toBe(false);
	});

	it('rejects malformed format (no colon)', () => {
		const result = validateTimeInput('1200');
		expect(result.valid).toBe(false);
	});

	it('rejects malformed format (too many parts)', () => {
		const result = validateTimeInput('12:00:00');
		expect(result.valid).toBe(false);
	});

	it('rejects already-converted AM/PM format', () => {
		const result = validateTimeInput('2:30 PM');
		expect(result.valid).toBe(false);
	});
});

describe('validateDateInput', () => {
	// Valid dates
	it('accepts valid date 2026-01-14', () => {
		const result = validateDateInput('2026-01-14');
		expect(result.valid).toBe(true);
	});

	it('accepts valid date 2026-12-31', () => {
		const result = validateDateInput('2026-12-31');
		expect(result.valid).toBe(true);
	});

	it('accepts leap year date 2024-02-29', () => {
		const result = validateDateInput('2024-02-29');
		expect(result.valid).toBe(true);
	});

	// Invalid dates
	it('rejects invalid month 13', () => {
		const result = validateDateInput('2026-13-01');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Month');
	});

	it('rejects invalid month 00', () => {
		const result = validateDateInput('2026-00-01');
		expect(result.valid).toBe(false);
	});

	it('rejects invalid day 32', () => {
		const result = validateDateInput('2026-01-32');
		expect(result.valid).toBe(false);
	});

	it('rejects invalid day 00', () => {
		const result = validateDateInput('2026-01-00');
		expect(result.valid).toBe(false);
	});

	it('rejects non-existent date Feb 30', () => {
		const result = validateDateInput('2026-02-30');
		expect(result.valid).toBe(false);
	});

	it('rejects non-existent date Feb 29 on non-leap year', () => {
		const result = validateDateInput('2025-02-29');
		expect(result.valid).toBe(false);
	});

	it('rejects malformed format (MM-DD-YYYY)', () => {
		const result = validateDateInput('01-14-2026');
		expect(result.valid).toBe(false);
	});

	it('rejects incomplete date (YYYY-MM)', () => {
		const result = validateDateInput('2026-01');
		expect(result.valid).toBe(false);
	});

	it('rejects empty string', () => {
		const result = validateDateInput('');
		expect(result.valid).toBe(false);
	});

	it('rejects null', () => {
		const result = validateDateInput(null);
		expect(result.valid).toBe(false);
	});
});

describe('validateWalkDistance', () => {
	// Valid distances
	it('accepts positive integer', () => {
		const result = validateWalkDistance(1000);
		expect(result.valid).toBe(true);
	});

	it('accepts positive decimal', () => {
		const result = validateWalkDistance(1609.34);
		expect(result.valid).toBe(true);
	});

	it('accepts small positive value', () => {
		const result = validateWalkDistance(0.1);
		expect(result.valid).toBe(true);
	});

	// Invalid distances
	it('rejects zero', () => {
		const result = validateWalkDistance(0);
		expect(result.valid).toBe(false);
	});

	it('rejects negative value', () => {
		const result = validateWalkDistance(-100);
		expect(result.valid).toBe(false);
	});

	it('rejects NaN', () => {
		const result = validateWalkDistance(NaN);
		expect(result.valid).toBe(false);
	});

	it('rejects non-numeric', () => {
		const result = validateWalkDistance('1000');
		expect(result.valid).toBe(false);
	});

	it('rejects null', () => {
		const result = validateWalkDistance(null);
		expect(result.valid).toBe(false);
	});

	it('rejects undefined', () => {
		const result = validateWalkDistance(undefined);
		expect(result.valid).toBe(false);
	});

	it('rejects Infinity', () => {
		const result = validateWalkDistance(Infinity);
		expect(result.valid).toBe(false);
	});
});
