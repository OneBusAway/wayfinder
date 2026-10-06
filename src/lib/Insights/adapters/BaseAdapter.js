import { fetchWithTimeout } from '../../fetchWithTimeout.js';
import { insightsError, upstreamError } from '../upstreamError.js';

export class BaseAdapter {
	constructor(env, { name, requiredEnvKeys, timeoutMs }) {
		this.env = env;
		this.name = name;
		this.requiredEnvKeys = requiredEnvKeys;
		this.timeoutMs = timeoutMs;
		this.warnIfMisconfigured();
	}

	isEnabled() {
		return this.requiredEnvKeys.every((key) => !!this.env[key]);
	}

	warnIfMisconfigured() {
		for (const key of this.requiredEnvKeys) {
			if (!this.env[key]) {
				console.warn(`${this.name}: missing ${key} — events will not be sent`);
			}
		}
	}

	buildRequest() {
		throw new Error('buildRequest not implemented');
	}

	parseResponse(text) {
		try {
			return JSON.parse(text);
		} catch {
			return { status: text };
		}
	}

	async forwardEvent(envelope, requestContext) {
		if (!this.isEnabled()) {
			return { status: 'analytics disabled' };
		}

		const { name, url } = envelope ?? {};
		if (!name || !url) {
			throw insightsError('forwardEvent requires name and url', 400);
		}

		const request = this.buildRequest(envelope, requestContext);
		const response = await fetchWithTimeout(
			request.url,
			{
				method: 'POST',
				headers: request.headers,
				body: JSON.stringify(request.body)
			},
			this.timeoutMs
		);

		if (!response.ok) {
			throw await upstreamError(response);
		}

		return this.parseResponse(await response.text());
	}
}
