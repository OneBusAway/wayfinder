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

	async forwardEvent(envelope, requestContext) {
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

		const res = await fetch(this.getEventUrl(), {
			method: 'POST',
			headers,
			body: JSON.stringify({
				domain: this.env.PUBLIC_ANALYTICS_DOMAIN,
				name,
				url,
				referrer,
				props
			})
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
	}
}
