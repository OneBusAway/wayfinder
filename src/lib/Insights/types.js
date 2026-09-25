/**
 * @typedef {Object} AnalyticsEnvelope
 * @property {string} name      Event name (e.g. "pageview", "search", "click").
 * @property {string} url       Path on the site (e.g. "/", "/stop").
 * @property {string} [id]      Persisted anonymous per-browser id (localStorage), forwarded
 *                               so Umami derives a stable visitor id instead of one keyed to
 *                               IP + User-Agent. Omitted when storage is unavailable.
 * @property {string} [referrer]
 * @property {string} [title]
 * @property {string} [language]
 * @property {string} [screen]  Format "WIDTHxHEIGHT".
 * @property {Object} [props]   Event-specific properties.
 */

/**
 * @typedef {Object} RequestContext
 * @property {string} userAgent  Forwarded from the originating browser.
 * @property {string} clientIp   Forwarded from the originating browser (X-Forwarded-For).
 */

export {};
