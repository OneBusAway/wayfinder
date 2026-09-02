import { env } from '$env/dynamic/private';

/**
 * Configuration for Sidecar, the OneBusAway service that supplies service
 * alerts and rider surveys. Sidecar was formerly called Obaco / OneBusAway.co,
 * and its environment variables were named after it. The old names still work
 * so that existing deployments don't break, but each one warns once at first
 * use and will be removed in a future release.
 *
 * `env-schema.json` records the same pairs as `deprecatedNames` so that
 * `npm run validate-env` can flag them, and a test keeps the two in agreement.
 * That schema field is validation-only: adding an alias there does not create a
 * runtime fallback, which is hand-written here. One alias per variable — this
 * map cannot express a second.
 */
export const DEPRECATED_ALIASES = {
	PRIVATE_SIDECAR_API_BASE_URL: 'PRIVATE_OBACO_API_BASE_URL',
	PRIVATE_SIDECAR_REGION_ID: 'PRIVATE_REGION_ID',
	PRIVATE_SIDECAR_SHOW_TEST_ALERTS: 'PRIVATE_OBACO_SHOW_TEST_ALERTS'
};

const warned = new Set();

/** Logs `message` the first time it is reported for `key`, then stays quiet. */
function warnOnce(key, message) {
	if (warned.has(key)) return;
	warned.add(key);
	console.warn(message);
}

/**
 * Reads a Sidecar setting, falling back to its pre-rename name. A variable set
 * to an empty string counts as unset, so an empty current name still lets the
 * deprecated name take effect.
 *
 * @param {keyof typeof DEPRECATED_ALIASES} name
 * @returns {string | undefined} the configured value, or undefined if neither
 *   name holds a non-empty value
 */
function readSetting(name) {
	const legacyName = DEPRECATED_ALIASES[name];
	const legacyValue = env[legacyName];

	if (env[name]) {
		// Say so rather than letting a stale legacy value look like it's in use.
		if (legacyValue) {
			warnOnce(legacyName, `[sidecar] ${legacyName} is set but ignored; ${name} takes precedence.`);
		}
		return env[name];
	}

	if (!legacyValue) {
		return undefined;
	}

	warnOnce(
		legacyName,
		`[sidecar] ${legacyName} is deprecated and will be removed in a future release. Rename it to ${name}.`
	);

	return legacyValue;
}

/**
 * @returns {string | undefined} the configured Sidecar API base URL — by
 *   convention including the `/api/v1` path prefix, though nothing enforces
 *   that — or undefined when no base URL is set
 */
export function getSidecarBaseURL() {
	return readSetting('PRIVATE_SIDECAR_API_BASE_URL');
}

/**
 * @returns {string | undefined} the region-scoped path prefix, in the form
 *   `regions/<id>/` with the trailing slash included so callers can append a
 *   leaf directly, or undefined when no region ID is configured. Callers must
 *   treat undefined as "Sidecar is unusable" rather than falling back to an
 *   unprefixed path: the region-scoped endpoints (`alerts.pb`, `surveys.json`)
 *   exist only under `regions/<id>/`.
 */
export function getSidecarRegionPath() {
	const regionID = readSetting('PRIVATE_SIDECAR_REGION_ID');
	return regionID ? `regions/${regionID}/` : undefined;
}

/**
 * @returns {boolean} whether test alerts are enabled. The alerts route both
 *   asks Sidecar for test alerts and returns the first entity unfiltered,
 *   skipping the validity and agency-filter checks. Never enable this in
 *   production; it surfaces alerts that aren't real.
 */
export function sidecarShowsTestAlerts() {
	return readSetting('PRIVATE_SIDECAR_SHOW_TEST_ALERTS') === 'true';
}

/**
 * Logs that a route is skipping Sidecar work, naming only the variables that
 * are actually unset. Kept here so the variable names live in one module
 * rather than in every route that reports them, and throttled because these
 * routes are hit on every map load — an unbounded stream of identical warnings
 * is one more way to hide a message.
 *
 * @param {string} context the route tag to prefix the message with
 * @param {string[]} missing names of the unset environment variables
 */
export function warnSidecarNotConfigured(context, missing) {
	warnOnce(
		`not-configured:${context}:${missing.join(',')}`,
		`[${context}] Sidecar is disabled: ${missing.join(', ')} ${
			missing.length === 1 ? 'is' : 'are'
		} not set.`
	);
}
