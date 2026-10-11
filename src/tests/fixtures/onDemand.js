import { parseServiceEntry } from '$lib/onDemand/models.js';

export const envelope = (data, code = 200) => ({
	code,
	currentTime: 0,
	text: 'OK',
	version: 2,
	data
});

export const square = (west, south, east, north) => ({
	type: 'Polygon',
	coordinates: [
		[
			[west, south],
			[east, south],
			[east, north],
			[west, north],
			[west, south]
		]
	]
});

/** Alexandria-style prior-day booking: book by 17:00 the day before, opens 14 days out. */
export function bookingRuleJson(overrides = {}) {
	return {
		id: 'br_prior',
		bookingType: 2,
		priorNoticeDurationMin: null,
		priorNoticeDurationMax: null,
		priorNoticeLastDay: 1,
		priorNoticeLastTime: '17:00:00',
		priorNoticeStartDay: 14,
		priorNoticeStartTime: '00:00:00',
		priorNoticeCalendarId: null,
		message: 'Call to book your ride.',
		pickupMessage: null,
		dropOffMessage: null,
		phoneNumber: '703-746-5222',
		infoUrl: null,
		bookingUrl: null,
		...overrides
	};
}

export function ruleJson(overrides = {}) {
	return {
		fromIds: ['zone_a'],
		toIds: ['zone_a'],
		startPickupTime: '05:00:00',
		endPickupTime: '24:50:00',
		endDropOffTime: null,
		calendarIds: ['cal_mon_sat'],
		pickupType: 2,
		dropOffType: 2,
		pickupBookingRuleId: 'br_prior',
		dropOffBookingRuleId: null,
		safeDurationFactor: null,
		safeDurationOffset: null,
		...overrides
	};
}

export function serviceJson(overrides = {}) {
	return {
		id: '5088_77652',
		agencyId: '5088',
		routeId: '5088_77652',
		name: 'DASH On Demand',
		description: null,
		url: 'https://dashbus.com/ondemand',
		serviceKind: 'zone',
		rules: [ruleJson()],
		...overrides
	};
}

export function referencesJson(overrides = {}) {
	return {
		agencies: [{ id: '5088', name: 'DASH', timezone: 'America/Los_Angeles' }],
		routes: [{ id: '5088_77652', agencyId: '5088', shortName: 'OD', color: '0072CE' }],
		stops: [],
		trips: [],
		stopTimes: [],
		situations: [],
		serviceAreas: [
			{
				id: 'zone_a',
				name: 'West End',
				bbox: [-77.14, 38.79, -77.05, 38.84],
				geometry: square(-77.14, 38.79, -77.05, 38.84)
			}
		],
		locationGroups: [],
		bookingRules: [bookingRuleJson()],
		calendars: [
			{
				id: 'cal_mon_sat',
				days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
				startDate: '2025-12-01',
				endDate: '2026-12-01',
				exceptedDates: []
			}
		],
		...overrides
	};
}

export const entryBody = (service = serviceJson(), references = referencesJson()) =>
	envelope({ entry: service, references });

export const listBody = (services = [serviceJson()], references = referencesJson(), extra = {}) =>
	envelope({ limitExceeded: false, outOfRange: false, list: services, references, ...extra });

export const parsedService = (serviceOverrides = {}, referenceOverrides = {}) =>
	parseServiceEntry(entryBody(serviceJson(serviceOverrides), referencesJson(referenceOverrides)))
		.service;
