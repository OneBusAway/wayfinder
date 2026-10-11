/**
 * Rider-facing strings for on-demand statuses and booking lines. Times are in
 * the agency timezone; `now` decides the today/tomorrow wording.
 * @typedef {{ t: (key: string, options?: object) => string, locale: string, timeZone: string, now: Temporal.Instant }} CopyContext
 */

const TAG_KEYS = {
	realTime: 'ondemand.tag_no_notice',
	sameDay: 'ondemand.tag_same_day',
	advance: 'ondemand.tag_advance'
};
const RELATIVE_DAY_KEYS = {
	'-1': 'ondemand.yesterday_at',
	0: 'ondemand.today_at',
	1: 'ondemand.tomorrow_at'
};

/** @param {'realTime' | 'sameDay' | 'advance' | null} bookingTier */
export function bookingTagKey(bookingTier) {
	return TAG_KEYS[bookingTier] ?? null;
}

function formatTime(instant, { locale, timeZone }) {
	return new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit' }).format(
		new Date(instant.epochMilliseconds)
	);
}

/**
 * "today at 5:00 PM", "tomorrow at 7:00 AM", else "Mar 15, 7:00 AM".
 * @param {Temporal.Instant} instant
 * @param {CopyContext} ctx
 */
export function formatRelativeDateTime(instant, ctx) {
	const day = instant.toZonedDateTimeISO(ctx.timeZone).toPlainDate();
	const today = ctx.now.toZonedDateTimeISO(ctx.timeZone).toPlainDate();
	const dayOffset = today.until(day, { largestUnit: 'days' }).days;
	const key = RELATIVE_DAY_KEYS[dayOffset];
	if (key) return ctx.t(key, { values: { time: formatTime(instant, ctx) } });
	return new Intl.DateTimeFormat(ctx.locale, {
		timeZone: ctx.timeZone,
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(new Date(instant.epochMilliseconds));
}

/**
 * @param {Temporal.PlainDate} date
 * @param {string} locale
 * @returns {string} e.g. "Thu, Mar 12"
 */
export function formatTravelDate(date, locale) {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}

/**
 * @param {import('./availability.js').Status} status
 * @param {CopyContext} ctx
 * @param {'row' | 'detail'} variant - the detail sheet says "Open now"
 * @returns {string | null}
 */
export function formatStatus(status, ctx, variant) {
	switch (status.kind) {
		case 'openNow': {
			if (!status.until) return ctx.t('ondemand.status_open');
			const key =
				variant === 'detail' ? 'ondemand.status_open_now_until' : 'ondemand.status_open_until';
			return ctx.t(key, { values: { time: formatTime(status.until, ctx) } });
		}
		case 'opensAt':
			return ctx.t('ondemand.status_opens', {
				values: { when: formatRelativeDateTime(status.instant, ctx) }
			});
		case 'bookingOpens':
			return ctx.t('ondemand.status_booking_opens', {
				values: { when: formatRelativeDateTime(status.instant, ctx) }
			});
		case 'bookBy':
			return ctx.t('ondemand.status_book_by', {
				values: { when: formatRelativeDateTime(status.deadline, ctx) }
			});
		case 'closed':
			return ctx.t('ondemand.status_closed');
		default:
			return null;
	}
}

/**
 * @param {import('./bookingResolution.js').Resolution} resolution
 * @param {CopyContext} ctx
 * @returns {string}
 */
export function formatBookingLine(resolution, ctx) {
	switch (resolution.kind) {
		case 'bookBy':
			return ctx.t('ondemand.book_by_for_ride', {
				values: {
					deadline: formatRelativeDateTime(resolution.cutoff, ctx),
					date: formatTravelDate(resolution.travelDate, ctx.locale)
				}
			});
		case 'opensAt':
			return ctx.t('ondemand.status_booking_opens', {
				values: { when: formatRelativeDateTime(resolution.instant, ctx) }
			});
		case 'noNoticeRequired':
			return ctx.t('ondemand.no_notice_required');
		case 'closed':
			return ctx.t('ondemand.booking_closed');
		default:
			return ctx.t('ondemand.booking_unknown');
	}
}
