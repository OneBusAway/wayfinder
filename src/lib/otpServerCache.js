import { PUBLIC_OTP_SERVER_URL } from '$env/static/public';

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, label) {
	let timeoutId;
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
	});
	return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

/** @type {'graphql' | 'rest' | null} */
let otpApiType = null;

/** @type {number | null} */
let cacheTimestamp = null;

/** @type {Promise<void> | null} */
let initPromise = null;

// Cache TTL: 1 hour
const CACHE_TTL = 3600000;

// Maximum time to wait for the OTP server to respond before giving up
const DETECT_TIMEOUT = 10_000;

// After a cold-start failure, minimum gap before retrying
const ERROR_RETRY_DELAY = 30_000;

/** @type {number | null} */
let lastErrorTime = null;

async function detectOtpVersion() {
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), DETECT_TIMEOUT);
	try {
		const response = await fetch(PUBLIC_OTP_SERVER_URL, { signal: ac.signal });

		if (!response.ok) {
			throw new Error(`OTP server returned HTTP ${response.status}`);
		}

		const contentType = response.headers.get('content-type') || '';

		if (contentType.includes('application/json')) {
			const data = await response.json();
			return data.version?.major >= 2 ? 'graphql' : 'rest';
		}

		// OTP 1.x returns XML — treat as REST
		return 'rest';
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Preloads OTP version detection into cache with TTL support.
 * Skips detection if PUBLIC_OTP_SERVER_URL is not configured.
 *
 * Stale-while-revalidate: when a cached type exists but is past TTL, a
 * background refresh is kicked off and the caller returns immediately so the
 * handle hook is not blocked. On a cold start (no type detected yet) the
 * caller waits up to DETECT_TIMEOUT milliseconds (bounded by the AbortController
 * inside detectOtpVersion) before proceeding.
 *
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<void>}
 */
export async function preloadOtpVersion(forceRefresh = false) {
	if (!PUBLIC_OTP_SERVER_URL) {
		return;
	}

	const now = Date.now();
	const isStale = cacheTimestamp !== null && now - cacheTimestamp > CACHE_TTL;

	if (otpApiType && !isStale && !forceRefresh) {
		return;
	}

	// Error cooldown: after a failure, don't immediately retry when there's no cached value.
	if (!otpApiType && lastErrorTime !== null && now - lastErrorTime < ERROR_RETRY_DELAY) {
		console.debug('[otpServerCache] Within error cooldown — serving without cached OTP version');
		return;
	}

	// A refresh is already in flight
	if (initPromise) {
		// Stale-while-revalidate: we have a value, don't block on background refresh
		if (otpApiType && !forceRefresh) {
			return;
		}
		await initPromise;
		return;
	}

	const promise = detectOtpVersion()
		.then((type) => {
			otpApiType = type;
			cacheTimestamp = Date.now();
			lastErrorTime = null;
		})
		.catch((err) => {
			if (err.name === 'AbortError') {
				console.warn(`[otpServerCache] OTP version detection timed out after ${DETECT_TIMEOUT}ms`);
			} else {
				console.error('[otpServerCache] OTP version detection failed:', err.message);
			}
			lastErrorTime = Date.now();
			if (otpApiType) {
				cacheTimestamp = Date.now();
			}
		})
		.finally(() => {
			initPromise = null;
		});

	initPromise = promise;

	// Stale-while-revalidate: background refresh started, return immediately
	if (otpApiType && !forceRefresh) {
		return;
	}

	// Cold start: wait for detection, bounded by withTimeout in addition to the AbortController
	// inside detectOtpVersion. This ensures the caller is never blocked indefinitely when the
	// OTP server is unreachable and the mock/real fetch does not honour the AbortSignal.
	try {
		await withTimeout(promise, DETECT_TIMEOUT, 'OTP version detection');
	} catch (err) {
		if (err.message?.includes('timed out')) {
			console.warn(`[otpServerCache] OTP version detection timed out after ${DETECT_TIMEOUT}ms`);
		} else {
			console.error('[otpServerCache] OTP version detection failed during cold start:', err);
		}

		lastErrorTime = Date.now();
	}
}

/**
 * Gets the detected OTP API type.
 * @returns {'graphql' | 'rest' | null}
 */
export function getOtpApiType() {
	return otpApiType;
}

/**
 * Clears cached OTP version data (for testing).
 */
export function clearOtpCache() {
	otpApiType = null;
	cacheTimestamp = null;
	initPromise = null;
	lastErrorTime = null;
}
