const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const REFRESH_SLACK_MS = 1000;

/**
 * @param {Temporal.Instant} a
 * @param {Temporal.Instant} b
 */
export function compareInstants(a, b) {
	return Temporal.Instant.compare(a, b);
}

/**
 * @param {Array<Temporal.Instant | null | undefined>} instants
 * @returns {Temporal.Instant | null}
 */
export function minInstant(instants) {
	let best = null;
	for (const candidate of instants) {
		if (candidate && (!best || compareInstants(candidate, best) < 0)) best = candidate;
	}
	return best;
}

/**
 * @param {Array<Temporal.Instant | null | undefined>} instants
 * @param {Temporal.Instant} now
 * @returns {Temporal.Instant | null}
 */
export function earliestAfter(instants, now) {
	return minInstant(
		instants.filter((candidate) => candidate && compareInstants(candidate, now) > 0)
	);
}

/**
 * Runs `callback` one second after `instant`, so status re-evaluates once the
 * boundary has safely passed. Returns a cancel function.
 * @param {Temporal.Instant | null} instant
 * @param {() => void} callback
 * @param {number} [nowMs]
 * @returns {() => void}
 */
export function scheduleAt(instant, callback, nowMs = Date.now()) {
	if (!instant) return () => {};
	const delay = instant.epochMilliseconds - nowMs + REFRESH_SLACK_MS;
	const timer = setTimeout(callback, Math.min(Math.max(delay, 0), MAX_TIMEOUT_MS));
	return () => clearTimeout(timer);
}
