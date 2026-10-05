/**
 * Booking-deadline evaluation, normative per wiki "GTFS-Flex Support" §2.5 as
 * refined by maglev docs/superpowers/specs/2026-09-24-gtfs-flex-implementation-design.md §6.
 * Shared with iOS (BookingDeadlineEvaluator.swift) and Android; the vectors in
 * src/tests/fixtures/flex-booking-vectors.json pin all three to one algorithm.
 *
 * All arithmetic is in service days of the agency timezone. A service day's
 * times are offsets from its DST-safe anchor, local noon minus 12 hours.
 */

export const LOOKAHEAD_DAYS = 400;

const SECONDS_PER_DAY = 86400;
const WEEKDAY_NUMBERS = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const UNKNOWN = Object.freeze({ state: 'unknown', cutoffInstant: null, openInstant: null });

/**
 * @param {string | null | undefined} value - GTFS "H:MM:SS"; hours may exceed 24
 * @returns {number | null} seconds since the service-day anchor
 */
export function parseGtfsTime(value) {
	if (typeof value !== 'string') return null;
	const match = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(value.trim());
	if (!match) return null;
	return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function parsePlainDate(value) {
	if (!value) return null;
	try {
		return Temporal.PlainDate.from(value);
	} catch {
		return null;
	}
}

const compareDates = (a, b) => Temporal.PlainDate.compare(a, b);

/**
 * @param {string} timeZone - IANA agency timezone
 * @param {Array<{ id: string, days: string[], startDate: string | null, endDate: string | null, exceptedDates: string[] }>} calendars
 */
export function createEvaluator(timeZone, calendars) {
	const calendarsById = new Map(
		calendars.map((calendar) => [
			calendar.id,
			{
				startDate: parsePlainDate(calendar.startDate),
				endDate: parsePlainDate(calendar.endDate),
				days: new Set(calendar.days.map((day) => WEEKDAY_NUMBERS[day]).filter(Boolean)),
				exceptedDates: new Set(calendar.exceptedDates)
			}
		])
	);

	function anchor(date) {
		return date
			.toZonedDateTime({ timeZone, plainTime: '12:00' })
			.subtract({ hours: 12 })
			.toInstant();
	}

	function instant(date, seconds) {
		return anchor(date).add({ seconds });
	}

	function serviceDate(now) {
		return now.toZonedDateTimeISO(timeZone).toPlainDate();
	}

	function isActive(calendarId, date) {
		const calendar = calendarsById.get(calendarId);
		if (!calendar?.startDate || !calendar.endDate) return false;
		if (compareDates(date, calendar.startDate) < 0 || compareDates(date, calendar.endDate) > 0) {
			return false;
		}
		return calendar.days.has(date.dayOfWeek) && !calendar.exceptedDates.has(date.toString());
	}

	function isRuleActive(rule, date) {
		return rule.calendarIds.some((id) => isActive(id, date));
	}

	function hasUsableCalendar(rule) {
		return rule.calendarIds.some((id) => {
			const calendar = calendarsById.get(id);
			return Boolean(calendar?.startDate && calendar.endDate);
		});
	}

	/**
	 * Steps back `count` active days of `calendarId` from `date`. A calendar the
	 * references don't carry counts civil days, matching iOS. Fails (null) when
	 * the walk passes the calendar's start, the calendar has no usable days, or
	 * it would need more than LOOKAHEAD_DAYS steps.
	 */
	function countBack(date, count, calendarId) {
		if (!(count > 0)) return date;
		const calendar = calendarId == null ? null : calendarsById.get(calendarId);
		if (!calendar) return date.subtract({ days: count });
		if (calendar.days.size === 0 || !calendar.startDate) return null;

		let remaining = count;
		let cursor = date;
		for (let stepped = 0; stepped < LOOKAHEAD_DAYS; stepped++) {
			cursor = cursor.subtract({ days: 1 });
			if (compareDates(cursor, calendar.startDate) < 0) return null;
			if (isActive(calendarId, cursor)) {
				remaining -= 1;
				if (remaining === 0) return cursor;
			}
		}
		return null;
	}

	function latestPickup(rule, date) {
		return instant(date, parseGtfsTime(rule.endPickupTime) ?? SECONDS_PER_DAY);
	}

	// Type 1: minutes before pickup. A null minimum would invent the latest
	// possible deadline, the worst failure, so it is unknown instead.
	// priorNoticeCalendarId is honoured only for type 2.
	function sameDayDeadlines(rule, bookingRule, date) {
		if (bookingRule.priorNoticeDurationMin == null) return null;
		const cutoff = latestPickup(rule, date).subtract({
			minutes: bookingRule.priorNoticeDurationMin
		});
		let open = null;
		if (bookingRule.priorNoticeDurationMax != null) {
			open = instant(date, parseGtfsTime(rule.startPickupTime) ?? 0).subtract({
				minutes: bookingRule.priorNoticeDurationMax
			});
		} else if (bookingRule.priorNoticeStartDay != null) {
			open = instant(
				date.subtract({ days: bookingRule.priorNoticeStartDay }),
				parseGtfsTime(bookingRule.priorNoticeStartTime) ?? 0
			);
		}
		return { cutoff, open };
	}

	// Type 2: prior day(s). A missing last time means 00:00, never later than
	// any real deadline.
	function priorDayDeadlines(bookingRule, date) {
		if (bookingRule.priorNoticeLastDay == null) return null;
		const calendarId = bookingRule.priorNoticeCalendarId;
		const lastDayDate = countBack(date, bookingRule.priorNoticeLastDay, calendarId);
		if (!lastDayDate) return null;
		const cutoff = instant(lastDayDate, parseGtfsTime(bookingRule.priorNoticeLastTime) ?? 0);
		if (bookingRule.priorNoticeStartDay == null) return { cutoff, open: null };
		const startDayDate = countBack(date, bookingRule.priorNoticeStartDay, calendarId);
		if (!startDayDate) return null;
		return {
			cutoff,
			open: instant(startDayDate, parseGtfsTime(bookingRule.priorNoticeStartTime) ?? 0)
		};
	}

	function deadlinesFor(rule, bookingRule, date) {
		switch (bookingRule.bookingType) {
			case 0:
				// Notice fields are forbidden for real-time booking and ignored.
				return { cutoff: latestPickup(rule, date), open: null };
			case 1:
				return sameDayDeadlines(rule, bookingRule, date);
			case 2:
				return priorDayDeadlines(bookingRule, date);
			default:
				return null;
		}
	}

	function evaluate(rule, bookingRule, date, now) {
		if (!bookingRule) return { state: 'open', cutoffInstant: null, openInstant: null };
		const deadlines = deadlinesFor(rule, bookingRule, date);
		if (!deadlines) return UNKNOWN;
		let state = 'open';
		if (deadlines.open && Temporal.Instant.compare(now, deadlines.open) < 0) state = 'notYetOpen';
		else if (Temporal.Instant.compare(now, deadlines.cutoff) > 0) state = 'closedForDate';
		return { state, cutoffInstant: deadlines.cutoff, openInstant: deadlines.open };
	}

	function lastServiceDate(rule) {
		const endDates = rule.calendarIds.map((id) => calendarsById.get(id)?.endDate).filter(Boolean);
		if (!endDates.length) return null;
		return endDates.reduce((latest, date) => (compareDates(date, latest) > 0 ? date : latest));
	}

	function nextActiveServiceDate(rule, from) {
		const last = lastServiceDate(rule);
		if (!last) return null;
		let cursor = from;
		for (let stepped = 0; stepped < LOOKAHEAD_DAYS && compareDates(cursor, last) <= 0; stepped++) {
			if (isRuleActive(rule, cursor)) return cursor;
			cursor = cursor.add({ days: 1 });
		}
		return null;
	}

	/** Visits each active service day of `rule` from the agency-local today, in order. */
	function walkServiceDates(rule, bookingRule, now, visit) {
		let cursor = serviceDate(now);
		for (let stepped = 0; stepped < LOOKAHEAD_DAYS; stepped++) {
			const candidate = nextActiveServiceDate(rule, cursor);
			if (!candidate) return;
			if (visit(candidate, evaluate(rule, bookingRule, candidate, now)) === false) return;
			cursor = candidate.add({ days: 1 });
		}
	}

	/** Earliest active day from today whose booking is open; unknown days are skipped. */
	function nextBookableServiceDate(rule, bookingRule, now) {
		let found = null;
		walkServiceDates(rule, bookingRule, now, (date, evaluation) => {
			if (evaluation.state !== 'open') return true;
			found = date;
			return false;
		});
		return found;
	}

	return {
		timeZone,
		anchor,
		instant,
		serviceDate,
		isActive,
		isRuleActive,
		hasUsableCalendar,
		countBack,
		evaluate,
		walkServiceDates,
		nextBookableServiceDate
	};
}
