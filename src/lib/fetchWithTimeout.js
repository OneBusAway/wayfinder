/**
 * Fetch with an abort timeout while preserving an optional caller-provided signal.
 * @param {RequestInfo | URL} url
 * @param {RequestInit} [init]
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, init = {}, timeoutMs) {
	const controller = new AbortController();
	const callerSignal = init.signal;
	const abortFromCaller = () => controller.abort();

	if (callerSignal?.aborted) {
		controller.abort();
	} else {
		callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
	}

	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeoutId);
		callerSignal?.removeEventListener('abort', abortFromCaller);
	}
}
