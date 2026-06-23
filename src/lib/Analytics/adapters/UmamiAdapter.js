const UPSTREAM_TIMEOUT_MS = 5000;

const MAX_DATA_VALUE_LENGTH = 256;

// Sent when no end-user User-Agent is available. Must survive Umami's isbot filter:
// no bot token (isbot matches `server`/`bot`/etc. unanchored, case-insensitively) and
// not a bare `Mozilla/x.x <token>` string (the `(` breaks isbot's anchored pattern).
export const FALLBACK_USER_AGENT = 'Mozilla/5.0 (Wayfinder)';

/**
 * Coerce arbitrary event props into Umami-safe `data` values: keep strings (truncated),
 * finite numbers, and booleans; drop null/undefined and non-finite numbers; JSON-stringify
 * anything else (truncated). Bounds uncontrolled user input (e.g. the free-text search query).
 * @param {Object} [props]
 * @returns {Object}
 */
export function sanitizeData(props) {
	const out = {};
	for (const [key, value] of Object.entries(props ?? {})) {
		if (value === null || value === undefined) continue;
		const type = typeof value;
		if (type === 'boolean') {
			out[key] = value;
		} else if (type === 'string') {
			out[key] = value.slice(0, MAX_DATA_VALUE_LENGTH);
		} else if (type === 'number') {
			if (Number.isFinite(value)) out[key] = value;
		} else {
			out[key] = JSON.stringify(value).slice(0, MAX_DATA_VALUE_LENGTH);
		}
	}
	return out;
}

export class UmamiAdapter {
	constructor(env) {
		this.env = env;
		this.warnIfMisconfigured();
	}

	warnIfMisconfigured() {
		const missing = [];
		if (!this.env.PUBLIC_ANALYTICS_DOMAIN) missing.push('PUBLIC_ANALYTICS_DOMAIN');
		if (!this.env.PUBLIC_ANALYTICS_API_HOST) missing.push('PUBLIC_ANALYTICS_API_HOST');
		if (!this.env.PUBLIC_ANALYTICS_WEBSITE_ID) missing.push('PUBLIC_ANALYTICS_WEBSITE_ID');
		for (const key of missing) {
			console.warn(`UmamiAdapter: missing ${key} — events will not be sent`);
		}
	}

	isEnabled() {
		return (
			!!this.env.PUBLIC_ANALYTICS_DOMAIN &&
			!!this.env.PUBLIC_ANALYTICS_API_HOST &&
			!!this.env.PUBLIC_ANALYTICS_WEBSITE_ID
		);
	}

	getEventUrl() {
		return `${this.env.PUBLIC_ANALYTICS_API_HOST}/api/send`;
	}

	async forwardEvent(envelope, requestContext) {
		if (!this.isEnabled()) {
			return { status: 'analytics disabled' };
		}

		const {
			name,
			url,
			referrer = '',
			title = '',
			language = '',
			screen = '',
			props = {}
		} = envelope;

		if (!name || !url) {
			throw new Error('forwardEvent requires name and url');
		}

		const body = {
			type: 'event',
			payload: {
				website: this.env.PUBLIC_ANALYTICS_WEBSITE_ID,
				hostname: this.env.PUBLIC_ANALYTICS_DOMAIN,
				language,
				screen,
				url,
				referrer,
				title,
				name,
				data: sanitizeData(props)
			}
		};

		const headers = {
			'Content-Type': 'application/json',
			'User-Agent': requestContext.userAgent || FALLBACK_USER_AGENT
		};
		if (requestContext.clientIp) {
			headers['X-Forwarded-For'] = requestContext.clientIp;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

		try {
			const res = await fetch(this.getEventUrl(), {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				signal: controller.signal
			});

			if (!res.ok) {
				const err = new Error(`Error sending event: ${res.statusText}`);
				err.upstreamStatus = res.status;
				throw err;
			}

			const text = await res.text();
			try {
				return JSON.parse(text);
			} catch {
				return { status: text };
			}
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
