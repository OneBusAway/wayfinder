import { parseGtfsTime } from '$lib/onDemand/bookingDeadline.js';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SECONDS_PER_DAY = 86400;

/**
 * Rows for the detail sheet's "When" section: rules merged by identical hours,
 * then one muted row for weekdays no current calendar covers.
 * @param {import('./models.js').OnDemandService} service
 * @param {{ locale: string, today: Temporal.PlainDate }} options
 */
export function hoursRows(service, { locale, today }) {
	const groups = new Map();
	for (const rule of service.rules) {
		const days = ruleWeekdays(service, rule, () => true);
		if (!days.size) continue;
		const start = parseGtfsTime(rule.startPickupTime);
		const end = parseGtfsTime(rule.endPickupTime);
		const isAllHours = start == null && end == null;
		const key = isAllHours ? 'all' : `${start ?? 0}-${end ?? SECONDS_PER_DAY}`;
		const group = groups.get(key) ?? {
			days: new Set(),
			start: start ?? 0,
			end: end ?? SECONDS_PER_DAY,
			isAllHours
		};
		days.forEach((day) => group.days.add(day));
		groups.set(key, group);
	}

	const rows = [...groups.values()]
		.sort((a, b) => firstDayIndex(a.days) - firstDayIndex(b.days) || a.start - b.start)
		.map((group) => toRow(group, locale));

	const covered = new Set(
		service.rules.flatMap((rule) => [
			...ruleWeekdays(service, rule, (calendar) => isCurrent(calendar, today))
		])
	);
	const missing = WEEKDAYS.filter((day) => !covered.has(day));
	if (missing.length) rows.push({ kind: 'noService', days: formatDayRanges(missing, locale) });
	return rows;
}

function ruleWeekdays(service, rule, includeCalendar) {
	return new Set(
		rule.calendarIds
			.map((id) => service.refs.calendars.get(id))
			.filter((calendar) => calendar && includeCalendar(calendar))
			.flatMap((calendar) => calendar.days)
			.filter((day) => WEEKDAYS.includes(day))
	);
}

function isCurrent(calendar, today) {
	return calendar.endDate == null || calendar.endDate >= today.toString();
}

function firstDayIndex(days) {
	return Math.min(...[...days].map((day) => WEEKDAYS.indexOf(day)));
}

function toRow(group, locale) {
	const days = formatDayRanges([...group.days], locale);
	if (group.isAllHours) return { kind: 'allHours', days };
	return {
		kind: 'hours',
		days,
		start: formatWallClock(group.start, locale),
		end: formatWallClock(group.end, locale),
		startNextDay: group.start >= SECONDS_PER_DAY,
		endNextDay: group.end >= SECONDS_PER_DAY
	};
}

function formatWallClock(seconds, locale) {
	const date = new Date((seconds % SECONDS_PER_DAY) * 1000);
	return new Intl.DateTimeFormat(locale, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC'
	}).format(date);
}

/**
 * @param {string[]} days - GTFS weekday keys ('mon'…'sun'), any order
 * @param {string} locale
 * @returns {string} e.g. "Mon–Fri", "Mon, Wed"
 */
export function formatDayRanges(days, locale) {
	const indexes = WEEKDAYS.map((_, index) => index).filter((index) =>
		days.includes(WEEKDAYS[index])
	);
	const runs = [];
	for (const index of indexes) {
		const run = runs.at(-1);
		if (run && run.at(-1) === index - 1) run.push(index);
		else runs.push([index]);
	}
	// 2024-01-01 was a Monday.
	const name = (index) =>
		new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
			new Date(Date.UTC(2024, 0, 1 + index))
		);
	return runs
		.map((run) => (run.length >= 2 ? `${name(run[0])}–${name(run.at(-1))}` : name(run[0])))
		.join(', ');
}
