import { describe, it, expect } from 'vitest';
import { evaluateAvailability, sortByAvailability, TIER } from '$lib/onDemand/availability.js';
import { resolveBooking } from '$lib/onDemand/bookingResolution.js';
import { createEvaluator } from '$lib/onDemand/bookingDeadline.js';
import { serviceCalendars } from '$lib/onDemand/models.js';
import { parsedService, ruleJson, bookingRuleJson } from '../../fixtures/onDemand.js';

const at = (s) => Temporal.Instant.from(s);
const DETROIT = [{ id: '5088', name: 'MTA', timezone: 'America/Detroit' }];
const WEEKDAYS = {
	id: 'wk',
	days: ['mon', 'tue', 'wed', 'thu', 'fri'],
	startDate: '2026-01-01',
	endDate: '2026-12-31',
	exceptedDates: []
};
const EVERY_DAY = {
	...WEEKDAYS,
	id: 'all',
	days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
};

/** A Detroit weekday service 07:00–18:00 with the given pickup booking rule. */
function detroitService(bookingRule, ruleOverrides = {}, refOverrides = {}) {
	return parsedService(
		{
			rules: [
				ruleJson({
					startPickupTime: '07:00:00',
					endPickupTime: '18:00:00',
					calendarIds: ['wk'],
					pickupBookingRuleId: bookingRule ? bookingRule.id : null,
					...ruleOverrides
				})
			]
		},
		{
			agencies: DETROIT,
			calendars: [WEEKDAYS, EVERY_DAY],
			bookingRules: bookingRule ? [bookingRule] : [],
			...refOverrides
		}
	);
}
const realTime = bookingRuleJson({
	id: 'rt',
	bookingType: 0,
	priorNoticeLastDay: null,
	priorNoticeLastTime: null,
	priorNoticeStartDay: null,
	priorNoticeStartTime: null
});
const sameDay60 = bookingRuleJson({
	id: 'sd',
	bookingType: 1,
	priorNoticeDurationMin: 60,
	priorNoticeLastDay: null,
	priorNoticeLastTime: null,
	priorNoticeStartDay: null,
	priorNoticeStartTime: null
});

describe('resolveBooking', () => {
	const resolve = (service, now) =>
		resolveBooking(
			service,
			createEvaluator(service.agency.timezone, serviceCalendars(service)),
			now
		);

	it('books the Alexandria prior-day service by 17:00 the day before', () => {
		const { resolution } = resolve(parsedService(), at('2026-03-10T16:59:00-07:00'));
		expect(resolution.kind).toBe('bookBy');
		expect(resolution.cutoff.equals(at('2026-03-10T17:00:00-07:00'))).toBe(true);
		expect(resolution.travelDate.toString()).toBe('2026-03-11');
	});

	it('needs no notice when the pickup booking rule id is null', () => {
		expect(resolve(detroitService(null), at('2026-03-11T12:00:00-04:00')).resolution.kind).toBe(
			'noNoticeRequired'
		);
	});

	it('is unknown when a pickup booking rule id dangles', () => {
		const service = detroitService(null, { pickupBookingRuleId: 'missing' });
		expect(resolve(service, at('2026-03-11T12:00:00-04:00')).resolution.kind).toBe('unknown');
	});

	it('opens later when every date is not yet bookable', () => {
		const opensLater = bookingRuleJson({
			id: 'ol',
			priorNoticeLastDay: 1,
			priorNoticeStartDay: 1,
			priorNoticeStartTime: '12:00:00'
		});
		const oneDay = { ...WEEKDAYS, id: 'one', startDate: '2026-03-20', endDate: '2026-03-20' };
		const service = detroitService(opensLater, { calendarIds: ['one'] }, { calendars: [oneDay] });
		const { resolution } = resolve(service, at('2026-03-10T12:00:00-04:00'));
		expect(resolution.kind).toBe('opensAt');
		expect(resolution.instant.equals(at('2026-03-19T12:00:00-04:00'))).toBe(true);
	});

	it('is closed when the calendar has ended', () => {
		const ended = { ...WEEKDAYS, id: 'old', startDate: '2025-01-01', endDate: '2025-12-31' };
		const service = detroitService(realTime, { calendarIds: ['old'] }, { calendars: [ended] });
		expect(resolve(service, at('2026-03-11T12:00:00-04:00')).resolution.kind).toBe('closed');
	});

	it('is unknown for a service with no rules', () => {
		const service = parsedService({ rules: [] }, { agencies: DETROIT });
		expect(resolve(service, at('2026-03-11T12:00:00-04:00')).resolution.kind).toBe('unknown');
	});
});

describe('evaluateAvailability', () => {
	it('is open now until the window ends for a running real-time service', () => {
		const result = evaluateAvailability(detroitService(realTime), at('2026-03-11T12:00:00-04:00'));
		expect(result.status.kind).toBe('openNow');
		expect(result.status.until.equals(at('2026-03-11T18:00:00-04:00'))).toBe(true);
		expect(result.tier).toBe(TIER.OPEN_NOW);
		expect(result.bookingTier).toBe('realTime');
		expect(result.nextChangeInstant.equals(at('2026-03-11T18:00:00-04:00'))).toBe(true);
	});

	it('opens at the next window after hours', () => {
		const result = evaluateAvailability(detroitService(realTime), at('2026-03-11T19:00:00-04:00'));
		expect(result.status.kind).toBe('opensAt');
		expect(result.status.instant.equals(at('2026-03-12T07:00:00-04:00'))).toBe(true);
		expect(result.tier).toBe(TIER.ADVANCE);
	});

	it('reads "Open" with no end for a continuous all-hours service', () => {
		const service = detroitService(null, {
			startPickupTime: null,
			endPickupTime: null,
			calendarIds: ['all']
		});
		const result = evaluateAvailability(service, at('2026-03-11T12:00:00-04:00'));
		expect(result.status).toEqual({ kind: 'openNow', until: null });
	});

	it('shows the prior-day deadline for an advance service', () => {
		const result = evaluateAvailability(parsedService(), at('2026-03-10T16:59:00-07:00'));
		expect(result.status.kind).toBe('bookBy');
		expect(result.status.travelDate.toString()).toBe('2026-03-11');
		expect(result.bookingTier).toBe('advance');
		expect(result.tier).toBe(TIER.ADVANCE);
	});

	it('opens at the next window when running past a same-day cutoff (ruling I4)', () => {
		const result = evaluateAvailability(detroitService(sameDay60), at('2026-03-11T17:30:00-04:00'));
		expect(result.status.kind).toBe('opensAt');
		expect(result.status.instant.equals(at('2026-03-12T07:00:00-04:00'))).toBe(true);
	});

	it('keeps a window running past midnight open on the next civil day', () => {
		const service = detroitService(realTime, {
			startPickupTime: '05:00:00',
			endPickupTime: '24:50:00',
			calendarIds: ['all']
		});
		const result = evaluateAvailability(service, at('2026-03-12T00:30:00-04:00'));
		expect(result.status.kind).toBe('openNow');
		expect(result.status.until.equals(at('2026-03-12T00:50:00-04:00'))).toBe(true);
	});

	it('is unknown without a valid agency timezone', () => {
		const service = parsedService(
			{},
			{ agencies: [{ id: '5088', name: 'X', timezone: 'Mars/Olympus' }] }
		);
		const result = evaluateAvailability(service, at('2026-03-11T12:00:00Z'));
		expect(result.status.kind).toBe('unknown');
		expect(result.tier).toBe(TIER.UNKNOWN);
		expect(result.nextChangeInstant).toBeNull();
	});

	it('is closed with tier 5 when every calendar has ended', () => {
		const ended = { ...WEEKDAYS, id: 'old', startDate: '2025-01-01', endDate: '2025-12-31' };
		const service = detroitService(realTime, { calendarIds: ['old'] }, { calendars: [ended] });
		const result = evaluateAvailability(service, at('2026-03-11T12:00:00-04:00'));
		expect(result.status.kind).toBe('closed');
		expect(result.tier).toBe(TIER.UNKNOWN);
	});

	it('is unknown with tier 5 for a service with no rules', () => {
		const result = evaluateAvailability(parsedService({ rules: [] }), at('2026-03-11T12:00:00Z'));
		expect(result.status.kind).toBe('unknown');
		expect(result.tier).toBe(TIER.UNKNOWN);
	});
});

describe('sortByAvailability', () => {
	it('orders by tier, then by name with numeric collation', () => {
		const item = (name, tier) => ({ service: { name }, availability: { tier } });
		const sorted = sortByAvailability(
			[item('Zone 10', 3), item('Zone 2', 3), item('Beta', 1), item('Alpha', 5)],
			'en'
		);
		expect(sorted.map((entry) => entry.service.name)).toEqual([
			'Beta',
			'Zone 2',
			'Zone 10',
			'Alpha'
		]);
	});
});
