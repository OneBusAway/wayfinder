import { describe, it, expect } from 'vitest';
import {
	parseServiceEntry,
	parseServiceList,
	onDemandServiceIds,
	resolvePickupBookingRule,
	contactBookingRule,
	serviceCalendars,
	drawableAreas
} from '$lib/onDemand/models.js';
import {
	entryBody,
	listBody,
	serviceJson,
	referencesJson,
	ruleJson,
	bookingRuleJson,
	parsedService,
	envelope
} from '../../fixtures/onDemand.js';

describe('parseServiceEntry', () => {
	it('joins the service to its agency and route', () => {
		const { service } = parseServiceEntry(entryBody());
		expect(service.agency.timezone).toBe('America/Los_Angeles');
		expect(service.route.color).toBe('0072CE');
		expect(service.rules[0].calendarIds).toEqual(['cal_mon_sat']);
	});

	it('maps unknown enum values to unknown and never throws on missing references', () => {
		const body = envelope({
			entry: serviceJson({ serviceKind: 'hovercraft', rules: undefined }),
			references: {}
		});
		const { service, refs } = parseServiceEntry(body);
		expect(service.serviceKind).toBe('unknown');
		expect(service.rules).toEqual([]);
		expect(service.agency).toBeNull();
		expect(refs.bookingRules.size).toBe(0);
	});

	it('keeps an out-of-range bookingType as data but nulls a non-integer one', () => {
		const refs = referencesJson({
			bookingRules: [
				bookingRuleJson({ bookingType: 7 }),
				bookingRuleJson({ id: 'x', bookingType: 'a' })
			]
		});
		const { refs: parsed } = parseServiceEntry(entryBody(serviceJson(), refs));
		expect(parsed.bookingRules.get('br_prior').bookingType).toBe(7);
		expect(parsed.bookingRules.get('x').bookingType).toBeNull();
	});
});

describe('parseServiceList', () => {
	it('shares one reference index across services and reports outOfRange', () => {
		const second = serviceJson({ id: '5088_2', routeId: null, name: 'Second' });
		const { services, outOfRange, refs } = parseServiceList(
			listBody([serviceJson(), second], referencesJson(), { outOfRange: true })
		);
		expect(services.map((s) => s.id)).toEqual(['5088_77652', '5088_2']);
		expect(services[1].route).toBeNull();
		expect(services[0].refs).toBe(refs);
		expect(outOfRange).toBe(true);
	});

	it('maps an unknown matchReason to unknown', () => {
		const { services } = parseServiceList(listBody([serviceJson({ matchReason: 'telepathy' })]));
		expect(services[0].matchReason).toBe('unknown');
	});
});

describe('lookups', () => {
	it('onDemandServiceIds defaults to an empty list', () => {
		expect(onDemandServiceIds({})).toEqual([]);
		expect(onDemandServiceIds(null)).toEqual([]);
		expect(onDemandServiceIds({ onDemandServiceIds: ['1_a'] })).toEqual(['1_a']);
	});

	it('resolvePickupBookingRule distinguishes none from dangling', () => {
		const service = parsedService({
			rules: [
				ruleJson({ pickupBookingRuleId: null }),
				ruleJson({ pickupBookingRuleId: 'missing' }),
				ruleJson()
			]
		});
		expect(resolvePickupBookingRule(service, service.rules[0])).toEqual({
			bookingRule: null,
			dangling: false
		});
		expect(resolvePickupBookingRule(service, service.rules[1])).toEqual({
			bookingRule: null,
			dangling: true
		});
		expect(resolvePickupBookingRule(service, service.rules[2]).bookingRule.id).toBe('br_prior');
	});

	it('contactBookingRule prefers the first rule with a resolvable pickup rule', () => {
		const service = parsedService({
			rules: [ruleJson({ pickupBookingRuleId: null }), ruleJson()]
		});
		expect(contactBookingRule(service).phoneNumber).toBe('703-746-5222');
	});

	it('contactBookingRule falls back to the first booking rule in references', () => {
		const service = parsedService({ rules: [ruleJson({ pickupBookingRuleId: null })] });
		expect(contactBookingRule(service).id).toBe('br_prior');
	});

	it('serviceCalendars returns only the calendars the rules reference', () => {
		const refs = referencesJson({
			calendars: [
				...referencesJson().calendars,
				{ id: 'other', days: ['sun'], startDate: null, endDate: null, exceptedDates: [] }
			]
		});
		const service = parsedService({}, refs);
		expect(serviceCalendars(service).map((c) => c.id)).toEqual(['cal_mon_sat']);
	});

	it('drawableAreas skips areas without geometry and unreferenced areas', () => {
		const refs = referencesJson({
			serviceAreas: [
				{ ...referencesJson().serviceAreas[0] },
				{ id: 'zone_b', name: 'No geometry', bbox: [0, 0, 1, 1] },
				{
					id: 'zone_c',
					name: 'Unreferenced',
					bbox: [0, 0, 1, 1],
					geometry: { type: 'Polygon', coordinates: [] }
				}
			]
		});
		const service = parsedService({ rules: [ruleJson({ toIds: ['zone_b'] })] }, refs);
		expect(drawableAreas(service).map((a) => a.id)).toEqual(['zone_a']);
	});
});
