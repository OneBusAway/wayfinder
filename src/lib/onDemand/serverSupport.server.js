/**
 * Whether this deployment's OBA server serves `/api/ondemand`. One verdict per
 * process: a Wayfinder deployment talks to exactly one OBA server. Every
 * services-for-location reply is a probe; a service/{id} reply is one only
 * when it is a 2xx without an envelope, since a 404 for one service id is an
 * ordinary not-found.
 */

/** An unsupported verdict expires so an upgraded server is noticed without a restart. */
export const UNSUPPORTED_TTL_MS = 60 * 60 * 1000;

let verdict = { state: 'unknown', at: 0 };

/**
 * Stock maglev answers unknown paths with its HTML single-page app and a 200.
 * @param {{ status: number, body: any, isEnvelope: boolean }} reply
 * @returns {boolean}
 */
export function isSuccessWithoutEnvelope(reply) {
	return reply.status >= 200 && reply.status < 300 && !reply.isEnvelope;
}

/**
 * @param {{ status: number, body: any, isEnvelope: boolean }} reply
 * @returns {boolean}
 */
export function isUnsupportedReply(reply) {
	if (reply.status === 404) return true;
	if (isSuccessWithoutEnvelope(reply)) return true;
	return reply.isEnvelope && reply.body.code === 404;
}

/**
 * @param {{ status: number, body: any, isEnvelope: boolean }} reply
 * @param {number} [nowMs]
 */
export function recordProbeReply(reply, nowMs = Date.now()) {
	if (isUnsupportedReply(reply)) {
		verdict = { state: 'unsupported', at: nowMs };
	} else if (reply.isEnvelope && reply.body.code === 200) {
		verdict = { state: 'supported', at: nowMs };
	}
}

/**
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isKnownUnsupported(nowMs = Date.now()) {
	return verdict.state === 'unsupported' && nowMs - verdict.at < UNSUPPORTED_TTL_MS;
}

export function resetOnDemandSupportForTesting() {
	verdict = { state: 'unknown', at: 0 };
}
