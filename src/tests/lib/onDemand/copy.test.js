import { describe, it, expect } from 'vitest';
import en from '../../../locales/en.json';
import {
	formatStatus,
	formatBookingLine,
	formatRelativeDateTime,
	formatTravelDate,
	bookingTagKey
} from '$lib/onDemand/copy.js';

/** A tiny English `t` with {name} interpolation. Plural keys are not used here. */
function t(key, options = {}) {
	const template = key.split('.').reduce((node, part) => node?.[part], en);
	return template.replace(/\{(\w+)\}/g, (_, name) => options.values?.[name] ?? `{${name}}`);
}
const at = (s) => Temporal.Instant.from(s);
const ctx = {
	t,
	locale: 'en-US',
	timeZone: 'America/Detroit',
	now: at('2026-03-11T12:00:00-04:00')
};
const clean = (s) => s.replace(/ /g, ' ');

describe('formatRelativeDateTime', () => {
	it('uses today and tomorrow words within a day', () => {
		expect(clean(formatRelativeDateTime(at('2026-03-11T17:00:00-04:00'), ctx))).toBe(
			'today at 5:00 PM'
		);
		expect(clean(formatRelativeDateTime(at('2026-03-12T07:00:00-04:00'), ctx))).toBe(
			'tomorrow at 7:00 AM'
		);
		expect(clean(formatRelativeDateTime(at('2026-03-15T07:00:00-04:00'), ctx))).toBe(
			'Mar 15, 7:00 AM'
		);
	});
});

describe('formatStatus', () => {
	it('renders each status', () => {
		const until = at('2026-03-11T18:00:00-04:00');
		expect(clean(formatStatus({ kind: 'openNow', until }, ctx, 'row'))).toBe(
			'Open · until 6:00 PM'
		);
		expect(clean(formatStatus({ kind: 'openNow', until }, ctx, 'detail'))).toBe(
			'Open now · until 6:00 PM'
		);
		expect(formatStatus({ kind: 'openNow', until: null }, ctx, 'row')).toBe('Open');
		expect(
			clean(formatStatus({ kind: 'opensAt', instant: at('2026-03-12T07:00:00-04:00') }, ctx, 'row'))
		).toBe('Opens tomorrow at 7:00 AM');
		expect(formatStatus({ kind: 'closed' }, ctx, 'row')).toBe('Closed');
		expect(formatStatus({ kind: 'unknown' }, ctx, 'row')).toBeNull();
	});
});

describe('formatBookingLine', () => {
	it('renders the full deadline line', () => {
		const line = formatBookingLine(
			{
				kind: 'bookBy',
				cutoff: at('2026-03-11T17:00:00-04:00'),
				travelDate: Temporal.PlainDate.from('2026-03-12')
			},
			ctx
		);
		expect(clean(line)).toBe('Book by today at 5:00 PM for a ride on Thu, Mar 12');
	});
	it('covers the other resolutions', () => {
		expect(formatBookingLine({ kind: 'noNoticeRequired' }, ctx)).toBe(
			'No advance booking required'
		);
		expect(formatBookingLine({ kind: 'closed' }, ctx)).toBe(
			'Booking has closed for upcoming service'
		);
		expect(formatBookingLine({ kind: 'unknown' }, ctx)).toMatch(/has not published/);
	});
});

describe('small helpers', () => {
	it('formats travel dates and tag keys', () => {
		expect(formatTravelDate(Temporal.PlainDate.from('2026-03-12'), 'en-US')).toBe('Thu, Mar 12');
		expect(bookingTagKey('sameDay')).toBe('ondemand.tag_same_day');
		expect(bookingTagKey(null)).toBeNull();
	});
});
