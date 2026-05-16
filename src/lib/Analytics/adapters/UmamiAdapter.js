const UPSTREAM_TIMEOUT_MS = 5000;

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
				data: props
			}
		};

		const headers = {
			'Content-Type': 'application/json',
			'User-Agent': requestContext.userAgent || 'Wayfinder/1.0'
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
