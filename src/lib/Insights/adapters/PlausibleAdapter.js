import { upstreamError } from '../upstreamError.js';

const UPSTREAM_TIMEOUT_MS = 5000;

export class PlausibleAdapter {
	constructor(env) {
		this.env = env;
		this.warnIfMisconfigured();
	}

	warnIfMisconfigured() {
		const missing = [];
		if (!this.env.PUBLIC_ANALYTICS_DOMAIN) missing.push('PUBLIC_ANALYTICS_DOMAIN');
		if (!this.env.PUBLIC_ANALYTICS_API_HOST) missing.push('PUBLIC_ANALYTICS_API_HOST');
		for (const key of missing) {
			console.warn(`PlausibleAdapter: missing ${key} — events will not be sent`);
		}
	}

	isEnabled() {
		return !!this.env.PUBLIC_ANALYTICS_DOMAIN && !!this.env.PUBLIC_ANALYTICS_API_HOST;
	}

	getEventUrl() {
		return `${this.env.PUBLIC_ANALYTICS_API_HOST}/api/event`;
	}

	async forwardEvent(envelope = {}, requestContext) {
		// Disabled analytics intentionally ignores malformed events so local development
		// and tests without a complete analytics configuration remain quiet.
		if (!this.isEnabled()) {
			return { status: 'analytics disabled' };
		}

		const { name, url, referrer = '', props = {} } = envelope;

		if (!name || !url) {
			throw new Error('forwardEvent requires name and url');
		}

		const headers = { 'Content-Type': 'application/json' };
		if (requestContext.userAgent) headers['User-Agent'] = requestContext.userAgent;
		if (requestContext.clientIp) headers['X-Forwarded-For'] = requestContext.clientIp;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

		try {
			const res = await fetch(this.getEventUrl(), {
				method: 'POST',
				headers,
				body: JSON.stringify({
					domain: this.env.PUBLIC_ANALYTICS_DOMAIN,
					name,
					url,
					referrer,
					props
				}),
				signal: controller.signal
			});

			if (!res.ok) {
				throw await upstreamError(res);
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
