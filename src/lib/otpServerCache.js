import { PUBLIC_OTP_SERVER_URL } from '$env/static/public';

/** @type {'graphql' | 'rest' | null} */
let otpApiType = null;

/** @type {number | null} */
let cacheTimestamp = null;

/** @type {Promise<void> | null} */
let initPromise = null;

// Cache TTL: 1 hour
const CACHE_TTL = 3600000;

async function detectOtpVersion() {
	const response = await fetch(PUBLIC_OTP_SERVER_URL);
	const contentType = response.headers.get('content-type') || '';

	if (contentType.includes('application/json')) {
		const data = await response.json();
		return data.version?.major >= 2 ? 'graphql' : 'rest';
	}

	// OTP 1.x returns XML — treat as REST
	return 'rest';
}

/**
 * Preloads OTP version detection into cache with TTL support.
 * Skips detection if PUBLIC_OTP_SERVER_URL is not configured.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<void>}
 */
export async function preloadOtpVersion(forceRefresh = false) {
	if (!PUBLIC_OTP_SERVER_URL) {
		return;
	}

	const now = Date.now();
	const isStale = cacheTimestamp && now - cacheTimestamp > CACHE_TTL;

	if (otpApiType && !isStale && !forceRefresh) {
		return;
	}

	if (initPromise) {
		await initPromise;
		return;
	}

	const promise = detectOtpVersion()
		.then((type) => {
			otpApiType = type;
			cacheTimestamp = now;
		})
		.catch((err) => {
			console.error('OTP version detection failed:', err.message);
			// Leave otpApiType as null — will default to REST in the route handler
		})
		.finally(() => {
			initPromise = null;
		});

	initPromise = promise;
	await promise;
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
}
