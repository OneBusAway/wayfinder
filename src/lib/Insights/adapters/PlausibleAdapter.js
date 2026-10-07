import { BaseAdapter } from './BaseAdapter.js';

export class PlausibleAdapter extends BaseAdapter {
	constructor(env) {
		super(env, {
			name: 'PlausibleAdapter',
			requiredEnvKeys: ['PUBLIC_ANALYTICS_DOMAIN', 'PUBLIC_ANALYTICS_API_HOST'],
			timeoutMs: 5000
		});
	}

	buildRequest(envelope, requestContext) {
		// `??` rather than a default parameter: the endpoint gets this from
		// `await request.json()`, which returns null for a literal null body and
		// never undefined, so a default parameter never fires on the reachable case.
		const { name, url, referrer = '', props = {} } = envelope;

		const headers = { 'Content-Type': 'application/json' };
		if (requestContext.userAgent) headers['User-Agent'] = requestContext.userAgent;
		if (requestContext.clientIp) headers['X-Forwarded-For'] = requestContext.clientIp;

		return {
			url: `${this.env.PUBLIC_ANALYTICS_API_HOST}/api/event`,
			body: {
				domain: this.env.PUBLIC_ANALYTICS_DOMAIN,
				name,
				url,
				referrer,
				props
			},
			headers
		};
	}
}
