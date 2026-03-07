export function filterActiveAlerts(situations) {
	const now = Date.now();
	return situations.filter((situation) =>
		(situation.activeWindows ?? []).some((window) => {
			const from = normalizeTimestamp(window.from) || 0;
			// If no end date provided, default to Infinity.
			const to = window.to ? normalizeTimestamp(window.to) : Infinity;
			return now >= from && now <= to;
		})
	);
}

/**
 * Normalizes a timestamp value.
 * If the difference between now and the timestamp is smaller when interpreted as milliseconds,
 * then it's assumed to be in milliseconds; otherwise, it's in seconds and converted to milliseconds.
 *
 * @param {number|null|undefined} time - The timestamp to normalize.
 * @returns {number} Normalized timestamp in milliseconds.
 */
export function normalizeTimestamp(time) {
	if (!time) return 0;
	const dtMilliseconds = new Date(time);
	const diffMilliseconds = Math.abs(Date.now() - dtMilliseconds.getTime());
	const dtSeconds = new Date(time * 1000);
	const diffSeconds = Math.abs(Date.now() - dtSeconds.getTime());
	return diffMilliseconds < diffSeconds ? time : time * 1000;
}
