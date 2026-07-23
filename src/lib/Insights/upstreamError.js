const MAX_UPSTREAM_BODY_LENGTH = 300;

/**
 * Build an Error carrying the `upstreamStatus` that `/api/events` reads to pick its own
 * HTTP status. Single home for that contract so every upstream-failure throw in this
 * feature spells it the same way.
 *
 * @param {string} message
 * @param {number} upstreamStatus
 * @returns {Error}
 */
export function insightsError(message, upstreamStatus) {
	const err = new Error(message);
	err.upstreamStatus = upstreamStatus;
	return err;
}

/**
 * Build the Error for a non-OK response, folding the response body into the message. The
 * actionable reason lives in the body — Umami answers a stale PUBLIC_ANALYTICS_WEBSITE_ID
 * with `{"error":{"message":"Website not found."}}` — while statusText is only
 * "Bad Request", so dropping the body makes misconfiguration undiagnosable.
 *
 * The body is consumed (callers must not read it again) and capped at
 * MAX_UPSTREAM_BODY_LENGTH so a misconfigured proxy's HTML error page can't flood logs.
 * The numeric status leads the message because HTTP/2 has no reason phrase: statusText is
 * always '' there, which is the shape the browser sees when it calls this on /api/events.
 *
 * @param {{status?: number, statusText?: string, text?: () => Promise<string>}} res -
 *   The non-OK response. Deliberately tolerant of Response-likes missing `text()`.
 * @returns {Promise<Error>} Error carrying `upstreamStatus`.
 */
export async function upstreamError(res) {
	let detail = '';
	try {
		detail = (await res.text()).trim();
	} catch (bodyError) {
		// An unreadable body must not mask the failure it was meant to explain — but an
		// empty body and an unreadable one are different incidents, so say which happened.
		detail = `<upstream body unreadable: ${bodyError?.name || 'Error'}>`;
	}

	if (detail.length > MAX_UPSTREAM_BODY_LENGTH) {
		detail = `${detail.slice(0, MAX_UPSTREAM_BODY_LENGTH)}…`;
	}

	const status = [res.status, res.statusText].filter(Boolean).join(' ');

	return insightsError(`Error sending event: ${status}${detail ? ` — ${detail}` : ''}`, res.status);
}
