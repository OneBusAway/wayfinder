/**
 * Parsing for maglev's /api/ondemand responses. Parsing never throws on
 * well-formed JSON: unknown enum values become 'unknown', missing arrays become
 * [], missing scalars become null. Services are joined with their references so
 * later code needs no lookups beyond `service.refs`.
 */

const SERVICE_KINDS = new Set(['zone', 'zoneToZone', 'stopGroup', 'deviatedRoute']);
const MATCH_REASONS = new Set([
	'areaContainsPoint',
	'stopWithinRadius',
	'areaNearby',
	'areaIntersectsViewport',
	'stopWithinViewport'
]);

/**
 * @typedef {Object} OnDemandRefs
 * @property {Map<string, any>} agencies
 * @property {Map<string, any>} routes
 * @property {Map<string, any>} stops
 * @property {Map<string, any>} serviceAreas
 * @property {Map<string, any>} locationGroups
 * @property {Map<string, any>} bookingRules
 * @property {Map<string, any>} calendars
 */

/**
 * @typedef {Object} AvailabilityRule
 * @property {string[]} fromIds
 * @property {string[]} toIds
 * @property {string | null} startPickupTime
 * @property {string | null} endPickupTime
 * @property {string | null} endDropOffTime
 * @property {string[]} calendarIds
 * @property {number | null} pickupType
 * @property {number | null} dropOffType
 * @property {string | null} pickupBookingRuleId
 * @property {string | null} dropOffBookingRuleId
 * @property {number | null} safeDurationFactor
 * @property {number | null} safeDurationOffset
 */

/**
 * @typedef {Object} OnDemandService
 * @property {string} id
 * @property {string} agencyId
 * @property {string | null} routeId
 * @property {string} name
 * @property {string | null} description
 * @property {string | null} url
 * @property {string} serviceKind
 * @property {string | null} matchReason
 * @property {AvailabilityRule[]} rules
 * @property {any | null} agency
 * @property {any | null} route
 * @property {OnDemandRefs} refs
 */

const arrayOr = (value) => (Array.isArray(value) ? value : []);
const orNull = (value) => value ?? null;
const indexById = (items) => new Map(arrayOr(items).map((item) => [item.id, item]));

/**
 * @param {any} raw - `data.references`
 * @returns {OnDemandRefs}
 */
export function parseReferences(raw) {
	const references = raw ?? {};
	return {
		agencies: indexById(references.agencies),
		routes: indexById(references.routes),
		stops: indexById(references.stops),
		serviceAreas: indexById(arrayOr(references.serviceAreas).map(parseServiceArea)),
		locationGroups: indexById(
			arrayOr(references.locationGroups).map((group) => ({
				id: group.id,
				name: orNull(group.name),
				stopIds: arrayOr(group.stopIds)
			}))
		),
		bookingRules: indexById(arrayOr(references.bookingRules).map(parseBookingRule)),
		calendars: indexById(arrayOr(references.calendars).map(parseCalendar))
	};
}

function parseServiceArea(area) {
	return {
		id: area.id,
		name: orNull(area.name),
		description: orNull(area.description),
		bbox: Array.isArray(area.bbox) && area.bbox.length === 4 ? area.bbox : null,
		geometry: orNull(area.geometry),
		distanceToArea: orNull(area.distanceToArea),
		nearestPointOnBoundary: orNull(area.nearestPointOnBoundary)
	};
}

function parseBookingRule(rule) {
	return {
		id: rule.id,
		bookingType: Number.isInteger(rule.bookingType) ? rule.bookingType : null,
		priorNoticeDurationMin: orNull(rule.priorNoticeDurationMin),
		priorNoticeDurationMax: orNull(rule.priorNoticeDurationMax),
		priorNoticeLastDay: orNull(rule.priorNoticeLastDay),
		priorNoticeLastTime: orNull(rule.priorNoticeLastTime),
		priorNoticeStartDay: orNull(rule.priorNoticeStartDay),
		priorNoticeStartTime: orNull(rule.priorNoticeStartTime),
		priorNoticeCalendarId: orNull(rule.priorNoticeCalendarId),
		message: orNull(rule.message),
		pickupMessage: orNull(rule.pickupMessage),
		dropOffMessage: orNull(rule.dropOffMessage),
		phoneNumber: orNull(rule.phoneNumber),
		infoUrl: orNull(rule.infoUrl),
		bookingUrl: orNull(rule.bookingUrl)
	};
}

function parseCalendar(calendar) {
	return {
		id: calendar.id,
		days: arrayOr(calendar.days),
		startDate: orNull(calendar.startDate),
		endDate: orNull(calendar.endDate),
		exceptedDates: arrayOr(calendar.exceptedDates)
	};
}

/** @returns {AvailabilityRule} */
function parseRule(rule) {
	return {
		fromIds: arrayOr(rule.fromIds),
		toIds: arrayOr(rule.toIds),
		startPickupTime: orNull(rule.startPickupTime),
		endPickupTime: orNull(rule.endPickupTime),
		endDropOffTime: orNull(rule.endDropOffTime),
		calendarIds: arrayOr(rule.calendarIds),
		pickupType: orNull(rule.pickupType),
		dropOffType: orNull(rule.dropOffType),
		pickupBookingRuleId: orNull(rule.pickupBookingRuleId),
		dropOffBookingRuleId: orNull(rule.dropOffBookingRuleId),
		safeDurationFactor: orNull(rule.safeDurationFactor),
		safeDurationOffset: orNull(rule.safeDurationOffset)
	};
}

/**
 * @param {any} raw
 * @param {OnDemandRefs} refs
 * @returns {OnDemandService}
 */
function parseService(raw, refs) {
	const routeId = orNull(raw.routeId);
	return {
		id: raw.id,
		agencyId: raw.agencyId,
		routeId,
		name: raw.name ?? raw.id,
		description: orNull(raw.description),
		url: orNull(raw.url),
		serviceKind: SERVICE_KINDS.has(raw.serviceKind) ? raw.serviceKind : 'unknown',
		matchReason:
			raw.matchReason == null
				? null
				: MATCH_REASONS.has(raw.matchReason)
					? raw.matchReason
					: 'unknown',
		rules: arrayOr(raw.rules).map(parseRule),
		agency: refs.agencies.get(raw.agencyId) ?? null,
		route: routeId ? (refs.routes.get(routeId) ?? null) : null,
		refs
	};
}

/**
 * @param {any} body - services-for-location response envelope
 * @returns {{ services: OnDemandService[], outOfRange: boolean, refs: OnDemandRefs }}
 */
export function parseServiceList(body) {
	const data = body?.data ?? {};
	const refs = parseReferences(data.references);
	return {
		services: arrayOr(data.list).map((raw) => parseService(raw, refs)),
		outOfRange: data.outOfRange === true,
		refs
	};
}

/**
 * @param {any} body - service/{id} response envelope
 * @returns {{ service: OnDemandService, refs: OnDemandRefs }}
 */
export function parseServiceEntry(body) {
	const data = body?.data ?? {};
	const refs = parseReferences(data.references);
	return { service: parseService(data.entry ?? {}, refs), refs };
}

/**
 * @param {{ onDemandServiceIds?: string[] } | null | undefined} entity - a stop or route
 * @returns {string[]}
 */
export function onDemandServiceIds(entity) {
	return arrayOr(entity?.onDemandServiceIds);
}

/**
 * A null id means no booking is needed; a non-null id that references carry no
 * rule for is dangling, which the booking logic treats as unknown.
 * @param {OnDemandService} service
 * @param {AvailabilityRule} rule
 * @returns {{ bookingRule: any | null, dangling: boolean }}
 */
export function resolvePickupBookingRule(service, rule) {
	if (rule.pickupBookingRuleId == null) return { bookingRule: null, dangling: false };
	const bookingRule = service.refs.bookingRules.get(rule.pickupBookingRuleId) ?? null;
	return { bookingRule, dangling: bookingRule == null };
}

/**
 * The booking rule whose phone, URLs and messages the UI shows: the pickup rule
 * of the first availability rule that has one, else the first in references.
 * @param {OnDemandService} service
 */
export function contactBookingRule(service) {
	for (const rule of service.rules) {
		const { bookingRule } = resolvePickupBookingRule(service, rule);
		if (bookingRule) return bookingRule;
	}
	return service.refs.bookingRules.values().next().value ?? null;
}

/**
 * @param {OnDemandService} service
 * @returns {Array<{ id: string, days: string[], startDate: string | null, endDate: string | null, exceptedDates: string[] }>}
 */
export function serviceCalendars(service) {
	const ids = new Set(service.rules.flatMap((rule) => rule.calendarIds));
	return [...ids].map((id) => service.refs.calendars.get(id)).filter(Boolean);
}

/**
 * @param {OnDemandService} service
 * @returns {string[]} ids from every rule's fromIds and toIds, first-seen order
 */
export function referencedLocationIds(service) {
	return [...new Set(service.rules.flatMap((rule) => [...rule.fromIds, ...rule.toIds]))];
}

/**
 * @param {OnDemandService} service
 */
export function drawableAreas(service) {
	return referencedLocationIds(service)
		.map((id) => service.refs.serviceAreas.get(id))
		.filter((area) => area?.geometry);
}
