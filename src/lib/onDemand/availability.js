import { createEvaluator, LOOKAHEAD_DAYS, parseGtfsTime } from '$lib/onDemand/bookingDeadline.js';
import { resolveBooking } from '$lib/onDemand/bookingResolution.js';
import { compareInstants, earliestAfter } from '$lib/onDemand/instants.js';
import { resolvePickupBookingRule, serviceCalendars } from '$lib/onDemand/models.js';

/**
 * What a rider can do with a service right now: a port of the DRT UI design
 * §2.5–2.6 and iOS OnDemandAvailability. Pure; surfaces render the result and
 * re-evaluate at `nextChangeInstant`.
 */

export const TIER = { OPEN_NOW: 1, SAME_DAY: 2, ADVANCE: 3, ELIGIBILITY: 4, UNKNOWN: 5 };

const BOOKING_TIERS = ['realTime', 'sameDay', 'advance'];
const SECONDS_PER_DAY = 86400;

/**
 * @param {string | null | undefined} timeZone
 * @returns {boolean}
 */
export function isValidTimeZone(timeZone) {
	if (!timeZone) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return true;
	} catch {
		return false;
	}
}

function unknownAvailability() {
	return {
		status: { kind: 'unknown' },
		tier: TIER.UNKNOWN,
		bookingTier: null,
		nextBookableServiceDate: null,
		nextChangeInstant: null,
		resolution: { kind: 'unknown' },
		timeZone: null,
		today: null
	};
}

/**
 * @param {import('./models.js').OnDemandService} service
 * @param {Temporal.Instant} now
 */
export function evaluateAvailability(service, now) {
	const timeZone = service.agency?.timezone;
	if (!isValidTimeZone(timeZone)) return unknownAvailability();

	const evaluator = createEvaluator(timeZone, serviceCalendars(service));
	const today = evaluator.serviceDate(now);
	const context = { service, evaluator, timeZone };

	// Windows pass 24:00, so the previous service day is checked too.
	const containing = windowsOn(context, [today.subtract({ days: 1 }), today]).filter(
		(window) => compareInstants(window.start, now) <= 0 && compareInstants(now, window.end) < 0
	);
	const runningNow = containing.length > 0;
	const runningUntil = runningNow ? runningUntilInstant(context, containing) : null;
	const nextRunStart = runningNow ? null : nextWindowStart(context, now, today, false);
	const firstActiveDate = firstDateWithService(context, today);
	const bookingTier = bookingTierOn(context, firstActiveDate);
	const bookableNow = containing.some((window) => isOpen(context, window.rule, window.date, now));
	const nextBookableServiceDate = earliestNextBookable(context, now);
	const { resolution, nextChangeInstant: bookingChange } = resolveBooking(service, evaluator, now);

	// A running service past its cutoff opens again at the first window starting
	// at or after the current one's end (ruling I4).
	const nextOpening =
		runningNow && !bookableNow
			? nextWindowStart(context, runningUntil ?? now, today, true)
			: nextRunStart;

	const status = chooseStatus({
		bookingTier,
		resolution,
		runningNow,
		bookableNow,
		runningUntil,
		nextOpening,
		hasUsableCalendar: service.rules.some((rule) => evaluator.hasUsableCalendar(rule)),
		hasServiceDay: firstActiveDate != null
	});

	// The tier depends on "today", so the agency-local midnight is always a change.
	const nextMidnight = evaluator.anchor(today.add({ days: 1 }));
	return {
		status,
		tier: usabilityTier(status, nextBookableServiceDate, today),
		bookingTier,
		nextBookableServiceDate,
		nextChangeInstant: earliestAfter(
			[runningUntil, nextRunStart, bookingChange, nextMidnight],
			now
		),
		resolution,
		timeZone,
		today
	};
}

function usabilityTier(status, nextBookableServiceDate, today) {
	if (status.kind === 'openNow') return TIER.OPEN_NOW;
	if (status.kind === 'closed' || status.kind === 'unknown') return TIER.UNKNOWN;
	if (!nextBookableServiceDate) return TIER.UNKNOWN;
	return nextBookableServiceDate.equals(today) ? TIER.SAME_DAY : TIER.ADVANCE;
}

function chooseStatus({
	bookingTier,
	resolution,
	runningNow,
	bookableNow,
	runningUntil,
	nextOpening,
	hasUsableCalendar,
	hasServiceDay
}) {
	if (bookingTier === 'advance') {
		switch (resolution.kind) {
			case 'bookBy':
				return { kind: 'bookBy', deadline: resolution.cutoff, travelDate: resolution.travelDate };
			case 'opensAt':
				return { kind: 'bookingOpens', instant: resolution.instant };
			case 'closed':
				return { kind: 'closed' };
			default:
				return { kind: 'unknown' };
		}
	}
	if (runningNow && bookableNow) return { kind: 'openNow', until: runningUntil };
	if (nextOpening) return { kind: 'opensAt', instant: nextOpening };
	// Running past the cutoff on the last service day: nothing is left to book.
	if (runningNow) return { kind: 'closed' };
	if (!hasUsableCalendar) return { kind: 'unknown' };
	return hasServiceDay ? { kind: 'unknown' } : { kind: 'closed' };
}

// An all-day rule spans true wall-clock midnight to midnight, not the anchor's
// fixed 24 hours, so a DST day doesn't open a gap between consecutive windows.
function windowFor({ evaluator, timeZone }, rule, date) {
	const start = parseGtfsTime(rule.startPickupTime);
	const end = parseGtfsTime(rule.endPickupTime);
	if (start == null && end == null) {
		return {
			rule,
			date,
			start: date.toZonedDateTime({ timeZone }).toInstant(),
			end: date.add({ days: 1 }).toZonedDateTime({ timeZone }).toInstant()
		};
	}
	return {
		rule,
		date,
		start: evaluator.instant(date, start ?? 0),
		end: evaluator.instant(date, end ?? SECONDS_PER_DAY)
	};
}

function windowsOn(context, dates) {
	return dates.flatMap((date) =>
		context.service.rules
			.filter((rule) => context.evaluator.isRuleActive(rule, date))
			.map((rule) => windowFor(context, rule, date))
	);
}

// Null when the latest end touches the next service day's first window, so a
// continuous service reads "Open" rather than "until 12:00 AM".
function runningUntilInstant(context, containing) {
	const latest = containing.reduce((a, b) => (compareInstants(b.end, a.end) > 0 ? b : a));
	const nextDayWindows = windowsOn(context, [latest.date.add({ days: 1 })]);
	const abuts = nextDayWindows.some((window) => compareInstants(window.start, latest.end) <= 0);
	return abuts ? null : latest.end;
}

function nextWindowStart(context, after, today, inclusive) {
	let best = null;
	for (let offset = -1; offset <= LOOKAHEAD_DAYS; offset++) {
		const date = today.add({ days: offset });
		if (best && compareInstants(context.evaluator.anchor(date), best) >= 0) break;
		for (const window of windowsOn(context, [date])) {
			const order = compareInstants(window.start, after);
			const isAfter = inclusive ? order >= 0 : order > 0;
			if (isAfter && (!best || compareInstants(window.start, best) < 0)) best = window.start;
		}
	}
	return best;
}

function firstDateWithService({ service, evaluator }, today) {
	for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset++) {
		const date = today.add({ days: offset });
		if (service.rules.some((rule) => evaluator.isRuleActive(rule, date))) return date;
	}
	return null;
}

// The least demanding pickup booking type among rules active on the next
// service day. A null id counts as real time; a dangling id is skipped.
function bookingTierOn({ service, evaluator }, date) {
	if (!date) return null;
	const types = service.rules
		.filter((rule) => evaluator.isRuleActive(rule, date))
		.map((rule) => {
			if (rule.pickupBookingRuleId == null) return 0;
			return resolvePickupBookingRule(service, rule).bookingRule?.bookingType;
		})
		.filter((type) => type === 0 || type === 1 || type === 2);
	return types.length ? BOOKING_TIERS[Math.min(...types)] : null;
}

function isOpen({ service, evaluator }, rule, date, now) {
	const { bookingRule, dangling } = resolvePickupBookingRule(service, rule);
	if (dangling) return false;
	return evaluator.evaluate(rule, bookingRule, date, now).state === 'open';
}

function earliestNextBookable({ service, evaluator }, now) {
	let earliest = null;
	for (const rule of service.rules) {
		const { bookingRule, dangling } = resolvePickupBookingRule(service, rule);
		if (dangling) continue;
		const date = evaluator.nextBookableServiceDate(rule, bookingRule, now);
		if (date && (!earliest || Temporal.PlainDate.compare(date, earliest) < 0)) earliest = date;
	}
	return earliest;
}

/**
 * @template {{ service: { name: string }, availability: { tier: number } }} T
 * @param {T[]} items
 * @param {string} [locale]
 * @returns {T[]}
 */
export function sortByAvailability(items, locale) {
	const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
	return [...items].sort(
		(a, b) =>
			a.availability.tier - b.availability.tier || collator.compare(a.service.name, b.service.name)
	);
}
