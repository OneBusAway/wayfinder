import { describe, it, expect } from 'vitest';
import {
	formatCoordinates,
	buildOTPParams,
	buildOTPUrl,
	buildParamsFromOptions
} from '$lib/otp/otpUrlBuilder.js';

describe('formatCoordinates', () => {
	it('formats to 4 decimal places', () => {
		const result = formatCoordinates({ lat: 47.6062, lng: -122.3321 });
		expect(result).toBe('47.6062,-122.3321');
	});

	it('rounds correctly: 47.60621111 -> 47.6062', () => {
		const result = formatCoordinates({ lat: 47.60621111, lng: -122.33214567 });
		expect(result).toBe('47.6062,-122.3321');
	});

	it('rounds up correctly', () => {
		// Note: JS toFixed uses banker's rounding for .5 cases
		const result = formatCoordinates({ lat: 47.60626, lng: -122.33216 });
		expect(result).toBe('47.6063,-122.3322');
	});

	it('handles negative coordinates', () => {
		const result = formatCoordinates({ lat: -33.8688, lng: 151.2093 });
		expect(result).toBe('-33.8688,151.2093');
	});

	it('pads short decimals: 47.6 -> 47.6000', () => {
		const result = formatCoordinates({ lat: 47.6, lng: -122.3 });
		expect(result).toBe('47.6000,-122.3000');
	});

	it('formats as "lat,lng" string (not "lng,lat")', () => {
		const result = formatCoordinates({ lat: 47.0, lng: -122.0 });
		expect(result).toBe('47.0000,-122.0000');
		expect(result.split(',')[0]).toBe('47.0000'); // lat first
	});

	it('handles zero coordinates', () => {
		const result = formatCoordinates({ lat: 0, lng: 0 });
		expect(result).toBe('0.0000,0.0000');
	});

	it('handles edge case coordinates', () => {
		const result = formatCoordinates({ lat: 90, lng: 180 });
		expect(result).toBe('90.0000,180.0000');
	});
});

describe('buildOTPParams', () => {
	const baseRequest = {
		fromPlace: '47.6062,-122.3321',
		toPlace: '47.6205,-122.3493',
		time: '2:30 PM',
		date: '01-14-2026',
		mode: 'TRANSIT,WALK',
		arriveBy: false,
		maxWalkDistance: 4828,
		wheelchair: false,
		showIntermediateStops: true,
		transferPenalty: 0
	};

	it('includes all required parameters', () => {
		const params = buildOTPParams(baseRequest);
		expect(params.get('fromPlace')).toBe('47.6062,-122.3321');
		expect(params.get('toPlace')).toBe('47.6205,-122.3493');
		expect(params.get('time')).toBe('2:30 PM');
		expect(params.get('date')).toBe('01-14-2026');
		expect(params.get('mode')).toBe('TRANSIT,WALK');
		expect(params.get('arriveBy')).toBe('false');
		expect(params.get('maxWalkDistance')).toBe('4828');
		expect(params.get('wheelchair')).toBe('false');
		expect(params.get('showIntermediateStops')).toBe('true');
		expect(params.get('transferPenalty')).toBe('0');
	});

	it('formats arriveBy as string "true"', () => {
		const params = buildOTPParams({ ...baseRequest, arriveBy: true });
		expect(params.get('arriveBy')).toBe('true');
	});

	it('formats arriveBy as string "false"', () => {
		const params = buildOTPParams({ ...baseRequest, arriveBy: false });
		expect(params.get('arriveBy')).toBe('false');
	});

	it('formats wheelchair as string "true"', () => {
		const params = buildOTPParams({ ...baseRequest, wheelchair: true });
		expect(params.get('wheelchair')).toBe('true');
	});

	it('formats maxWalkDistance as string', () => {
		const params = buildOTPParams({ ...baseRequest, maxWalkDistance: 1609 });
		expect(params.get('maxWalkDistance')).toBe('1609');
	});

	it('formats transferPenalty as string', () => {
		const params = buildOTPParams({ ...baseRequest, transferPenalty: 600 });
		expect(params.get('transferPenalty')).toBe('600');
	});

	it('includes time with AM/PM format', () => {
		const params = buildOTPParams({ ...baseRequest, time: '9:30 AM' });
		expect(params.get('time')).toBe('9:30 AM');
	});

	it('includes date in MM-DD-YYYY format', () => {
		const params = buildOTPParams({ ...baseRequest, date: '12-31-2026' });
		expect(params.get('date')).toBe('12-31-2026');
	});
});

describe('buildOTPUrl', () => {
	const baseRequest = {
		fromPlace: '47.6062,-122.3321',
		toPlace: '47.6205,-122.3493',
		time: '2:30 PM',
		date: '01-14-2026',
		mode: 'TRANSIT,WALK',
		arriveBy: false,
		maxWalkDistance: 4828,
		wheelchair: false,
		showIntermediateStops: true,
		transferPenalty: 0
	};

	it('constructs URL with base and path', () => {
		const url = buildOTPUrl('https://otp.example.com', baseRequest);
		expect(url).toContain('https://otp.example.com/routers/default/plan?');
	});

	it('includes /routers/default/plan path', () => {
		const url = buildOTPUrl('https://otp.example.com', baseRequest);
		expect(url).toContain('/routers/default/plan');
	});

	it('handles base URL with trailing slash', () => {
		const url = buildOTPUrl('https://otp.example.com/', baseRequest);
		expect(url).toContain('https://otp.example.com/routers/default/plan?');
		expect(url).not.toContain('//routers');
	});

	it('handles base URL without trailing slash', () => {
		const url = buildOTPUrl('https://otp.example.com', baseRequest);
		expect(url).toContain('https://otp.example.com/routers/default/plan?');
	});

	it('properly encodes URL parameters', () => {
		const url = buildOTPUrl('https://otp.example.com', baseRequest);
		// Time with space and colon should be encoded
		expect(url).toContain('time=2%3A30+PM'); // URL encoded
	});

	it('produces valid URL string', () => {
		const url = buildOTPUrl('https://otp.example.com', baseRequest);
		expect(() => new URL(url)).not.toThrow();
	});

	it('includes all parameters in the URL', () => {
		const url = buildOTPUrl('https://otp.example.com', baseRequest);
		expect(url).toContain('fromPlace=');
		expect(url).toContain('toPlace=');
		expect(url).toContain('time=');
		expect(url).toContain('date=');
		expect(url).toContain('mode=');
		expect(url).toContain('arriveBy=');
		expect(url).toContain('maxWalkDistance=');
		expect(url).toContain('wheelchair=');
		expect(url).toContain('showIntermediateStops=');
		expect(url).toContain('transferPenalty=');
	});
});

describe('buildParamsFromOptions', () => {
	const from = { lat: 47.6062, lng: -122.3321 };
	const to = { lat: 47.6205, lng: -122.3493 };

	it('formats coordinates with 4 decimal places', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026'
		});
		expect(params.get('fromPlace')).toBe('47.6062,-122.3321');
		expect(params.get('toPlace')).toBe('47.6205,-122.3493');
	});

	it('uses default mode when not specified', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026'
		});
		expect(params.get('mode')).toBe('TRANSIT,WALK');
	});

	it('uses default maxWalkDistance when not specified', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026'
		});
		expect(params.get('maxWalkDistance')).toBe('4828');
	});

	it('uses custom maxWalkDistance when specified', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026',
			maxWalkDistance: 1609
		});
		expect(params.get('maxWalkDistance')).toBe('1609');
	});

	it('uses default wheelchair=false when not specified', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026'
		});
		expect(params.get('wheelchair')).toBe('false');
	});

	it('uses default arriveBy=false when not specified', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026'
		});
		expect(params.get('arriveBy')).toBe('false');
	});

	it('uses default transferPenalty=0 when not specified', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026'
		});
		expect(params.get('transferPenalty')).toBe('0');
	});

	it('applies custom transferPenalty', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026',
			transferPenalty: 600
		});
		expect(params.get('transferPenalty')).toBe('600');
	});

	it('applies wheelchair=true', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026',
			wheelchair: true
		});
		expect(params.get('wheelchair')).toBe('true');
	});

	it('applies arriveBy=true', () => {
		const params = buildParamsFromOptions(from, to, {
			time: '2:30 PM',
			date: '01-14-2026',
			arriveBy: true
		});
		expect(params.get('arriveBy')).toBe('true');
	});
});
